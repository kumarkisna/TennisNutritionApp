import { useEffect, useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { useSaveHydrationLog } from '@/lib/local-api';
import type { DayActivity, HydrationEntry, HydrationSession } from '@/lib/local-models';
import { estimateSessionSweatRate, hydrationReference, hydrationTotals, MAX_HYDRATION_ENTRIES, MAX_HYDRATION_SESSIONS } from '@/lib/hydration';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Eyebrow, F, Field, Muted } from '@/components/ui';

type Props = { personId: number; date: string; personName: string; dateOfBirth: string | null; sex: 'male' | 'female' | null; day?: DayActivity };
type EntryDraft = { id: string; time: string; planned: string; actual: string; alert: boolean };
type SessionDraft = { id: string; activity: string; minutes: string; pre: string; post: string; fluid: string; urine: string };
const blank = () => ({ entries: [] as EntryDraft[], sessions: [] as SessionDraft[] });

export function HydrationCard({ personId, date, personName, dateOfBirth, sex, day }: Props) {
  const c = useColors();
  const save = useSaveHydrationLog();
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => setDraft({
    entries: (day?.hydration?.entries ?? []).map(e => ({ id: e.id, time: e.time, planned: String(e.plannedMl), actual: e.actualMl === null ? '' : String(e.actualMl), alert: e.alertEnabled })),
    sessions: (day?.hydration?.sessions ?? []).map(s => ({ id: s.id, activity: s.activity, minutes: String(s.durationMinutes), pre: String(s.preWeightKg), post: String(s.postWeightKg), fluid: String(s.fluidMl), urine: String(s.urineMl) })),
  }), [day?.hydration, personId, date]);
  const updateEntry = (id: string, key: keyof EntryDraft, value: string | boolean) => setDraft(v => ({ ...v, entries: v.entries.map(e => e.id === id ? { ...e, [key]: value } : e) }));
  const updateSession = (id: string, key: keyof SessionDraft, value: string) => setDraft(v => ({ ...v, sessions: v.sessions.map(s => s.id === id ? { ...s, [key]: value } : s) }));
  const reference = hydrationReference(dateOfBirth, sex, date);
  const current = day?.hydration;
  const total = hydrationTotals(current);
  async function persist() {
    setError(''); setNotice('');
    try {
      const entries: HydrationEntry[] = draft.entries.map(e => ({ id: e.id, time: e.time, plannedMl: Number(e.planned), actualMl: e.actual.trim() ? Number(e.actual) : null, alertEnabled: e.alert }));
      const sessions: HydrationSession[] = draft.sessions.map(s => ({ id: s.id, activity: s.activity.trim(), durationMinutes: Number(s.minutes), preWeightKg: Number(s.pre), postWeightKg: Number(s.post), fluidMl: Number(s.fluid), urineMl: Number(s.urine) }));
      await save.mutateAsync({ data: { personId, date, hydration: { entries, sessions } } });
      setNotice('Hydration plan saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save hydration data.'); }
  }
  const input = (label: string, value: string, onChangeText: (value: string) => void, placeholder: string, testID: string, numeric = false) =>
    <Field label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} testID={testID} keyboardType={numeric ? 'decimal-pad' : 'numbers-and-punctuation'} />;
  return <Card>
    <Eyebrow>Hydration · {personName} · {date}</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>Hydration plan & log</Text>
    {reference ? <Muted>Daily reference: {reference.totalLiters[0] === reference.totalLiters[1] ? `${reference.totalLiters[0]} L` : `${reference.totalLiters[0]}–${reference.totalLiters[1]} L`} total water; about {reference.beverageLiters[0] === reference.beverageLiters[1] ? `${reference.beverageLiters[0]} L` : `${reference.beverageLiters[0]}–${reference.beverageLiters[1]} L`} from beverages in the source survey. Food counts too; this is a population reference, not a personal target.</Muted> : <Muted>Add a date of birth in Settings for an age-based daily water reference.</Muted>}
    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.nationalacademies.org/read/10925/chapter/2')} style={{ color: c.primary, fontFamily: F.medium, fontSize: 12 }}>Source: National Academies water reference (2005)</Text>
    <Muted>{day && ((day.tennis?.sessions.length ?? 0) > 0 || day.activityType !== 'rest') ? 'Activity is logged today. Exercise may change fluid needs, but duration alone cannot determine a safe extra daily amount.' : 'Drink to thirst and adjust to conditions; avoid forcing a fixed volume.'}</Muted>
    <Text style={{ fontFamily: F.semi, color: c.foreground }}>Planned drinks</Text>
    {draft.entries.map((e, i) => <View key={e.id} style={{ gap: 6, borderTopWidth: 1, borderColor: c.border, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>{input('Time', e.time, v => updateEntry(e.id, 'time', v), '12:00', `input-hydration-time-${i}`)}{input('Planned mL', e.planned, v => updateEntry(e.id, 'planned', v), '250', `input-hydration-planned-${i}`, true)}</View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{input('Actual mL (optional)', e.actual, v => updateEntry(e.id, 'actual', v), 'Not logged', `input-hydration-actual-${i}`, true)}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: c.foreground, fontFamily: F.medium }}>Alert</Text><Switch value={e.alert} onValueChange={v => updateEntry(e.id, 'alert', v)} testID={`switch-hydration-alert-${i}`} /></View></View>
      <Btn small variant="ghost" icon="trash-2" label="Remove drink" testID={`button-remove-hydration-${i}`} onPress={() => setDraft(v => ({ ...v, entries: v.entries.filter(x => x.id !== e.id) }))} />
    </View>)}
    <Btn small variant="ghost" icon="plus" label="Add planned drink" testID="button-add-hydration" disabled={draft.entries.length >= MAX_HYDRATION_ENTRIES} onPress={() => setDraft(v => ({ ...v, entries: [...v.entries, { id: `hydration-${Date.now().toString(36)}-${v.entries.length}`, time: '', planned: '', actual: '', alert: false }] }))} />
    {current ? <Muted>Saved for this date: {total.plannedMl} mL planned · {total.actualMl} mL recorded.</Muted> : null}
    <Text style={{ fontFamily: F.semi, color: c.foreground }}>Optional session sweat estimates</Text>
    <Muted>Enter weights immediately before and after the session, fluid consumed and urine output. This estimates sweat loss per hour, not a daily drink target.</Muted>
    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.cdc.gov/nceh/hsb/extreme/Heat_Illness/Sweat%20Rate%20Calculation.pdf')} style={{ color: c.primary, fontFamily: F.medium, fontSize: 12 }}>Source: CDC sweat-rate calculation</Text>
    {draft.sessions.map((s, i) => <View key={s.id} style={{ gap: 6, borderTopWidth: 1, borderColor: c.border, paddingTop: 8 }}>
      {input('Activity', s.activity, v => updateSession(s.id, 'activity', v), 'Tennis practice', `input-hydration-activity-${i}`)}
      <View style={{ flexDirection: 'row', gap: 6 }}>{input('Minutes', s.minutes, v => updateSession(s.id, 'minutes', v), '60', `input-hydration-duration-${i}`, true)}{input('Before kg', s.pre, v => updateSession(s.id, 'pre', v), '50', `input-hydration-pre-${i}`, true)}{input('After kg', s.post, v => updateSession(s.id, 'post', v), '49.5', `input-hydration-post-${i}`, true)}</View>
      <View style={{ flexDirection: 'row', gap: 6 }}>{input('Fluid mL', s.fluid, v => updateSession(s.id, 'fluid', v), '500', `input-hydration-fluid-${i}`, true)}{input('Urine mL', s.urine, v => updateSession(s.id, 'urine', v), '0', `input-hydration-urine-${i}`, true)}</View>
      {(() => { const complete = [s.minutes, s.pre, s.post, s.fluid, s.urine].every(v => v.trim() !== ''); const rate = complete ? estimateSessionSweatRate({ durationMinutes: Number(s.minutes), preWeightKg: Number(s.pre), postWeightKg: Number(s.post), fluidMl: Number(s.fluid), urineMl: Number(s.urine) }) : null; return rate === null || !Number.isFinite(rate) ? null : rate <= 0 ? <Muted>Measurements show no net fluid loss; check them. This is not a drink target.</Muted> : <Muted>Estimated sweat rate: {rate.toFixed(2)} L/hour. Approximate session estimate only.</Muted>; })()}
      <Btn small variant="ghost" icon="trash-2" label="Remove estimate" testID={`button-remove-hydration-session-${i}`} onPress={() => setDraft(v => ({ ...v, sessions: v.sessions.filter(x => x.id !== s.id) }))} />
    </View>)}
    <Btn small variant="ghost" icon="plus" label="Add session estimate" testID="button-add-hydration-session" disabled={draft.sessions.length >= MAX_HYDRATION_SESSIONS} onPress={() => setDraft(v => ({ ...v, sessions: [...v.sessions, { id: `hydration-session-${Date.now().toString(36)}-${v.sessions.length}`, activity: '', minutes: '', pre: '', post: '', fluid: '0', urine: '0' }] }))} />
    {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text> : null}
    {notice ? <Muted>{notice}</Muted> : null}
    <Btn label="Save hydration plan" icon="check" testID="button-save-hydration" disabled={save.isPending} loading={save.isPending} onPress={() => void persist()} />
  </Card>;
}
