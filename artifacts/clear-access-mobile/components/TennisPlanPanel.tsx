import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGetDayActivity, useSaveTennisPlan, useSaveTennisPlanRating, type Person, type TennisPlan, type TennisSession } from '@/lib/local-api';
import { emptyTennisPlan, fuelLabels, tennisFuelWindows, tennisPlanProblem, tennisActivityPlanProblem, TENNIS_SOURCE_URL } from '@/lib/tennis-planning';
import { useColors } from '@/hooks/useColors';
import { getAgeOnDate } from '@/lib/planning-targets';
import { TennisFoodPlanCopy } from '@/components/TennisFoodPlanCopy';
import { TennisDietSchedule } from '@/components/TennisDietSchedule';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, success, tap, warn } from '@/components/ui';

type DraftSession = { kind: TennisSession['kind']; startTime: string; duration: string; intensity: TennisSession['intensity'] };
type Draft = { mode: TennisPlan['mode']; sessions: DraftSession[]; fuel: TennisPlan['fuel'] };

const modeOptions: { value: TennisPlan['mode']; label: string }[] = [
  { value: 'training', label: 'Training' }, { value: 'tournament', label: 'Tournament' }, { value: 'rest', label: 'Rest' },
];
const intensityOptions: { value: TennisSession['intensity']; label: string }[] = [
  { value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' },
];
const kindOptions = (mode: TennisPlan['mode']): { value: TennisSession['kind']; label: string }[] =>
  mode === 'tournament' ? [{ value: 'match', label: 'Match' }] : [{ value: 'practice', label: 'Practice' }, { value: 'gym', label: 'Gym' }];
const defaultKind = (mode: TennisPlan['mode']): TennisSession['kind'] => (mode === 'tournament' ? 'match' : 'practice');
const phases = Object.keys(fuelLabels) as (keyof TennisPlan['fuel'])[];

const toDraft = (plan: TennisPlan): Draft => ({
  mode: plan.mode, fuel: { ...plan.fuel },
  sessions: plan.sessions.map(s => ({ kind: s.kind, startTime: s.startTime, duration: String(s.durationMinutes), intensity: s.intensity })),
});

function buildPlan(d: Draft): { plan: TennisPlan | null; problem: string | null } {
  const sessions: TennisSession[] = [];
  if (d.mode !== 'rest') {
    for (const s of d.sessions) {
      const t = s.duration.trim();
      if (!/^\d+$/.test(t)) return { plan: null, problem: 'Each expected duration must be 1–480 whole minutes.' };
      sessions.push({ kind: s.kind, startTime: s.startTime.trim(), durationMinutes: Number(t), intensity: s.intensity });
    }
  }
  const plan: TennisPlan = { mode: d.mode, sessions, fuel: d.fuel };
  const problem = tennisPlanProblem(plan);
  return { plan: problem ? null : plan, problem };
}

export function TennisPlanPanel({ person, date, showDetails = true }: { person: Person; date: string; showDetails?: boolean }) {
  const c = useColors();
  const router = useRouter();
  const day = useGetDayActivity({ personId: person.id, date });
  const save = useSaveTennisPlan();
  const rate = useSaveTennisPlanRating();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [sourceError, setSourceError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<unknown>(null);
  const saving = save.isPending;
  const saved = day.data?.tennis;
  const savedActivityProblem = tennisActivityPlanProblem(day.data?.activityType ?? 'rest', saved);
  const age = person.dateOfBirth ? getAgeOnDate(person.dateOfBirth, date) : null;
  const young = age === null || age < 18;

  async function setRating(value: string) {
    setRatingError(null);
    try {
      await rate.mutateAsync({ data: { personId: person.id, date, rating: value === 'unrated' ? null : Number(value) } });
      success();
    } catch (e) { setRatingError(e); warn(); }
  }

  function open(plan: TennisPlan) { setDraft(toDraft(plan)); setProblem(null); setSaveError(null); setConfirmDelete(false); setNotice(null); }
  function patch(p: Partial<Draft>) { setDraft(d => (d ? { ...d, ...p } : d)); }
  function patchSession(i: number, p: Partial<DraftSession>) { setDraft(d => (d ? { ...d, sessions: d.sessions.map((s, k) => (k === i ? { ...s, ...p } : s)) } : d)); }
  function setMode(mode: TennisPlan['mode']) {
    setDraft(d => (d ? { ...d, mode, sessions: mode === 'rest' ? d.sessions : d.sessions.map(s => (kindOptions(mode).some(o => o.value === s.kind) ? s : { ...s, kind: defaultKind(mode) })) } : d));
  }

  async function commit(plan: TennisPlan | null, personId: number, planDate: string) {
    setSaveError(null);
    try {
      await save.mutateAsync({ data: { personId, date: planDate, plan } });
      success(); setDraft(null); setConfirmDelete(false); setProblem(null);
      setNotice(plan ? 'Tennis plan saved.' : 'Tennis plan removed.');
      return true;
    } catch (e) { warn(); setSaveError(e); return false; }
  }
  function submit() {
    if (!draft) return;
    const { plan, problem: p } = buildPlan(draft);
    if (!plan) { setProblem(p); warn(); return; }
    const activityProblem = tennisActivityPlanProblem(day.data?.activityType ?? 'rest', plan);
    if (activityProblem) { setProblem(activityProblem); warn(); return; }
    setProblem(null);
    void commit(plan, person.id, date);
  }

  const windows = saved ? tennisFuelWindows(saved) : [];
  const workload = saved ? saved.sessions.reduce((t, s) => t + s.durationMinutes, 0) : 0;
  const noteLabel = { fontFamily: F.bold, fontSize: 15, color: c.foreground } as const;

  const header = <View style={{ gap: 4 }}>
    <Eyebrow>Tennis plan</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 19, letterSpacing: -0.6, color: c.foreground }}>Court time and fuel timing</Text>
  </View>;
  const explain = showDetails ? <Muted>Tennis plans are timing notes for this person and date. Notes do not count toward day totals, and a tennis schedule does not change the daily target or activity reference. Add real foods as portions to track them.</Muted> : null;

  if (day.isLoading) return <Card>{header}<View testID="tennis-loading"><LoadingBlock rows={1} height={90} /></View></Card>;
  if (day.isError) return <Card>{header}<ErrorBox error={day.error} onRetry={() => day.refetch()} /></Card>;

  if (draft) {
    const kinds = kindOptions(draft.mode);
    return <Card>
      <View testID="tennis-editor" />
      {header}
      <Muted>Nothing is saved until you press Save plan.</Muted>
      <Text style={noteLabel}>Day type</Text>
      <Chips testPrefix="tennis-mode" value={draft.mode} onChange={setMode} options={modeOptions} disabled={saving} />
      {draft.mode === 'rest' ? <Muted>Saving a rest day clears any sessions below. Your notes are kept.</Muted> : <>
        {draft.sessions.map((s, i) => <View key={i} style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.secondary, borderRadius: 16, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: c.foreground }}>Session {i + 1}</Text>
            <Btn small variant="danger" icon="x" label="Remove" disabled={saving} testID={`button-remove-tennis-session-${i}`} onPress={() => setDraft(d => (d ? { ...d, sessions: d.sessions.filter((_, k) => k !== i) } : d))} />
          </View>
          <Chips testPrefix={`tennis-kind-${i}`} value={s.kind} onChange={v => patchSession(i, { kind: v })} options={kinds} disabled={saving} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Start (24h HH:MM)" value={s.startTime} onChangeText={v => patchSession(i, { startTime: v })} placeholder="09:00" maxLength={5} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!saving} testID={`input-tennis-start-${i}`} /></View>
            <View style={{ flex: 1 }}><Field label="Minutes" value={s.duration} onChangeText={v => patchSession(i, { duration: v })} placeholder="60" maxLength={3} keyboardType="number-pad" editable={!saving} testID={`input-tennis-duration-${i}`} /></View>
          </View>
          <Chips testPrefix={`tennis-intensity-${i}`} value={s.intensity} onChange={v => patchSession(i, { intensity: v })} options={intensityOptions} disabled={saving} />
        </View>)}
        <Btn variant="ghost" icon="plus" label={draft.sessions.length >= 12 ? 'Maximum 12 sessions' : draft.mode === 'tournament' ? 'Add match' : 'Add session'} disabled={saving || draft.sessions.length >= 12} testID="button-add-tennis-session"
          onPress={() => setDraft(d => (d ? { ...d, sessions: [...d.sessions, { kind: defaultKind(d.mode), startTime: '09:00', duration: '60', intensity: 'moderate' }] } : d))} />
      </>}
      <Text style={noteLabel}>Food and hydration notes</Text>
      <Muted>Your own reminders, up to 600 characters each. They are not nutrition entries.</Muted>
      {phases.map(k => <Field key={k} label={fuelLabels[k]} value={draft.fuel[k]} onChangeText={v => patch({ fuel: { ...draft.fuel, [k]: v } })} multiline maxLength={600} editable={!saving} testID={`input-tennis-note-${k}`} />)}
      {problem ? <ErrorBox error={new Error(problem)} /> : null}
      {saveError ? <ErrorBox error={saveError} /> : null}
      <Btn icon="check" label="Save plan" loading={saving} testID="button-save-tennis-plan" onPress={submit} />
      <Btn variant="ghost" label="Cancel" disabled={saving} testID="button-cancel-tennis-plan" onPress={() => { setDraft(null); setProblem(null); setSaveError(null); }} />
    </Card>;
  }

  return <Card>
    <View testID="tennis-panel" />
    {header}
    {notice ? <View accessibilityLiveRegion="polite" testID="status-tennis-saved" style={{ backgroundColor: c.accent, borderColor: c.accentBorder, borderWidth: 1, borderRadius: 12, padding: 10 }}><Text style={{ fontFamily: F.semi, fontSize: 13, color: c.accentForeground }}>{notice}</Text></View> : null}
    {!saved ? <>
      {showDetails ? <Muted>Plan practice, gym, matches or a rest day to see general timing ideas for fuel and fluids.</Muted> : null}
      <Btn icon="plus" label="Plan tennis day" testID="button-create-tennis-plan" onPress={() => open(emptyTennisPlan())} />
    </> : <>
      <Text testID="value-tennis-mode" style={{ fontFamily: F.bold, fontSize: 16, color: c.primary }}>{saved.mode === 'rest' ? 'Rest day' : saved.mode === 'tournament' ? 'Tournament day' : 'Training day'}</Text>
      {savedActivityProblem ? <View testID="tennis-activity-mismatch"><ErrorBox error={new Error(savedActivityProblem)} /></View> : null}
      {saved.mode !== 'rest' ? <Muted>Planned workload: <Text testID="value-tennis-workload" style={{ fontFamily: F.bold, color: c.foreground }}>{Math.floor(workload / 60)} h {workload % 60} min</Text> across {saved.sessions.length} {saved.sessions.length === 1 ? 'session' : 'sessions'}</Muted> : null}
      <View testID="tennis-experience-rating" style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
        <Eyebrow>Rate this day's plan</Eyebrow>
        {showDetails ? <Muted>Your experience of this whole plan on {date}. 0 is lowest; 10 is highest. You can change it later.</Muted> : null}
        <Chips
          testPrefix="tennis-experience-rating"
          value={saved.experienceRating === undefined ? 'unrated' : String(saved.experienceRating)}
          onChange={setRating}
          options={[
            { value: 'unrated', label: 'Not rated' },
            ...Array.from({ length: 11 }, (_, score) => ({ value: String(score), label: `${score}` })),
          ]}
          disabled={rate.isPending}
        />
        {saved.experienceRating !== undefined
          ? <Text testID="value-tennis-experience-rating" style={{ fontFamily: F.bold, fontSize: 13, color: c.primary }}>Experience rating: {saved.experienceRating}/10</Text>
          : null}
        {ratingError ? <ErrorBox error={ratingError} /> : null}
      </View>
      <TennisDietSchedule person={person} date={date} plan={saved} suggestions={windows} hydration={day.data?.hydration} showDetails={showDetails} />
      {windows.map((w, i) => <View key={i} testID={`row-tennis-window-${i}`} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 2 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: c.primary }}>{w.time}</Text>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{w.title}</Text>
        {showDetails ? <Muted>{w.detail}</Muted> : null}
      </View>)}
      {phases.some(k => saved.fuel[k]) ? <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 6 }}>
        <Eyebrow>Your notes</Eyebrow>
        {phases.filter(k => saved.fuel[k]).map(k => <View key={k} testID={`value-tennis-note-${k}`}><Text style={{ fontFamily: F.bold, fontSize: 12.5, color: c.foreground }}>{fuelLabels[k]}</Text><Muted>{saved.fuel[k]}</Muted></View>)}
      </View> : null}
      {showDetails ? <Muted>Hydration: have fluids available and drink regularly, adjusting for heat, humidity, sweat and comfort. This is general advice, not a prescribed amount.</Muted> : null}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn small icon="plus" label="Add lunch portion" testID="button-tennis-add-lunch" onPress={() => router.push({ pathname: '/portion', params: { meal: 'lunch' } })} />
        <Btn small icon="plus" label="Add snack portion" testID="button-tennis-add-snack" onPress={() => router.push({ pathname: '/portion', params: { meal: 'snack' } })} />
      </View>
      {explain}
      {saveError ? <ErrorBox error={saveError} /> : null}
      {confirmDelete ? <Card tone="danger">
        <Text style={{ fontFamily: F.bold, color: c.destructive, fontSize: 15 }}>Remove this tennis plan? Logged food portions are retained but become unscheduled (no timetable slot); the activity reference is not affected.</Text>
        <Btn variant="danger" icon="trash-2" label="Yes, remove plan" loading={saving} testID="button-confirm-delete-tennis-plan" onPress={() => void commit(null, person.id, date)} />
        <Btn variant="ghost" label="Keep it" disabled={saving} testID="button-cancel-delete-tennis-plan" onPress={() => setConfirmDelete(false)} />
      </Card> : <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn small variant="ghost" icon="edit-2" label="Edit plan" testID="button-edit-tennis-plan" onPress={() => open(saved)} />
        <Btn small variant="danger" icon="trash-2" label="Remove" testID="button-delete-tennis-plan" onPress={() => { setNotice(null); setSaveError(null); setConfirmDelete(true); }} />
      </View>}
    </>}
    {!saved ? explain : null}
    <TennisFoodPlanCopy person={person} date={date} />
    {young ? <View testID="tennis-young-warning"><Muted>Children and teenagers have individual energy and growth needs. Check targets and fueling with a qualified professional rather than relying on these timing examples.</Muted></View> : null}
    {showDetails ? <Muted>Based on general USTA nutrition timing guidance. Works offline; the source opens only when you tap.</Muted> : null}
    <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" icon="external-link" label="Open USTA source" testID="button-tennis-source" onPress={() => { tap(); setSourceError(null); Linking.openURL(TENNIS_SOURCE_URL).catch(() => setSourceError(new Error('Could not open the USTA source. An internet connection and a browser are needed to view the external page. Your saved tennis plan still works offline.'))); }} /></View>
    {sourceError ? <ErrorBox error={sourceError} /> : null}
  </Card>;
}
