import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import {
  getListWeightRecordsQueryKey,
  useCreateWeightRecord,
  useDeleteWeightRecord,
  useListWeightRecords,
  useUpdateWeightRecord,
  useUndoDeleteWeightRecord,
  WEIGHT_RECORD_UNDO_WINDOW_MS,
  type DeletedWeightRecord,
  type WeightRecord,
} from '@/lib/local-api';
import { isIsoDate, today } from '@/lib/format';
import { Btn, Card, Eyebrow, F, Field, Muted, Screen, SectionTitle, Title, success, warn } from '@/components/ui';
import WeightChart from '@/components/WeightChart';

function WeightTracker() {
  const router = useRouter();
  const c = useColors();
  const { person, date } = usePlanner();
  const personId = person.id;
  const currentDate = today();
  const recordsQuery = useListWeightRecords(
    { personId },
    { query: { enabled: true, queryKey: getListWeightRecordsQueryKey({ personId }) } },
  );
  const create = useCreateWeightRecord();
  const update = useUpdateWeightRecord();
  const remove = useDeleteWeightRecord();
  const undoDelete = useUndoDeleteWeightRecord();
  const records = recordsQuery.data ?? [];
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [records],
  );
  const [dateText, setDateText] = useState(date);
  const [weightText, setWeightText] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [undoReceipts, setUndoReceipts] = useState<DeletedWeightRecord[]>([]);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const saveBusy = create.isPending || update.isPending;

  useEffect(() => {
    if (undoReceipts.length === 0) return;
    const nextExpiry = Math.min(...undoReceipts.map(receipt => receipt.expiresAt));
    const timer = setTimeout(() => {
      const currentTime = Date.now();
      setUndoReceipts(current => current.filter(receipt => receipt.expiresAt > currentTime));
    }, Math.max(0, nextExpiry - Date.now()) + 10);
    return () => clearTimeout(timer);
  }, [undoReceipts]);

  function resetForm() {
    setEditingRecordId(null);
    setDateText(date);
    setWeightText('');
    setFormError(null);
  }

  function beginEdit(record: WeightRecord) {
    setEditingRecordId(record.id);
    setDateText(record.date);
    setWeightText(String(record.weightKg));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function saveMeasurement() {
    setFormError(null);
    setSuccessMessage(null);
    if (!isIsoDate(dateText)) {
      setFormError('Enter a real date in YYYY-MM-DD format.');
      return;
    }
    if (dateText > currentDate) {
      setFormError('A weigh-in cannot be dated in the future.');
      return;
    }
    if (person.dateOfBirth && dateText < person.dateOfBirth) {
      setFormError('The weigh-in date cannot be before the saved date of birth.');
      return;
    }
    const weightKg = Number(weightText.trim());
    if (!weightText.trim() || !Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
      setFormError('Enter a finite weight from 1 to 500 kg.');
      return;
    }
    if (records.some(record => record.date === dateText && record.id !== editingRecordId)) {
      setFormError('A weigh-in is already saved for this person and date. Edit that entry instead.');
      return;
    }
    try {
      if (editingRecordId === null) {
        const saved = await create.mutateAsync({ data: { personId, date: dateText, weightKg } });
        setSuccessMessage(`Weigh-in saved for ${saved.date}.`);
      } else {
        const saved = await update.mutateAsync({ id: editingRecordId, data: { date: dateText, weightKg } });
        setSuccessMessage(`Weigh-in updated for ${saved.date}.`);
      }
      success();
      resetForm();
    } catch (error) {
      warn();
      setFormError(error instanceof Error ? error.message : 'The weigh-in could not be saved. Try again.');
    }
  }

  async function deleteMeasurement(record: WeightRecord) {
    setDeleteError(null);
    try {
      const deleted = await remove.mutateAsync({ id: record.id, personId });
      setUndoReceipts(current => [...current.filter(receipt => receipt.expiresAt > Date.now()), deleted]);
      setUndoError(null);
      setConfirmDeleteId(null);
      if (editingRecordId === record.id) resetForm();
      success();
      setSuccessMessage(`Weigh-in from ${record.date} deleted. You can undo this for ${WEIGHT_RECORD_UNDO_WINDOW_MS / 1000} seconds.`);
    } catch (error) {
      warn();
      setDeleteError(error instanceof Error ? error.message : 'The weigh-in could not be deleted. Try again.');
    }
  }

  async function undoDeleteMeasurement(receipt: DeletedWeightRecord) {
    setUndoError(null);
    try {
      await undoDelete.mutateAsync({ token: receipt.token, personId });
      setUndoReceipts(current => current.filter(item => item.token !== receipt.token));
      setSuccessMessage(`Weigh-in from ${receipt.record.date} restored.`);
      success();
    } catch (error) {
      warn();
      setUndoError(error instanceof Error ? error.message : 'This weigh-in could not be restored.');
    }
  }

  const latest = sortedRecords[0];
  const differenceFromTarget = latest && person.targetWeightKg !== null
    ? latest.weightKg - person.targetWeightKg
    : null;

  return <Screen title="Weight progress">
    <Eyebrow>Private on this device</Eyebrow>
    <Title sub={`Record weigh-ins for ${person.name}. These entries and the target are separate from planning body weight.`}>Weight progress</Title>

    <Card tone="mint">
      <SectionTitle kicker="Target">Saved target weight</SectionTitle>
      {person.targetWeightKg === null
        ? <Muted>No target is set. Add one in {person.name}'s profile to show a comparison line.</Muted>
        : <Text testID="value-weight-target" style={{ fontFamily: F.bold, fontSize: 27, letterSpacing: -0.8, color: c.foreground }}>
          {person.targetWeightKg.toFixed(1)} kg
        </Text>}
      {latest ? <View testID="weight-target-comparison">
        <Muted>
          Latest weigh-in: {latest.weightKg.toFixed(1)} kg · {latest.date}
          {differenceFromTarget === null ? '' : ` · ${Math.abs(differenceFromTarget).toFixed(1)} kg ${differenceFromTarget === 0 ? 'from' : differenceFromTarget > 0 ? 'above' : 'below'} target`}
        </Muted>
      </View> : null}
      <Muted>This is an informational comparison only. It does not update planning body weight or change calorie estimates or nutrition references.</Muted>
      <Btn small variant="ghost" label="Edit target in profile" icon="edit-2" testID="button-weight-edit-target"
        onPress={() => router.push({ pathname: '/person-form', params: { id: String(person.id) } })} />
    </Card>

    <Card>
      <SectionTitle kicker="Observation">{editingRecordId === null ? 'Add a weigh-in' : 'Edit a weigh-in'}</SectionTitle>
      <Muted>Use the date the measurement was taken. One entry per person per date; update the existing entry if needed.</Muted>
      <Field
        label="Measurement date"
        hint="Selected planner date is the starting value. Enter YYYY-MM-DD."
        value={dateText}
        onChangeText={value => { setDateText(value); setFormError(null); }}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!saveBusy && !remove.isPending}
        testID="input-weight-observation-date"
        accessibilityLabel="Weigh-in date"
      />
      <Field
        label="Weight (kg)"
        hint="Enter a measurement from 1 to 500 kg."
        value={weightText}
        onChangeText={value => { setWeightText(value); setFormError(null); }}
        placeholder="e.g. 68.5"
        keyboardType="decimal-pad"
        editable={!saveBusy && !remove.isPending}
        testID="input-weight-kilograms"
        accessibilityLabel="Weigh-in weight in kilograms"
      />
      {formError ? <Text testID="weight-save-error" accessibilityRole="alert" style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>{formError}</Text> : null}
      <Btn
        icon={editingRecordId === null ? 'plus' : 'save'}
        label={editingRecordId === null ? 'Save weigh-in' : 'Update weigh-in'}
        testID="button-save-weight-record"
        loading={saveBusy}
        disabled={remove.isPending}
        onPress={() => void saveMeasurement()}
      />
      {editingRecordId !== null ? <Btn variant="ghost" label="Cancel edit" testID="button-cancel-weight-edit" disabled={saveBusy || remove.isPending} onPress={resetForm} /> : null}
    </Card>

    {successMessage ? <Text testID="weight-success" accessibilityLiveRegion="polite" style={{ fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: c.primary }}>{successMessage}</Text> : null}
    {undoReceipts.map(receipt => <Card key={receipt.token} tone="mint" style={{ gap: 7 }}>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: c.foreground }}>
        Deleted {receipt.record.date} · {receipt.record.weightKg.toFixed(1)} kg. Undo is available for {WEIGHT_RECORD_UNDO_WINDOW_MS / 1000} seconds.
      </Text>
      <Btn small variant="ghost" icon="rotate-ccw" label="Undo delete" testID={`button-undo-weight-${receipt.record.id}`}
        loading={undoDelete.isPending} disabled={remove.isPending || undoDelete.isPending}
        onPress={() => void undoDeleteMeasurement(receipt)} />
      {undoError ? <Text testID="weight-undo-error" accessibilityRole="alert" style={{ fontFamily: F.medium, fontSize: 13, color: c.destructive }}>{undoError}</Text> : null}
    </Card>)}

    <Card>
      <SectionTitle kicker="Chart">Weight over time</SectionTitle>
      <Muted>The chart uses only weigh-ins you save here. The dashed line is your optional target; neither changes planning estimates.</Muted>
      {recordsQuery.isLoading ? <View testID="status-weight-loading" accessibilityLiveRegion="polite"><Muted>Loading saved weigh-ins…</Muted></View> : null}
      {recordsQuery.isError ? <View testID="weight-records-error" accessibilityRole="alert" style={{ gap: 8 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>Saved weigh-ins could not be loaded. {recordsQuery.error.message}</Text>
        <Btn small variant="ghost" icon="refresh-cw" label="Retry loading weigh-ins" testID="button-retry-weight-records" onPress={() => void recordsQuery.refetch()} />
      </View> : null}
      {!recordsQuery.isLoading && !recordsQuery.isError && records.length > 0
        ? <WeightChart records={records} targetWeightKg={person.targetWeightKg} />
        : null}
      {records.length === 0 && !recordsQuery.isLoading && !recordsQuery.isError ? <View testID="status-weight-empty" style={{ paddingTop: 4 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>No weigh-ins yet</Text>
        <Muted>Your chart and dated history will use only measurements saved here.</Muted>
      </View> : null}
    </Card>

    <SectionTitle kicker="Saved locally">Every saved weigh-in</SectionTitle>
    {recordsQuery.isLoading ? <View testID="status-weight-list-loading"><Muted>Loading weigh-in history…</Muted></View> : null}
    {!recordsQuery.isLoading && !recordsQuery.isError && sortedRecords.length === 0 ? <Card>
      <Muted>No weigh-ins have been saved for {person.name}.</Muted>
    </Card> : null}
    {sortedRecords.map(record => <Card key={record.id} style={{ gap: 9 }}>
      <View testID={`row-weight-record-${record.id}`} style={{ gap: 8 }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: c.foreground }}>{record.date}</Text>
          <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.primary }}>{record.weightKg.toFixed(1)} kg</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small variant="ghost" icon="edit-2" label="Edit" testID={`button-edit-weight-${record.id}`} disabled={saveBusy || remove.isPending} onPress={() => beginEdit(record)} />
          <Btn small variant="danger" icon="trash-2" label="Delete" testID={`button-delete-weight-${record.id}`} disabled={saveBusy || remove.isPending} onPress={() => { setConfirmDeleteId(record.id); setDeleteError(null); }} />
        </View>
        {confirmDeleteId === record.id ? <View testID={`panel-confirm-delete-weight-${record.id}`} accessibilityRole="alert" style={{ gap: 8 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: c.destructive }}>Delete the {record.date} weigh-in? You can undo this for {WEIGHT_RECORD_UNDO_WINDOW_MS / 1000} seconds.</Text>
          {deleteError ? <Text testID="weight-delete-error" style={{ fontFamily: F.medium, fontSize: 13, color: c.destructive }}>{deleteError}</Text> : null}
          <Btn small variant="danger" icon="trash-2" label="Confirm delete" testID={`button-confirm-delete-weight-${record.id}`} loading={remove.isPending} onPress={() => void deleteMeasurement(record)} />
          <Btn small variant="ghost" label="Keep weigh-in" testID={`button-cancel-delete-weight-${record.id}`} disabled={remove.isPending} onPress={() => setConfirmDeleteId(null)} />
        </View> : null}
      </View>
    </Card>)}
  </Screen>;
}

export default function WeightRoute() {
  const { person } = usePlanner();
  return <WeightTracker key={person.id} />;
}
