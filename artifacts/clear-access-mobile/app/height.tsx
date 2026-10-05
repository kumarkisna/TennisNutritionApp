import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import {
  getListHeightRecordsQueryKey,
  useCreateHeightRecord,
  useDeleteHeightRecord,
  useListHeightRecords,
  useUpdateHeightRecord,
  useUpdatePerson,
  type HeightRecord,
  type Person,
} from '@/lib/local-api';
import { ageInCalendarMonths, assessCdcEligibility, CDC_EXCLUSION_LABELS, CDC_SOURCE_INFO_URL, CDC_SOURCE_URL, isValidGrowthDate, type CdcExclusionReason } from '@/lib/growth';
import { today } from '@/lib/format';
import { Btn, Card, Chips, Eyebrow, F, Field, Muted, Screen, SectionTitle, Title, success, warn } from '@/components/ui';
import { useColors as useTheme } from '@/hooks/useColors';
import HeightChart from '@/components/HeightChart';

type ChartMode = 'cdc' | 'history';
type SexChoice = 'male' | 'female' | 'none';

function modeForDefault(person: Person, records: HeightRecord[], todayDate: string): ChartMode {
  if (!person.dateOfBirth || !person.growthReferenceSex) return 'history';
  if (records.length === 0) return 'cdc';
  const hasEligible = records.some(record => assessCdcEligibility(
    record,
    person.dateOfBirth,
    person.growthReferenceSex,
    todayDate,
  ).eligible);
  return hasEligible ? 'cdc' : 'history';
}

function displayAge(dateOfBirth: string | null, date: string) {
  if (!dateOfBirth) return 'Age unavailable';
  const months = ageInCalendarMonths(dateOfBirth, date);
  if (months === null) return 'Age unavailable';
  const completedMonths = Math.floor(months + 1e-8);
  return `${Math.floor(completedMonths / 12)} yr ${completedMonths % 12} mo`;
}

function HeightTracker({ person, plannerDate, refreshPeople }: {
  person: Person;
  plannerDate: string;
  refreshPeople: () => void;
}) {
  const c = useColors();
  const personId = person.id;
  const currentDate = today();
  const recordsQuery = useListHeightRecords(
    { personId },
    { query: { enabled: true, queryKey: getListHeightRecordsQueryKey({ personId }) } },
  );
  const create = useCreateHeightRecord();
  const update = useUpdateHeightRecord();
  const remove = useDeleteHeightRecord();
  const savePerson = useUpdatePerson();
  const records = recordsQuery.data ?? [];
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [records],
  );

  const [dateText, setDateText] = useState(plannerDate);
  const [heightText, setHeightText] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [dateOfBirthText, setDateOfBirthText] = useState(person.dateOfBirth ?? '');
  const [sexChoice, setSexChoice] = useState<SexChoice>(person.growthReferenceSex ?? 'none');
  const [chartModeChoice, setChartModeChoice] = useState<ChartMode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const mode = chartModeChoice ?? modeForDefault(person, records, currentDate);
  const profileBusy = savePerson.isPending;
  const saveBusy = create.isPending || update.isPending;
  const profileSex = sexChoice === 'none' ? null : sexChoice;
  const profileBirthDate = dateOfBirthText.trim() || null;

  function resetMeasurementForm() {
    setEditingRecordId(null);
    setDateText(plannerDate);
    setHeightText('');
    setFormError(null);
  }

  async function saveProfile() {
    setProfileError(null);
    setSuccessMessage(null);
    if (profileBirthDate && (!isValidGrowthDate(profileBirthDate) || profileBirthDate > currentDate)) {
      setProfileError('Enter a valid date of birth that is not in the future, or clear it.');
      return;
    }
    try {
      await savePerson.mutateAsync({
        id: personId,
        data: { dateOfBirth: profileBirthDate, growthReferenceSex: profileSex },
      });
      refreshPeople();
      success();
      setSuccessMessage(`Growth profile saved for ${person.name}.`);
    } catch (error) {
      warn();
      setProfileError(error instanceof Error ? error.message : 'The growth profile could not be saved. Try again.');
    }
  }

  function beginEdit(record: HeightRecord) {
    setEditingRecordId(record.id);
    setDateText(record.date);
    setHeightText(String(record.heightCm));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function saveMeasurement() {
    setFormError(null);
    setSuccessMessage(null);
    if (!isValidGrowthDate(dateText)) {
      setFormError('Enter a real date in YYYY-MM-DD format.');
      return;
    }
    if (dateText > currentDate) {
      setFormError('A height observation cannot be dated in the future.');
      return;
    }
    if (person.dateOfBirth && dateText < person.dateOfBirth) {
      setFormError('The observation date cannot be before the saved date of birth.');
      return;
    }
    const heightCm = Number(heightText.trim());
    if (!heightText.trim() || !Number.isFinite(heightCm) || heightCm < 20 || heightCm > 300) {
      setFormError('Enter a finite height from 20 to 300 cm.');
      return;
    }
    const duplicate = records.find(record =>
      record.date === dateText && record.id !== editingRecordId,
    );
    if (duplicate) {
      setFormError('A height is already saved for this person and date. Edit that measurement instead.');
      return;
    }
    try {
      if (editingRecordId === null) {
        const saved = await create.mutateAsync({ data: { personId, date: dateText, heightCm } });
        setSuccessMessage(`Height saved for ${saved.date}.`);
      } else {
        const saved = await update.mutateAsync({
          id: editingRecordId,
          data: { date: dateText, heightCm },
        });
        setSuccessMessage(`Height updated for ${saved.date}.`);
      }
      success();
      resetMeasurementForm();
    } catch (error) {
      warn();
      setFormError(error instanceof Error ? error.message : 'The height could not be saved. Try again.');
    }
  }

  async function deleteMeasurement(record: HeightRecord) {
    setDeleteError(null);
    try {
      await remove.mutateAsync({ id: record.id });
      setConfirmDeleteId(null);
      if (editingRecordId === record.id) resetMeasurementForm();
      success();
      setSuccessMessage(`Height from ${record.date} deleted.`);
    } catch (error) {
      warn();
      setDeleteError(error instanceof Error ? error.message : 'The height could not be deleted. Try again.');
    }
  }

  const exclusionCounts = useMemo(() => {
    const counts = new Map<CdcExclusionReason, number>();
    for (const record of records) {
      const assessment = assessCdcEligibility(
        record,
        person.dateOfBirth,
        person.growthReferenceSex,
        currentDate,
      );
      if (!assessment.eligible) counts.set(assessment.reason, (counts.get(assessment.reason) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [records, person.dateOfBirth, person.growthReferenceSex, currentDate]);

  const sexOptions = [
    { value: 'none' as const, label: 'Not set' },
    { value: 'male' as const, label: 'Boys (male)' },
    { value: 'female' as const, label: 'Girls (female)' },
  ];

  return <Screen title="Height tracker">
    <Eyebrow>Private on this device</Eyebrow>
    <Title sub={`Record growth for ${person.name}. Measurements are saved only in this device's local planner.`}>Height tracker</Title>

    <Card tone="mint">
      <SectionTitle kicker="Growth profile">Optional CDC comparison details</SectionTitle>
      <Muted>Date of birth determines age automatically and supports calendar-age growth comparisons for the selected planner day. Neither birth date nor CDC reference sex is inferred from another profile field.</Muted>
      <Field
        label="Date of birth"
        hint="Use YYYY-MM-DD. Age and growth comparisons use this date; age is calculated automatically."
        value={dateOfBirthText}
        onChangeText={value => { setDateOfBirthText(value); setProfileError(null); }}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!profileBusy && !saveBusy && !remove.isPending}
        testID="input-height-date-of-birth"
        accessibilityLabel="Date of birth"
      />
      {dateOfBirthText ? <Btn small variant="ghost" icon="x" label="Clear date of birth" testID="button-clear-height-date-of-birth" disabled={profileBusy || saveBusy || remove.isPending} onPress={() => { setDateOfBirthText(''); setProfileError(null); }} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>CDC reference sex · choose explicitly</Text>
      <Chips
        options={sexOptions}
        value={sexChoice}
        onChange={value => { setSexChoice(value); setProfileError(null); }}
        testPrefix="height-reference-sex"
        disabled={profileBusy || saveBusy || remove.isPending}
      />
      <Muted>This demographic reference choice selects the CDC Boys or Girls chart; it does not describe or infer a child's identity.</Muted>
      {profileError ? <Text testID="height-profile-error" accessibilityRole="alert" style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>{profileError}</Text> : null}
      <Btn
        icon="save"
        label="Save growth profile"
        testID="button-save-height-profile"
        loading={profileBusy}
        disabled={saveBusy || remove.isPending}
        onPress={() => void saveProfile()}
      />
    </Card>

    <Card>
      <SectionTitle kicker="Observation">Add or edit a height</SectionTitle>
      <Muted>Use the date the measurement was taken. One measurement per person per date; edit the existing entry if needed.</Muted>
      <Field
        label="Observation date"
        hint="Selected planner date is the starting value. Enter YYYY-MM-DD."
        value={dateText}
        onChangeText={value => { setDateText(value); setFormError(null); }}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!saveBusy && !profileBusy && !remove.isPending}
        testID="input-height-observation-date"
        accessibilityLabel="Height observation date"
      />
      <Field
        label="Height (cm)"
        hint="Enter a measurement from 20 to 300 cm."
        value={heightText}
        onChangeText={value => { setHeightText(value); setFormError(null); }}
        placeholder="e.g. 112.5"
        keyboardType="decimal-pad"
        editable={!saveBusy && !profileBusy && !remove.isPending}
        testID="input-height-centimeters"
        accessibilityLabel="Height in centimeters"
      />
      {formError ? <Text testID="height-save-error" accessibilityRole="alert" style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>{formError}</Text> : null}
      <Btn
        icon={editingRecordId === null ? 'plus' : 'save'}
        label={editingRecordId === null ? 'Save height' : 'Update height'}
        testID="button-save-height-record"
        loading={saveBusy}
        disabled={profileBusy || remove.isPending}
        onPress={() => void saveMeasurement()}
      />
      {editingRecordId !== null ? <Btn variant="ghost" label="Cancel edit" testID="button-cancel-height-edit" disabled={saveBusy || profileBusy || remove.isPending} onPress={resetMeasurementForm} /> : null}
    </Card>

    {successMessage ? <Text testID="height-success" accessibilityLiveRegion="polite" style={{ fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: c.primary }}>{successMessage}</Text> : null}

    <Card>
      <SectionTitle kicker="Chart">Height over time</SectionTitle>
      <Muted>Switch between every saved measurement and the CDC reference comparison. Reference curves are official source values; dots are your saved measurements.</Muted>
      <Chips
        options={[
          { value: 'cdc' as const, label: 'CDC comparison' },
          { value: 'history' as const, label: 'All-height history' },
        ]}
        value={mode}
        onChange={setChartModeChoice}
        testPrefix="height-chart-mode"
      />
      {recordsQuery.isLoading ? <View testID="status-height-loading" accessibilityLiveRegion="polite"><Muted>Loading saved heights…</Muted></View> : null}
      {recordsQuery.isError ? <View testID="height-records-error" accessibilityRole="alert" style={{ gap: 8 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: c.destructive }}>Saved heights could not be loaded. {recordsQuery.error.message}</Text>
        <Btn small variant="ghost" icon="refresh-cw" label="Retry loading heights" testID="button-retry-height-records" onPress={() => void recordsQuery.refetch()} />
      </View> : null}
      {mode === 'cdc' ? <HeightChart mode="cdc" records={records} person={person} today={currentDate} /> : <HeightChart mode="history" records={records} person={person} today={currentDate} />}
      {mode === 'cdc' ? <View testID="height-cdc-exclusions" accessibilityLiveRegion="polite" style={{ gap: 4 }}>
        <Muted>{records.length - exclusionCounts.reduce((sum, [, count]) => sum + count, 0)} of {records.length} saved measurements shown in CDC comparison; {exclusionCounts.reduce((sum, [, count]) => sum + count, 0)} excluded.</Muted>
        {exclusionCounts.map(([reason, count]) => <Muted key={reason}>{count} excluded: {CDC_EXCLUSION_LABELS[reason]}.</Muted>)}
        {records.length === 0 ? <Muted>The CDC curves are shown without any saved measurements yet.</Muted> : null}
      </View> : null}
      {records.length === 0 && !recordsQuery.isLoading && !recordsQuery.isError ? <View testID="status-height-empty" style={{ paddingTop: 4 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>No saved heights yet</Text>
        <Muted>Your chart and dated history will use only measurements you save here.</Muted>
      </View> : null}
    </Card>

    <SectionTitle kicker="Saved locally">Every saved measurement</SectionTitle>
    {recordsQuery.isLoading ? <View testID="status-height-list-loading"><Muted>Loading measurement history…</Muted></View> : null}
    {!recordsQuery.isLoading && !recordsQuery.isError && sortedRecords.length === 0 ? <Card>
      <Muted>No measurements have been saved for {person.name}.</Muted>
    </Card> : null}
    {sortedRecords.map(record => {
      const assessment = assessCdcEligibility(
        record,
        person.dateOfBirth,
        person.growthReferenceSex,
        currentDate,
      );
      const percentile = assessment.eligible && assessment.percentile !== null
        ? ` · approx. CDC percentile ${assessment.percentile.toFixed(0)}`
        : '';
      const ageLabel = displayAge(person.dateOfBirth, record.date);
      return <Card key={record.id} style={{ gap: 9 }}>
        <View testID={`row-height-record-${record.id}`}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: c.foreground }}>{record.date}</Text>
          <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.primary }}>{record.heightCm} cm · {ageLabel}{percentile}</Text>
          {!assessment.eligible ? <Muted>CDC comparison unavailable: {CDC_EXCLUSION_LABELS[assessment.reason]}.</Muted> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small variant="ghost" icon="edit-2" label="Edit" testID={`button-edit-height-${record.id}`} disabled={saveBusy || profileBusy || remove.isPending} onPress={() => beginEdit(record)} />
          <Btn small variant="danger" icon="trash-2" label="Delete" testID={`button-delete-height-${record.id}`} disabled={saveBusy || profileBusy || remove.isPending} onPress={() => { setConfirmDeleteId(record.id); setDeleteError(null); }} />
        </View>
        {confirmDeleteId === record.id ? <View testID={`panel-confirm-delete-height-${record.id}`} accessibilityRole="alert" style={{ gap: 8 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: c.destructive }}>Delete the {record.date} height measurement? This cannot be undone.</Text>
          {deleteError ? <Text testID="height-delete-error" style={{ fontFamily: F.medium, fontSize: 13, color: c.destructive }}>{deleteError}</Text> : null}
          <Btn small variant="danger" icon="trash-2" label="Confirm delete" testID={`button-confirm-delete-height-${record.id}`} loading={remove.isPending} onPress={() => void deleteMeasurement(record)} />
          <Btn small variant="ghost" label="Keep measurement" testID={`button-cancel-delete-height-${record.id}`} disabled={remove.isPending} onPress={() => setConfirmDeleteId(null)} />
        </View> : null}
        </View>
      </Card>;
    })}

    <Card tone="mint">
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>How to read this comparison</Text>
      <Muted>CDC stature-for-age references are selected by the explicitly chosen Boys or Girls demographic reference and the child's actual date of birth. Ages are calculated from calendar dates; approximate percentiles use CDC monthly LMS values. CDC standing-height charts cover ages 2 through 20 only and do not apply under age 2. A percentile or chart band is not a health judgment, goal, or diagnosis; discuss growth concerns with a qualified clinician.</Muted>
      <SourceLink label="CDC growth chart data files" url={CDC_SOURCE_INFO_URL} />
      <SourceLink label="CDC stature-for-age source CSV" url={CDC_SOURCE_URL} />
      <Muted>The CDC dataset is bundled with this app; charting works offline.</Muted>
    </Card>
  </Screen>;
}

function SourceLink({ label, url }: { label: string; url: string }) {
  const c = useTheme();
  return <Pressable accessibilityRole="link" accessibilityLabel={`Open ${label}`} onPress={() => {
    void Linking.openURL(url).catch(() => Alert.alert('Source unavailable', 'The CDC source link could not be opened. The chart data remains available offline.'));
  }} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
    <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.primary, textDecorationLine: 'underline' }}>{label}</Text>
  </Pressable>;
}

export default function HeightRoute() {
  const { person, date, refreshPeople } = usePlanner();
  return <HeightTracker key={person.id} person={person} plannerDate={date} refreshPeople={refreshPeople} />;
}