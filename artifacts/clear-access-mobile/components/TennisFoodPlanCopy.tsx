import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  isValidCalendarDate, useCopyTennisFoodPlan, useGetDayActivity, useListMealEntries, useListPeople,
  useTennisFoodPlanDates, useTennisPlanHistory,
  type CopyTennisFoodPlanInput, type DayActivityKind, type Person, type TennisPlan, type TennisPlanHistoryItem,
} from '@/lib/local-api';
import {
  filterTennisPlanHistory, followingCalendarDate, getTennisFoodDestinationFingerprint,
  getTennisFoodImportKey, getTennisFoodPlanFingerprint, mapTennisFoodSlots,
} from '@/lib/tennis-copy';
import { dietPhaseLabels, timeMinutes } from '@/lib/tennis-planning';
import { sportsActivities } from '@/lib/planning-targets';
import { useOptionalPlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, success, tap, warn } from '@/components/ui';
import { n } from '@/lib/format';

type Review = {
  input: CopyTennisFoodPlanInput; sourceName: string; targetName: string; slots: number; foods: number;
  merge: boolean; matches: Array<{ sourceId: string; targetId: string | null }>;
  destinationPortions: number; destinationCalories: number;
};
type Done = {
  personId: number; date: string; label: string; slots: number; foods: number;
  matchedSlots: number; addedSlots: number; merge: boolean;
};
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
  const [targetId, setTargetId] = useState<number | null>(person.id);
  const [targetDate, setTargetDate] = useState(() => followingCalendarDate(date));
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('any');
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>('any');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('any');
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const pending = copy.isPending;

  const all = useMemo(() => people.data ?? [], [people.data]);
  const source = all.find(p => p.id === sourceId);
  const effTargetId = targetId !== null && all.some(p => p.id === targetId) ? targetId : (source?.id ?? null);
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
  const tgtEntries = useListMealEntries({ personId: effTargetId ?? 0, date: targetDate.trim() }, { query: { enabled: tgtOn } });

  const plan = srcOn ? srcDay.data?.tennis : undefined;
  const diets = useMemo(() => [...(plan?.diets ?? [])].sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time) || a.id.localeCompare(b.id)), [plan]);
  const linked = useMemo(() => (srcEntries.data ?? []).filter(e => e.tennisDietId && diets.some(d => d.id === e.tennisDietId)), [srcEntries.data, diets]);
  const srcFetching = srcDay.isFetching || srcEntries.isFetching;
  const srcFailed = srcDay.isError || srcEntries.isError;
  const srcReady = srcOn && !srcFailed && srcDay.isSuccess && srcEntries.isSuccess && !srcFetching;
  const tgtSlots = tgtOn && tgtDay.isSuccess ? (tgtDay.data?.tennis?.diets?.length ?? 0) : 0;
  const tgtReady = tgtOn && tgtDay.isSuccess && !tgtDay.isFetching && !tgtDay.isError &&
    tgtEntries.isSuccess && !tgtEntries.isFetching && !tgtEntries.isError;
  const targetImportKeys = new Set((tgtDay.data?.tennisFoodImports ?? []).map(getTennisFoodImportKey));
  const alreadyImported = !!source && diets.length > 0 &&
    diets.some(slot => targetImportKeys.has(getTennisFoodImportKey({
      sourcePersonBackupId: source.backupIds[0], sourceDate: sourceDate.trim(), sourceDietId: slot.id,
    })));
  const key = `${effTargetId}|${targetDate.trim()}`;
  const justCopied = lastKey === key;
  const noSlots = srcReady && diets.length === 0;
  const mergeAllowed = sourceId !== effTargetId && tgtSlots > 0;
  const canReviewCopy = srcReady && diets.length > 0 && tgtReady && tgtSlots === 0 && !sameDay && !justCopied && !alreadyImported && !pending;
  const canReviewMerge = srcReady && diets.length > 0 && tgtReady && mergeAllowed && !alreadyImported && !justCopied && !pending;

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

  function openReview(merge: boolean) {
    if (!(merge ? canReviewMerge : canReviewCopy) || !source || !target || effTargetId === null || !plan || !tgtReady) return;
    setError(null); setDone(null);
    const input: CopyTennisFoodPlanInput = {
      sourcePersonId: sourceId, sourceDate: sourceDate.trim(), targetPersonId: effTargetId, targetDate: targetDate.trim(),
      expectedSource: getTennisFoodPlanFingerprint(plan, srcEntries.data ?? [], source.name),
      expectedTarget: getTennisFoodDestinationFingerprint(tgtDay.data, tgtEntries.data ?? [], target.name),
      expectedTargetName: target.name, mergeExisting: merge,
    };
    const matches = merge ? mapTennisFoodSlots(diets, tgtDay.data?.tennis?.diets ?? []) :
      diets.map(slot => ({ sourceId: slot.id, targetId: null }));
    setReview({
      input, sourceName: source.name, targetName: target.name, slots: diets.length, foods: linked.length,
      merge, matches, destinationPortions: tgtEntries.data?.length ?? 0,
      destinationCalories: (tgtEntries.data ?? []).reduce((sum, entry) => sum + entry.nutrition.calories, 0),
    });
  }

  async function confirm() {
    if (!review || gate.current || pending) return;
    if (!srcReady || !tgtReady || (!review.merge && tgtSlots > 0) ||
      (review.merge && (!mergeAllowed || tgtSlots === 0)) || sameDay || justCopied || alreadyImported || !plan || !source) {
      setError(new Error('Check the source and destination, then review again.'));
      return;
    }
    const fresh = getTennisFoodPlanFingerprint(plan, srcEntries.data ?? [], source.name);
    if (fresh !== review.input.expectedSource) {
      setReview(null); warn();
      setError(new Error('The source plan or food timetable changed since you reviewed it. Your choices are kept; review the refreshed plan and confirm again.'));
      return;
    }
    if (!target || getTennisFoodDestinationFingerprint(tgtDay.data, tgtEntries.data ?? [], target.name) !== review.input.expectedTarget) {
      setReview(null); warn();
      setError(new Error('The destination changed since you reviewed it. Refresh the destination and review again.'));
      return;
    }
    gate.current = true; setError(null);
    const snap = review;
    try {
      const r = await copy.mutateAsync({ data: snap.input });
      success();
      setDone({
        personId: r.personId, date: r.date, label: `${snap.targetName} on ${r.date}`,
        slots: r.copiedSlots, foods: r.copiedFoods, matchedSlots: r.matchedSlots,
        addedSlots: r.addedSlots, merge: snap.merge,
      });
      setLastKey(`${snap.input.targetPersonId}|${snap.input.targetDate}`);
      setReview(null);
    } catch (e) {
      warn(); setError(e);
      if (e instanceof Error && /changed since review|source food plan changed|destination person changed|already been imported/i.test(e.message)) {
        setReview(null);
        void srcDay.refetch(); void srcEntries.refetch(); void tgtDay.refetch(); void tgtEntries.refetch();
      }
    }
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
      {tgtOn && tgtEntries.isError ? <ErrorBox error={tgtEntries.error} onRetry={() => tgtEntries.refetch()} /> : null}
      {noSlots ? <View testID="copy-cannot-copy"><Muted>Cannot copy: {source?.name} has no timed food slots on {sourceDate.trim()}. Choose another person or a date with timed slots{dateList.length ? ` (for example ${dateList[0].date})` : ''}.</Muted></View> : null}
      {sameDay ? <View testID="copy-same-day-error"><Muted>For the same person, choose a destination date different from the source date.</Muted></View> : null}
      {tgtReady && alreadyImported ? <ErrorBox error={new Error('This source timetable was already imported to this person and date. No portions will be added again.')} /> : null}
      {tgtReady && tgtSlots > 0 && !sameDay && !justCopied && !alreadyImported && !mergeAllowed ? <ErrorBox error={new Error(`${target?.name} already has ${tgtSlots} timed food ${tgtSlots === 1 ? 'slot' : 'slots'} on ${targetDate.trim()}. Same-person copies go to an empty day.`)} /> : null}
      {justCopied && !done ? <Muted>Already copied here. Change the destination person or date to copy again.</Muted> : null}

      {review ? <Card tone="mint">
        <View testID="copy-review" />
        <Text style={label}>{review.merge ? 'Review merge' : 'Review copy'}</Text>
        <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{review.sourceName}, {review.input.sourceDate} to {review.targetName}, {review.input.targetDate}</Text>
        <Muted>Destination: {activityLabel(tgtDay.data?.activityType ?? 'rest')} · {review.destinationPortions} existing food portions ({n(review.destinationCalories, 1)} kcal) will be kept. Existing sessions and nutrition goals will not change.</Muted>
        {!tgtDay.data?.tennis ? <Muted>No tennis sessions are saved on the destination. A food-only timetable will be created with the tennis plan set to Rest; the day’s activity stays unchanged. You can add sessions later.</Muted> : null}
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.primary }}>
          {review.merge
            ? `${review.matches.filter(match => match.targetId).length} matching ${review.matches.filter(match => match.targetId).length === 1 ? 'slot maps' : 'slots map'} to existing times; ${review.matches.filter(match => !match.targetId).length} ${review.matches.filter(match => !match.targetId).length === 1 ? 'new slot' : 'new slots'} will be added.`
            : `${review.slots} ${review.slots === 1 ? 'slot' : 'slots'} will be added.`} {review.foods} {review.foods === 1 ? 'food portion' : 'food portions'} will be added; nutrition counts once per portion.
        </Text>
        {diets.map(d => {
          const list = linked.filter(e => e.tennisDietId === d.id);
          const mapped = review.matches.find(match => match.sourceId === d.id)?.targetId;
          const destination = mapped ? tgtDay.data?.tennis?.diets?.find(slot => slot.id === mapped) : undefined;
          return <View key={d.id} style={{ gap: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.foreground }}>
              {d.time} · {dietPhaseLabels[d.phase]}{review.merge ? (destination ? ` · maps to existing ${destination.time} ${dietPhaseLabels[destination.phase]} slot` : ' · new slot') : ''}
            </Text>
            {list.length ? list.map(e => <Muted key={e.id}>{e.food.name}: {n(e.grams, 1)} g, {e.meal}</Muted>) : <Muted>Empty slot, no foods</Muted>}
          </View>;
        })}
        <Muted>Matching stage and time slots share the existing slot; non-matching slots stay separate. All listed source portions are additional, including foods similar to existing ones. Ordinary destination portions are kept. Sessions, notes, ratings, profile, references, goals, meal times and notifications are unchanged. Food times stay independently editable. Re-importing this source timetable to this day is blocked. Nothing is replaced or deleted.</Muted>
        <Muted>These are copied portion amounts, not personalized nutrition recommendations.</Muted>
        {srcFetching ? <Muted>Refreshing the source plan. Confirm will be available when it finishes.</Muted> : null}
        <Btn icon="check" label={review.merge ? 'Confirm merge' : 'Confirm copy'} loading={pending} disabled={pending || !srcReady || !tgtReady || (!review.merge && tgtSlots > 0) || (review.merge && !mergeAllowed) || sameDay || justCopied || alreadyImported} testID="button-confirm-tennis-copy" onPress={() => void confirm()} />
        <Btn variant="ghost" label="Cancel" disabled={pending} testID="button-cancel-tennis-copy" onPress={() => { setReview(null); setError(null); }} />
      </Card> : <>
        {tgtReady && tgtSlots > 0 && mergeAllowed && !alreadyImported ? <Btn icon="eye" label="Review merge into existing timetable" disabled={!canReviewMerge} testID="button-review-tennis-merge" onPress={() => openReview(true)} /> : null}
        <Btn icon="eye" label="Show copy review" disabled={!canReviewCopy} testID="button-review-tennis-copy" onPress={() => openReview(false)} />
      </>}

      {error ? <ErrorBox error={error} /> : null}
      {done ? <View accessibilityLiveRegion="polite" testID="status-tennis-copy-result" style={{ backgroundColor: c.accent, borderColor: c.accentBorder, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.accentForeground }}>
          {done.merge ? 'Merged' : 'Copied'} {done.slots} {done.slots === 1 ? 'source slot' : 'source slots'} ({done.matchedSlots} matched, {done.addedSlots} added) and {done.foods} {done.foods === 1 ? 'portion' : 'portions'} to {done.label}.
        </Text>
        {planner ? <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" icon="arrow-right" label="View copied plan" testID="button-view-copied-tennis-plan" onPress={view} /></View> : null}
      </View> : null}
    </>}
    <Btn small variant="ghost" label="Close" disabled={pending} testID="button-close-tennis-copy" onPress={() => { setOpen(false); reset(); }} />
  </View>;
}
