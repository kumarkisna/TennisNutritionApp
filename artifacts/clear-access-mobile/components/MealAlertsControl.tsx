import { useRef, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSaveMealAlerts, type Meal, type MealAlert } from '@/lib/local-api';
import { getMealAlerts, MAX_MEAL_ALERTS } from '@/lib/meal-reminders';
import { useMealReminders } from '@/contexts/MealReminderProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, F, Muted, warn } from '@/components/ui';

type Props = { meal: Meal; personId: number; date: string; mealTime: string; alerts?: MealAlert[]; loading?: boolean; error?: boolean; showDetails?: boolean };

const newId = () => `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function when(date: string, mealTime: string, minutes: number) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = mealTime.split(':').map(Number);
  const at = new Date(y, m - 1, d, h, mi);
  at.setTime(at.getTime() - minutes * 60_000);
  const pad = (v: number) => String(v).padStart(2, '0');
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${pad(at.getHours())}:${pad(at.getMinutes())}${day !== date ? ` on ${day}` : ''}`;
}
const valid = (v: string) => /^\d{1,3}$/.test(v.trim()) && Number(v) <= 180;

function Inner({ meal, personId, date, mealTime, alerts, loading, error, showDetails = true }: Props) {
  const c = useColors();
  const master = useMealReminders();
  const save = useSaveMealAlerts();
  const latest = useRef(alerts);
  latest.current = alerts;
  const [edit, setEdit] = useState<{ id: string; value: string; isNew?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const list = getMealAlerts(alerts);
  const off = loading || error || save.isPending;

  async function persist(next: MealAlert[]) {
    setProblem(null);
    try {
      await save.mutateAsync({ data: { personId, date, meal, alerts: next } });
      return true;
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save alerts. Your entry is kept.'); warn();
      return false;
    }
  }
  const base = () => getMealAlerts(latest.current);
  const toggle = (id: string, enabled: boolean) => void persist(base().map(a => a.id === id ? { ...a, enabled } : a));
  async function commit() {
    if (!edit) return;
    if (!valid(edit.value)) { setProblem('Enter a whole number from 0 to 180.'); warn(); return; }
    const minutesBefore = Number(edit.value);
    const cur = base();
    const next = edit.isNew ? [...cur, { id: edit.id, minutesBefore, enabled: true }]
      : cur.map(a => a.id === edit.id ? { ...a, minutesBefore } : a);
    if (await persist(next)) setEdit(null);
  }
  async function remove(id: string) {
    if (await persist(base().filter(a => a.id !== id))) setConfirm(null);
  }

  return <View testID={`alerts-${meal}`} style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name="bell" size={15} color={c.primary} />
      <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.foreground, flex: 1 }}>Optional alerts</Text>
    </View>
    {!master.enabled ? <Text testID={`status-alerts-paused-${meal}`} style={{ fontFamily: F.semi, fontSize: 12, color: c.mutedForeground }}>Paused: meal and hydration alerts are off in Settings. Your choices below are kept.</Text> : null}
    {master.enabled && !master.supported ? <Muted>Saved here; delivery requires the iPhone or Android app.</Muted> : null}
    {master.enabled && master.supported && (!master.allowed || master.error) ? <Muted>Device alerts need attention. Check Meal alerts in Settings.</Muted> : null}
    {loading ? <Muted>Loading alerts...</Muted> : error ? <Muted>Alerts unavailable.</Muted> : null}
    {list.map((a, i) => {
      const editing = edit?.id === a.id && !edit.isNew;
      return <View key={a.id} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch testID={`switch-alert-${meal}-${i}`} accessibilityLabel={`${meal} alert ${i + 1}`} value={a.enabled} disabled={off}
            onValueChange={v => toggle(a.id, v)} trackColor={{ true: c.primary, false: c.border }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: c.foreground }}>{a.minutesBefore === 0 ? 'At mealtime' : `${a.minutesBefore} min before`} · {when(date, mealTime, a.minutesBefore)}</Text>
          </View>
          <Btn small variant="ghost" label="Edit" testID={`button-edit-alert-${meal}-${i}`} disabled={off} onPress={() => { setProblem(null); setConfirm(null); setEdit({ id: a.id, value: String(a.minutesBefore) }); }} />
          <Btn small variant="ghost" label="Remove" testID={`button-remove-alert-${meal}-${i}`} disabled={off} onPress={() => { setEdit(null); setConfirm(a.id); }} />
        </View>
        {confirm === a.id ? <View style={{ gap: 6 }}>
          <Muted>Remove this alert? Foods in this meal are not affected.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn small variant="danger" label="Remove alert" testID={`button-confirm-remove-alert-${meal}-${i}`} disabled={off} onPress={() => void remove(a.id)} />
            <Btn small variant="ghost" label="Keep" testID={`button-cancel-remove-alert-${meal}-${i}`} disabled={off} onPress={() => setConfirm(null)} />
          </View>
        </View> : null}
        {editing ? <MinutesEditor meal={meal} value={edit!.value} onChange={v => setEdit({ ...edit!, value: v })} off={off} onSave={() => void commit()} onCancel={() => { setEdit(null); setProblem(null); }} /> : null}
      </View>;
    })}
    {edit?.isNew ? <MinutesEditor meal={meal} value={edit.value} onChange={v => setEdit({ ...edit, value: v })} off={off} onSave={() => void commit()} onCancel={() => { setEdit(null); setProblem(null); }} /> : null}
    {problem ? <Text accessibilityRole="alert" testID={`error-alerts-${meal}`} style={{ fontFamily: F.medium, fontSize: 12.5, color: c.destructive }}>{problem}</Text> : null}
    {!edit && list.length < MAX_MEAL_ALERTS ? <View style={{ alignSelf: 'flex-start' }}>
      <Btn small variant="ghost" icon="plus" label="Add alert" testID={`button-add-alert-${meal}`} disabled={off} onPress={() => { setProblem(null); setConfirm(null); setEdit({ id: newId(), value: '10', isNew: true }); }} />
    </View> : null}
    {list.length >= MAX_MEAL_ALERTS ? <Muted>Maximum of {MAX_MEAL_ALERTS} alerts per meal.</Muted> : null}
    {showDetails ? <Muted>Alerts follow the meal time, so they move when you change it.</Muted> : null}
  </View>;
}

function MinutesEditor({ meal, value, onChange, off, onSave, onCancel }: { meal: Meal; value: string; onChange: (v: string) => void; off?: boolean; onSave: () => void; onCancel: () => void }) {
  const c = useColors();
  return <View style={{ gap: 8 }}>
    <TextInput testID={`input-alert-minutes-${meal}`} value={value} editable={!off} onChangeText={onChange} keyboardType="number-pad" maxLength={3}
      accessibilityLabel={`${meal} alert minutes before, 0 to 180`} selectionColor={c.primary} keyboardAppearance={c.isDark ? 'dark' : 'light'}
      style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: valid(value) ? c.input : c.destructiveBorder, backgroundColor: c.card, paddingHorizontal: 14, fontFamily: F.bold, fontSize: 15, color: c.foreground }} />
    <Muted>Minutes before the meal, 0 to 180 (0 is at mealtime).</Muted>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Btn small icon="check" label="Save" testID={`button-save-alert-${meal}`} disabled={off} loading={off} onPress={onSave} />
      <Btn small variant="ghost" label="Cancel" testID={`button-cancel-alert-${meal}`} disabled={off} onPress={onCancel} />
    </View>
  </View>;
}

export function MealAlertsControl(props: Props) {
  return <Inner key={`${props.personId}-${props.date}-${props.meal}`} {...props} />;
}
