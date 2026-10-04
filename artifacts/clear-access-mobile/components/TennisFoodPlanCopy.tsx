import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  isValidCalendarDate, useCopyTennisFoodPlan, useGetDayActivity, useListMealEntries, useListPeople,
  useTennisFoodPlanDates, useTennisPlanHistory,
  type CopyTennisFoodPlanInput, type DayActivityKind, type Person, type TennisPlan, type TennisPlanHistoryItem,
} from '@/lib/local-api';
import { filterTennisPlanHistory, followingCalendarDate, getTennisFoodPlanFingerprint } from '@/lib/tennis-copy';
import { dietPhaseLabels, timeMinutes, tennisActivityPlanProblem } from '@/lib/tennis-planning';
import { sportsActivities } from '@/lib/planning-targets';
import { useOptionalPlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, success, tap, warn } from '@/components/ui';
import { n } from '@/lib/format';

type Review = { input: CopyTennisFoodPlanInput; sourceName: string; targetName: string; slots: number; foods: number };
type Done = { personId: number; date: string; label: string; slots: number; foods: number };
type RatingFilter = 'any' | 'unrated' | `${number}`;
type DayTypeFilter = 'any' | TennisPlan['mode'];
type ActivityFilter = 'any' | DayActivityKind;

const ratingFilters: { value: RatingFilter; label: string }[] = [
  { value: 'any', label: 'Any' }, { value: 'unrated', label: 'Not rated' },
  ...Array.from({ length: 11 }, (_, score) => ({ value: `${score}` as RatingFilter, label: `${score}/10` })),
];
const dayTypeFilters: { value: DayTypeFilter; label: string }[] = [
  { value: 'any', label: 'Any' }, { value: 'training', label: 'Training' },
  { value: 'tournament', label: 'Tournament' }, { value: 'rest', label: 'Rest' },
];
const activityFilters: { value: ActivityFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  ...(Object.keys(sportsActivities) as DayActivityKind[]).map(value => ({ value, label: sportsActivities[value].short })),
];

export function TennisFoodPlanCopy({ person, date }: { person: Person; date: string }) {
  const c = useColors();
  const router = useRouter();
  const planner = useOptionalPlanner();
  const people = useListPeople();
  const copy = useCopyTennisFoodPlan();
  const gate = useRef(false);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(person.id);
  const [sourceDate, setSourceDate] = useState(date);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState(date);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('any');
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>('any');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('any');
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const pending = copy.isPending;

  const all = useMemo(() => people.data ?? [], [people.data]);
  const others = all.filter(p => p.id !== sourceId);
  const source = all.find(p => p.id === sourceId);
  const effTargetId = targetId !== null && all.some(p => p.id === targetId) ? targetId : (others[0]?.id ?? source?.id ?? null);
  const target = all.find(p => p.id === effTargetId);

  const srcDateOk = isValidCalendarDate(sourceDate.trim());
  const tgtDateOk = isValidCalendarDate(targetDate.trim());
  const srcOn = srcDateOk && !!source && sourceId > 0;
  const tgtOn = tgtDateOk && !!target && effTargetId !== null && effTargetId > 0;
  const sameDay = srcOn && tgtOn && sourceId === effTargetId && sourceDate.trim() === targetDate.trim();

  const dates = useTennisFoodPlanDates(sourceId, { query: { enabled: open && !!source } });
  const history = useTennisPlanHistory(sourceId, { query: { enabled: open && !!source } });
  const dateList = useMemo(() => [...(dates.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [dates.data]);
  const previousPlans = useMemo(() => filterTennisPlanHistory(history.data ?? [], {
    before: tgtDateOk ? targetDate.trim() : '',
    rating: ratingFilter === 'any' || ratingFilter === 'unrated' ? ratingFilter : Number(ratingFilter),
    tennisDayType: dayTypeFilter,
    activityType: activityFilter,
  }), [
    history.data, targetDate, ratingFilter, dayTypeFilter, activityFilter,
  ]);
  const srcDay = useGetDayActivity({ personId: sourceId, date: sourceDate.trim() }, { query: { enabled: srcOn } });
  const srcEntries = useListMealEntries({ personId: sourceId, date: sourceDate.trim() }, { query: { enabled: srcOn } });
  const tgtDay = useGetDayActivity({ personId: effTargetId ?? 0, date: targetDate.trim() }, { query: { enabled: tgtOn } });

  const plan = srcOn ? srcDay.data?.tennis : undefined;
  const diets = useMemo(() => [...(plan?.diets ?? [])].sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time) || a.id.localeCompare(b.id)), [plan]);
  const linked = useMemo(() => (srcEntries.data ?? []).filter(e => e.tennisDietId && diets.some(d => d.id === e.tennisDietId)), [srcEntries.data, diets]);
  const srcFetching = srcDay.isFetching || srcEntries.isFetching;
  const srcFailed = srcDay.isError || srcEntries.isError;
  const srcReady = srcOn && !srcFailed && srcDay.isSuccess && srcEntries.isSuccess && !srcFetching;
  const tgtSlots = tgtOn && tgtDay.isSuccess ? (tgtDay.data?.tennis?.diets?.length ?? 0) : 0;
  const tgtReady = tgtOn && tgtDay.isSuccess && !tgtDay.isFetching && !tgtDay.isError;
  const targetPlan = tgtReady ? tgtDay.data?.tennis ?? plan : undefined;
  const targetActivityProblem = targetPlan
    ? tennisActivityPlanProblem(tgtDay.data?.activityType ?? 'rest', targetPlan)
    : null;
  const key = `${effTargetId}|${targetDate.trim()}`;
  const justCopied = lastKey === key;
  const noSlots = srcReady && diets.length === 0;
  const canReview = srcReady && diets.length > 0 && tgtReady && tgtSlots === 0 && !targetActivityProblem && !sameDay && !justCopied && !pending;

  function reset() { setReview(null); setError(null); setDone(null); }
  function pickSource(id: number) {
    setSourceId(id); reset();
  }
  function pickSourceDate(v: string) { setSourceDate(v); reset(); }
  function chooseHistoryPlan(item: TennisPlanHistoryItem) {
    if (item.slots === 0) return;
    setSourceDate(item.date);
    setTargetDate(followingCalendarDate(item.date));
    setTargetId(sourceId);
    reset();
  }

  function openReview() {
    if (!canReview || !source || !target || effTargetId === null || !plan) return;
    setError(null); setDone(null);
    setReview({
      input: {
        sourcePersonId: sourceId, sourceDate: sourceDate.trim(), targetPersonId: effTargetId, targetDate: targetDate.trim(),
        expectedSource: getTennisFoodPlanFingerprint(plan, srcEntries.data ?? [], source.name), expectedTargetName: target.name,
      },
      sourceName: source.name, targetName: target.name, slots: diets.length, foods: linked.length,
    });
  }

  async function confirm() {
    if (!review || gate.current || pending) return;
    if (!srcReady || !tgtReady || tgtSlots > 0 || targetActivityProblem || sameDay || justCopied || !plan || !source) {
      setError(new Error(targetActivityProblem ?? 'Check the source and destination, then review again.'));
      return;
    }
    const fresh = getTennisFoodPlanFingerprint(plan, srcEntries.data ?? [], source.name);
    if (fresh !== review.input.expectedSource) {
      setReview(null); warn();
      setError(new Error('The source plan or food timetable changed since you reviewed it. Your choices are kept; review the refreshed plan and confirm again.'));
      return;
    }
    gate.current = true; setError(null);
    const snap = review;
    try {
      const r = await copy.mutateAsync({ data: snap.input });
      success();
      setDone({ personId: r.personId, date: r.date, label: `${snap.targetName} on ${r.date}`, slots: r.copiedSlots, foods: r.copiedFoods });
      setLastKey(`${snap.input.targetPersonId}|${snap.input.targetDate}`);
      setReview(null);
    } catch (e) { warn(); setError(e); }
    finally { gate.current = false; }
  }

  function view() {
    if (!done || !planner) return;
    planner.selectPerson(done.personId); planner.setDate(done.date); router.replace('/planner');
  }

  const label = { fontFamily: F.bold, fontSize: 15, color: c.foreground } as const;
  const activityLabel = (value: DayActivityKind) => sportsActivities[value].short;
  const head = <View style={{ gap: 4 }}>
    <Eyebrow>Copy to another date or person</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 17, letterSpacing: -0.4, color: c.foreground }}>Reuse a food timetable</Text>
  </View>;

  if (!open) return <View testID="tennis-copy-panel" style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
    {head}
    <Muted>Copy a food timetable to another date for the same person, or to another saved person. Nothing leaves this device.</Muted>
    <Btn small variant="ghost" icon="copy" label="Copy food timetable" testID="button-open-tennis-copy" onPress={() => setOpen(true)} />
  </View>;

  const dateChips = dateList.slice(0, 6);
  return <View testID="tennis-copy-panel" style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
    {head}
    {people.isLoading ? <LoadingBlock rows={1} height={60} /> : people.isError ? <ErrorBox error={people.error} onRetry={() => people.refetch()} /> : <>
      <Text style={label}>From person</Text>
      <Chips testPrefix="copy-source-person" value={String(sourceId)} onChange={v => pickSource(Number(v))} options={all.map(p => ({ value: String(p.id), label: p.name }))} disabled={pending} />
      <Text style={label}>Source date</Text>
      {dates.isLoading ? <LoadingBlock rows={1} height={40} /> : dates.isError ? <ErrorBox error={dates.error} onRetry={() => dates.refetch()} /> : dateChips.length ? <Chips testPrefix="copy-source-date" value={sourceDate.trim()} onChange={pickSourceDate} options={dateChips.map(d => ({ value: d.date, label: d.date }))} disabled={pending} /> : <Muted>{source?.name ?? 'This person'} has no saved food timetables yet.</Muted>}
      <Field label="Source date (YYYY-MM-DD)" value={sourceDate} onChangeText={pickSourceDate} maxLength={10} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!pending} testID="input-copy-source-date" hint={srcDateOk ? undefined : 'Enter a real calendar date.'} />
      {dateList.length ? <Muted>Dates with timed slots: {dateList.map(d => `${d.date} (${d.slots} ${d.slots === 1 ? 'slot' : 'slots'}, ${d.foods} ${d.foods === 1 ? 'food' : 'foods'})`).join(', ')}</Muted> : null}

      <View testID="tennis-plan-history">
      <Card style={{ gap: 10 }}>
        <Eyebrow>Find a previous plan</Eyebrow>
        <Muted>Plans before the destination date. Filters combine; choose a result to use it as the source and set the destination to the following day.</Muted>
        {history.isLoading ? <LoadingBlock rows={1} height={56} /> : history.isError
          ? <ErrorBox error={history.error} onRetry={() => history.refetch()} />
          : <>
            <Text style={label}>Experience rating · 0 is lowest, 10 highest</Text>
            <Chips testPrefix="filter-plan-rating" value={ratingFilter} onChange={value => { setRatingFilter(value); reset(); }} options={ratingFilters} disabled={pending} />
            <Text style={label}>Tennis day type</Text>
            <Chips testPrefix="filter-tennis-day-type" value={dayTypeFilter} onChange={value => { setDayTypeFilter(value); reset(); }} options={dayTypeFilters} disabled={pending} />
            <Text style={label}>Activity type</Text>
            <Chips testPrefix="filter-plan-activity-type" value={activityFilter} onChange={value => { setActivityFilter(value); reset(); }} options={activityFilters} disabled={pending} />
            <Text testID="history-plan-count" style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>
              {previousPlans.length} matching previous {previousPlans.length === 1 ? 'plan' : 'plans'}
            </Text>
            {previousPlans.length === 0 ? <Muted>No previous plans match these filters. Choose a later destination date or change a filter.</Muted> :
              previousPlans.map(item => {
                const disabled = item.slots === 0 || pending;
                return <Pressable
                  key={item.date}
                  testID={`history-plan-${item.date}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: sourceDate.trim() === item.date }}
                  disabled={disabled}
                  onPress={() => { tap(); chooseHistoryPlan(item); }}
                  style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.secondary, borderRadius: 14, padding: 12, gap: 3, opacity: disabled ? 0.56 : 1 }}
                >
                  <Text style={{ fontFamily: F.bold, fontSize: 14, color: c.foreground }}>
                    {item.date} · {item.tennisDayType === 'training' ? 'Training' : item.tennisDayType === 'tournament' ? 'Tournament' : 'Rest'}
                  </Text>
                  <Muted>Activity: {activityLabel(item.activityType)} · Rating: {item.rating === null ? 'Not rated' : `${item.rating}/10`}</Muted>
                  <Muted>{item.sessions} {item.sessions === 1 ? 'session' : 'sessions'} · {item.slots} food {item.slots === 1 ? 'slot' : 'slots'} · {item.foods} attached {item.foods === 1 ? 'food' : 'foods'}</Muted>
                  <Text style={{ fontFamily: F.semi, fontSize: 12, color: disabled ? c.mutedForeground : c.primary }}>
                    {item.slots === 0 ? 'No timed food slots to copy' : 'Use this plan · copy to the following day'}
                  </Text>
                </Pressable>;
              })}
          </>}
      </Card>
      </View>

      <Text style={label}>To person (same or another)</Text>
      <Chips testPrefix="copy-target-person" value={String(effTargetId ?? '')} onChange={v => { setTargetId(Number(v)); reset(); }} options={all.map(p => ({ value: String(p.id), label: p.name }))} disabled={pending} />
      <Field label="Destination date (YYYY-MM-DD)" value={targetDate} onChangeText={v => { setTargetDate(v); reset(); }} maxLength={10} autoCapitalize="none" keyboardType="numbers-and-punctuation" editable={!pending} testID="input-copy-target-date" hint={tgtDateOk ? undefined : 'Enter a real calendar date.'} />

      {srcOn && (srcDay.isLoading || srcEntries.isLoading) ? <LoadingBlock rows={1} height={60} /> : null}
      {srcOn && srcFailed ? <ErrorBox error={srcDay.error ?? srcEntries.error} onRetry={() => { void srcDay.refetch(); void srcEntries.refetch(); }} /> : null}
      {tgtOn && tgtDay.isError ? <ErrorBox error={tgtDay.error} onRetry={() => tgtDay.refetch()} /> : null}
      {noSlots ? <View testID="copy-cannot-copy"><Muted>Cannot copy: {source?.name} has no timed food slots on {sourceDate.trim()}. Choose another person or a date with timed slots{dateList.length ? ` (for example ${dateList[0].date})` : ''}.</Muted></View> : null}
      {sameDay ? <View testID="copy-same-day-error"><Muted>For the same person, choose a destination date different from the source date.</Muted></View> : null}
      {targetActivityProblem ? <View testID="copy-activity-mismatch"><Muted>Destination conflict: {targetActivityProblem}</Muted></View> : null}
      {tgtReady && tgtSlots > 0 && !sameDay && !justCopied ? <ErrorBox error={new Error(`${target?.name} already has ${tgtSlots} timed food ${tgtSlots === 1 ? 'slot' : 'slots'} on ${targetDate.trim()}. Existing slots and foods are never replaced. Choose another date.`)} /> : null}
      {justCopied && !done ? <Muted>Already copied here. Change the destination person or date to copy again.</Muted> : null}

      {review ? <Card tone="mint">
        <View testID="copy-review" />
        <Text style={label}>Review copy</Text>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{review.sourceName}, {review.input.sourceDate} to {review.targetName}, {review.input.targetDate}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.primary }}>{review.slots} {review.slots === 1 ? 'slot' : 'slots'} and {review.foods} {review.foods === 1 ? 'food portion' : 'food portions'} will be added</Text>
        {diets.map(d => {
          const list = linked.filter(e => e.tennisDietId === d.id);
          return <View key={d.id} style={{ gap: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.foreground }}>{d.time} · {dietPhaseLabels[d.phase]}</Text>
            {list.length ? list.map(e => <Muted key={e.id}>{e.food.name}: {n(e.grams, 1)} g, {e.meal}</Muted>) : <Muted>Empty slot, no foods</Muted>}
          </View>;
        })}
        <Muted>Rules: every slot is copied, including empty ones, with exact grams, meal, times and stage. New IDs are created and each food is counted once. Only foods attached to timetable slots are copied, not ordinary portions. Existing tennis sessions and notes for {review.targetName} are kept; if there is no tennis day, the source sessions and notes are copied too. Targets, profile, meal times and notifications are unchanged, and no alerts are copied. Nothing existing is replaced or deleted.</Muted>
        <Muted>These are copied portion amounts, not personalized nutrition recommendations.</Muted>
        {srcFetching ? <Muted>Refreshing the source plan. Confirm will be available when it finishes.</Muted> : null}
        <Btn icon="check" label="Confirm copy" loading={pending} disabled={pending || !srcReady || !tgtReady || tgtSlots > 0 || !!targetActivityProblem || sameDay || justCopied} testID="button-confirm-tennis-copy" onPress={() => void confirm()} />
        <Btn variant="ghost" label="Cancel" disabled={pending} testID="button-cancel-tennis-copy" onPress={() => { setReview(null); setError(null); }} />
      </Card> : <Btn icon="eye" label="Show review" disabled={!canReview} testID="button-review-tennis-copy" onPress={openReview} />}

      {error ? <ErrorBox error={error} /> : null}
      {done ? <View accessibilityLiveRegion="polite" testID="status-tennis-copy-result" style={{ backgroundColor: c.accent, borderColor: c.accentBorder, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.accentForeground }}>Copied {done.slots} {done.slots === 1 ? 'slot' : 'slots'} and {done.foods} {done.foods === 1 ? 'food' : 'foods'} to {done.label}.</Text>
        {planner ? <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" icon="arrow-right" label="View copied plan" testID="button-view-copied-tennis-plan" onPress={view} /></View> : null}
      </View> : null}
    </>}
    <Btn small variant="ghost" label="Close" disabled={pending} testID="button-close-tennis-copy" onPress={() => { setOpen(false); reset(); }} />
  </View>;
}
