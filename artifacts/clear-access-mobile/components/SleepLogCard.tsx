import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { getAgeOnDate } from '@/lib/planning-targets';
import { shiftDate, today } from '@/lib/format';
import type { SleepInterval } from '@/lib/local-models';
import { calculateTotalSleepMinutes, formatSleepDuration, isValidSleepQuality, reusableSleepTimes, shiftSleepMonth, sleepDurationMinutes, sleepMonthDates, sleepMonthWeekRanges, sleepMonthsBetween, sleepQualityRecordsForMonth, sleepReferenceForDate, sleepWeekDates, summarizeSleepDurationByWeekday, summarizeSleepQualityByActivity, summarizeSleepQualityByActivityByMonth, summarizeSleepQualityByMonth, summarizeSleepQualityByWeekday, summarizeSleepRecords } from '@/lib/sleep-tracking';
import { compareHydrationSummaries, hydrationActivityRecords, summarizeHydrationByActivity, summarizeHydrationByActivityByMonth, summarizeHydrationByDate, summarizeHydrationByWeekday, summarizeHydrationRecords } from '@/lib/hydration';
import type { HydrationActivityRecord } from '@/lib/hydration';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, Muted, tap } from '@/components/ui';
import { sleepMonthSelectionForPlannerDate } from '@/lib/sleep-month-preferences';
import DateField from '@/components/DateField';
import TimeField from '@/components/TimeField';
import MonthField from '@/components/MonthField';
import { sleepMonthPreferences, sleepRoutinePreferences, useDayActivitiesForDates, useGetDayActivity, useHydrationActivityRecordsForDateRange, useSaveSleepRecord, useSearchSleepNotes, useSleepRecordsForDateRange } from '@/lib/local-api';

const qualityChoices = [
  { value: 'unrated', label: 'Choose rating' },
  { value: '1', label: '1 · Poor' },
  { value: '2', label: '2' },
  { value: '3', label: '3 · OK' },
  { value: '4', label: '4' },
  { value: '5', label: '5 · Great' },
];
const sleepNoteQualityChoices = qualityChoices.slice(1).map(choice => ({ value: Number(choice.value), label: choice.label }));

function SleepIntervalEditor({ label, testPrefix, intervals, onChange, startHint, endHint, maxEntries }: {
  label: string;
  testPrefix: string;
  intervals: SleepInterval[];
  onChange: (intervals: SleepInterval[]) => void;
  startHint: string;
  endHint: string;
  maxEntries: number;
}) {
  const c = useColors();
  return <View style={{ gap: 6 }}>
    <Text style={{ fontFamily: F.semi, color: c.foreground }}>{label}</Text>
    {intervals.map((interval, index) => <View key={`${testPrefix}-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      <View style={{ flex: 1 }}>
        <TimeField label={`Start ${index + 1} (24-hour)`} value={interval.startTime} onChangeText={value => onChange(intervals.map((item, i) => i === index ? { ...item, startTime: value } : item))} placeholder={startHint} testID={`input-${testPrefix}-${index}-start`} />
      </View>
      <View style={{ flex: 1 }}>
        <TimeField label={`End ${index + 1} (24-hour)`} value={interval.endTime} onChangeText={value => onChange(intervals.map((item, i) => i === index ? { ...item, endTime: value } : item))} placeholder={endHint} testID={`input-${testPrefix}-${index}-end`} />
      </View>
      <Btn small variant="ghost" icon="trash-2" label="Remove" testID={`button-remove-${testPrefix}-${index}`} onPress={() => onChange(intervals.filter((_, i) => i !== index))} />
    </View>)}
    <Btn small variant="ghost" icon="plus" label={`Add ${testPrefix === 'nap' ? 'nap' : 'wake-up'}`} disabled={intervals.length >= maxEntries} testID={`button-add-${testPrefix}`} onPress={() => onChange([...intervals, { startTime: '', endTime: '' }])} />
  </View>;
}

function sleepRange(ageYears: number | null) {
  if (ageYears === null) return 'Age-based daily guidance: 4–12 months, 12–16 hours (including naps); 1–2 years, 11–14; 3–5 years, 10–13; 6–12 years, 9–12; 13–17 years, 8–10; adults 18–60, at least 7 hours. Add a date of birth for the selected person’s range.';
  if (ageYears === 0) return 'Under 1 year: CDC ranges vary by age — 14–17 hours at 0–3 months; 12–16 hours at 4–12 months, including naps.';
  if (ageYears <= 2) return '1–2 years: 11–14 hours per 24 hours, including naps.';
  if (ageYears <= 5) return '3–5 years: 10–13 hours per 24 hours, including naps.';
  if (ageYears <= 12) return '6–12 years: 9–12 hours per day.';
  if (ageYears <= 17) return '13–17 years: 8–10 hours per day.';
  if (ageYears <= 60) return '18–60 years: at least 7 hours per day.';
  if (ageYears <= 64) return '61–64 years: 7–9 hours per day.';
  return '65 years and older: 7–8 hours per day.';
}

function SleepWeekSummary({ personId, date, dateOfBirth, onSelectDate }: {
  personId: number;
  date: string;
  dateOfBirth: string | null;
  onSelectDate: (date: string) => void;
}) {
  const c = useColors();
  const [weekStart, setWeekStart] = useState(() => sleepWeekDates(date)[0] ?? date);
  const [month, setMonth] = useState(date.slice(0, 7));
  const [comparisonMonth, setComparisonMonth] = useState(() => shiftSleepMonth(date.slice(0, 7), -1));
  const [monthSelectionReadyFor, setMonthSelectionReadyFor] = useState<number | null>(null);
  const [monthPreferenceError, setMonthPreferenceError] = useState<string | null>(null);
  const latestDateMonth = useRef(date.slice(0, 7));
  latestDateMonth.current = date.slice(0, 7);
  const [rangeMode, setRangeMode] = useState<'week' | 'month' | 'quality-range'>('week');
  const [expandedQualityMonth, setExpandedQualityMonth] = useState<string | null>(null);
  const [preferredRangeMode, setPreferredRangeMode] = useState<'week' | 'month'>('week');
  const [qualityRangeStart, setQualityRangeStart] = useState(() => shiftSleepMonth(date.slice(0, 7), -11));
  const [qualityRangeEnd, setQualityRangeEnd] = useState(() => date.slice(0, 7));
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedActivityGroup, setExpandedActivityGroup] = useState<'active' | 'rest' | null>(null);
  const [expandedHydrationWeek, setExpandedHydrationWeek] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState('');
  const [settledNoteSearch, setSettledNoteSearch] = useState('');
  const [noteQualityFilters, setNoteQualityFilters] = useState<number[]>([]);
  useEffect(() => {
    setWeekStart(sleepWeekDates(date)[0] ?? date);
  }, [date]);
  useEffect(() => {
    let active = true;
    setMonthSelectionReadyFor(null);
    setMonthPreferenceError(null);
    sleepMonthPreferences.load(personId).then(saved => {
      if (!active) return;
      const initialMonth = latestDateMonth.current;
      setMonth(saved?.month ?? initialMonth);
      setComparisonMonth(saved?.comparisonMonth ?? shiftSleepMonth(initialMonth, -1));
      setRangeMode(saved?.view ?? 'week');
      setPreferredRangeMode(saved?.view ?? 'week');
      setMonthSelectionReadyFor(personId);
    }).catch(problem => {
      if (!active) return;
      const initialMonth = latestDateMonth.current;
      setMonth(initialMonth);
      setComparisonMonth(shiftSleepMonth(initialMonth, -1));
      setRangeMode('week');
      setPreferredRangeMode('week');
      setMonthPreferenceError(problem instanceof Error ? problem.message : 'Could not load saved sleep month selections.');
      setMonthSelectionReadyFor(personId);
    });
    return () => { active = false; };
  }, [personId]);
  useEffect(() => {
    if (monthSelectionReadyFor !== personId) return;
    let active = true;
    sleepMonthPreferences.save(personId, { month, comparisonMonth, view: preferredRangeMode }).then(() => {
      if (active) setMonthPreferenceError(null);
    }).catch(problem => {
      if (active) setMonthPreferenceError(problem instanceof Error ? problem.message : 'Could not save sleep month selections.');
    });
    return () => { active = false; };
  }, [personId, monthSelectionReadyFor, month, comparisonMonth, preferredRangeMode]);
  useEffect(() => {
    const timer = setTimeout(() => setSettledNoteSearch(noteSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [noteSearch]);
  const dates = useMemo(() => rangeMode === 'week' ? sleepWeekDates(weekStart) : sleepMonthDates(`${month}-01`),
    [rangeMode, weekStart, month]);
  const currentMonthDates = useMemo(() => sleepMonthDates(`${month}-01`), [month]);
  const comparisonMonthDates = useMemo(() => sleepMonthDates(`${comparisonMonth}-01`), [comparisonMonth]);
  const queriedDates = useMemo(() => rangeMode === 'month' ? [...comparisonMonthDates, ...currentMonthDates] : rangeMode === 'week' ? dates : [],
    [rangeMode, comparisonMonthDates, currentMonthDates, dates]);
  const days = useDayActivitiesForDates(personId, queriedDates);
  const qualityMonths = useMemo(() => sleepMonthsBetween(qualityRangeStart, qualityRangeEnd), [qualityRangeStart, qualityRangeEnd]);
  const qualityRangeValid = qualityMonths.length > 0;
  const qualityRangeStartDate = `${qualityRangeStart}-01`;
  const qualityRangeEndDate = `${qualityRangeEnd}-${String(new Date(Date.UTC(Number(qualityRangeEnd.slice(0, 4)), Number(qualityRangeEnd.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
  const qualityRangeRecords = useSleepRecordsForDateRange(personId, qualityRangeStartDate, qualityRangeEndDate,
    rangeMode === 'quality-range' && qualityRangeValid);
  const hydrationActivityRangeRecords = useHydrationActivityRecordsForDateRange(personId, qualityRangeStartDate, qualityRangeEndDate,
    rangeMode === 'quality-range' && qualityRangeValid);
  const qualitySummaries = useMemo(() => summarizeSleepQualityByMonth(
    qualityRangeRecords.data ?? [], qualityRangeStart, qualityRangeEnd, today(),
  ), [qualityRangeRecords.data, qualityRangeStart, qualityRangeEnd]);
  const sleepActivityRangeSummaries = useMemo(() => summarizeSleepQualityByActivity(
    qualityRangeRecords.data ?? [], today(),
  ), [qualityRangeRecords.data]);
  const sleepActivityMonthSummaries = useMemo(() => summarizeSleepQualityByActivityByMonth(
    qualityRangeRecords.data ?? [], qualityMonths, today(),
  ), [qualityRangeRecords.data, qualityMonths]);
  const hydrationActivityRangeSummary = useMemo(() => summarizeHydrationByActivity(
    hydrationActivityRangeRecords.data ?? [], today(),
  ), [hydrationActivityRangeRecords.data]);
  const hydrationActivityMonthSummaries = useMemo(() => summarizeHydrationByActivityByMonth(
    hydrationActivityRangeRecords.data ?? [], qualityMonths, today(),
  ), [hydrationActivityRangeRecords.data, qualityMonths]);
  const qualityDetailRecords = useMemo(() => new Map(qualitySummaries.map(item => [
    item.month,
    sleepQualityRecordsForMonth(qualityRangeRecords.data ?? [], item.month, today()),
  ] as const)), [qualitySummaries, qualityRangeRecords.data]);
  const noteResults = useSearchSleepNotes(personId, settledNoteSearch, noteQualityFilters);
  const noteFiltersActive = Boolean(noteSearch.trim()) || noteQualityFilters.length > 0;
  const noteSearchPending = noteSearch.trim().toLowerCase() !== settledNoteSearch.toLowerCase();
  const toRecord = (dayDate: string, queryIndex: number) => {
    const query = days[queryIndex];
    const sleep = query?.data?.sleep;
    const minutes = sleep ? calculateTotalSleepMinutes(sleep) : null;
    const reference = sleepReferenceForDate(dateOfBirth, dayDate);
    const comparison = minutes === null ? null : reference === null ? 'Add date of birth for an age-based comparison.' :
      minutes < reference.minMinutes ? `Below daily reference (${reference.label})` :
        reference.maxMinutes !== null && minutes > reference.maxMinutes ? `Above daily reference (${reference.label})` :
          `Within daily reference (${reference.label})`;
    return {
      date: dayDate, sleep, hydration: query?.data?.hydration,
      activityType: query?.data?.activityType ?? 'rest', tennis: query?.data?.tennis,
      minutes, reference, comparison, loading: query?.isLoading ?? true,
      failed: query?.isError ?? false,
      napOnly: Boolean(sleep && sleep.bedtime === null && sleep.wakeTime === null && (sleep.naps?.length ?? 0) > 0),
      overnight: Boolean(sleep && sleep.bedtime !== null && sleep.wakeTime !== null),
    };
  };
  const records = rangeMode === 'month'
    ? currentMonthDates.map((dayDate, index) => toRecord(dayDate, comparisonMonthDates.length + index))
    : rangeMode === 'week' ? dates.map((dayDate, index) => toRecord(dayDate, index)) : [];
  const comparisonRecords = rangeMode === 'month' ? comparisonMonthDates.map((dayDate, index) => toRecord(dayDate, index)) : [];
  const summary = summarizeSleepRecords(records, today());
  const comparisonSummary = summarizeSleepRecords(comparisonRecords, today());
  const weekdayDuration = summarizeSleepDurationByWeekday(records, today());
  const comparisonWeekdayDuration = summarizeSleepDurationByWeekday(comparisonRecords, today());
  const weekdayQuality = summarizeSleepQualityByWeekday(records, today());
  const comparisonWeekdayQuality = summarizeSleepQualityByWeekday(comparisonRecords, today());
  const hydrationSummary = summarizeHydrationRecords(records.map(record => ({ date: record.date, hydration: record.hydration })), today());
  const comparisonHydrationSummary = summarizeHydrationRecords(comparisonRecords.map(record => ({ date: record.date, hydration: record.hydration })), today());
  const weekdayHydration = summarizeHydrationByWeekday(records.map(record => ({ date: record.date, hydration: record.hydration })), today());
  const comparisonWeekdayHydration = summarizeHydrationByWeekday(comparisonRecords.map(record => ({ date: record.date, hydration: record.hydration })), today());
  const activityHydration = summarizeHydrationByActivity(records.map(record => ({
    date: record.date, activityType: record.activityType, tennis: record.tennis, hydration: record.hydration,
  })), today());
  const comparisonActivityHydration = summarizeHydrationByActivity(comparisonRecords.map(record => ({
    date: record.date, activityType: record.activityType, tennis: record.tennis, hydration: record.hydration,
  })), today());
  const hydrationComparison = compareHydrationSummaries(hydrationSummary, comparisonHydrationSummary);
  const periodLoading = records.some(record => record.loading);
  const periodFailed = records.some(record => record.failed);
  const comparisonPeriodLoading = comparisonRecords.some(record => record.loading);
  const comparisonPeriodFailed = comparisonRecords.some(record => record.failed);
  const monthSelectionReady = monthSelectionReadyFor === personId;
  const weeklySummaries = rangeMode === 'month' ? sleepMonthWeekRanges(month).map(range => {
    const weekRecords = records.filter(record => record.date >= range.startDate && record.date <= range.endDate);
    return {
      ...range,
      sleep: summarizeSleepRecords(weekRecords, today()),
      hydration: summarizeHydrationRecords(weekRecords.map(record => ({ date: record.date, hydration: record.hydration })), today()),
      hydrationDays: summarizeHydrationByDate(weekRecords.map(record => ({ date: record.date, hydration: record.hydration })), today()),
    };
  }) : [];
  const moveWeek = (amount: number) => {
    const start = new Date(`${weekStart}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + amount * 7);
    setWeekStart(start.toISOString().slice(0, 10));
  };
  const prettyDate = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
  const monthTitle = (monthValue: string) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    .format(new Date(`${monthValue}-01T00:00:00`));
  const periodTitle = rangeMode === 'week'
    ? `${prettyDate(dates[0], { month: 'short', day: 'numeric' })} – ${prettyDate(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
    : monthTitle(month);
  const monthCounts = (value: typeof summary) =>
    `${value.loggedDays}/${value.elapsedDays} past dates logged · ${value.overnightDays} overnight · ${value.napOnlyDays} nap-only · ${value.missingDays} missing`;
  const monthAverages = (value: typeof summary) =>
    `Average duration ${value.averageMinutes === null ? 'unavailable' : formatSleepDuration(value.averageMinutes)} · quality ${value.averageQuality === null ? 'unrated' : `${value.averageQuality.toFixed(1)}/5`}`;
  const qualityDistribution = (value: typeof summary) => value.ratedDays
    ? `Quality ratings (${value.ratedDays}): ${value.qualityCounts.map((count, index) => `${index + 1}: ${count}`).join(' · ')}`
    : 'No valid quality ratings.';
  const sleepActivityGroupTitle = (group: typeof sleepActivityRangeSummaries[number]['group']) =>
    group === 'practice' ? 'Practice days' : group === 'match' ? 'Match days' : 'Rest days';
  const sleepActivityRatingLine = (value: typeof sleepActivityRangeSummaries[number]) =>
    value.averageQuality === null ? 'No valid ratings · n=0' :
      `Mean ${value.averageQuality.toFixed(1)}/5 · n=${value.ratedDays} valid ratings`;
  const sleepActivityCountsLine = (value: typeof sleepActivityRangeSummaries[number]) =>
    `Scores 1–5: ${value.qualityCounts.map((count, index) => `${index + 1}: ${count}`).join(' · ')}`;
  const weekdayQualityAverage = (value: typeof weekdayQuality[number]) =>
    value.averageQuality === null ? '— · n=0' : `${value.averageQuality.toFixed(1)}/5 · n=${value.ratingCount}`;
  const weekdayQualityCounts = (value: typeof weekdayQuality[number]) =>
    value.qualityCounts.map((count, index) => `${index + 1}:${count}`).join(' · ');
  const weekdayDurationAverage = (value: typeof weekdayDuration[number]) =>
    value.averageMinutes === null ? '— · n=0' : `${formatSleepDuration(value.averageMinutes)} · n=${value.durationCount}`;
  const weekdayHydrationValue = (value: typeof weekdayHydration[number]) => {
    const plannedPerDay = value.plannedDays ? `${liters(value.plannedMl / value.plannedDays)}/planned day` : '— plan';
    const actualPerDay = value.actualMl !== null && value.actualDays
      ? `${liters(value.actualMl / value.actualDays)}/logged day`
      : '— actual';
    const matchedPercent = value.actualMl !== null && value.plannedForRecordedMl > 0
      ? `${(value.actualMl / value.plannedForRecordedMl * 100).toFixed(0)}% of paired plan`
      : 'no paired amounts';
    return `${plannedPerDay} · ${actualPerDay}\n${matchedPercent} · ${value.recordedEntryCount}/${value.plannedEntryCount} drinks recorded`;
  };
  const activityHydrationValue = (value: typeof activityHydration[number]) => {
    const plannedPerDay = value.plannedDays ? `${liters(value.plannedMl / value.plannedDays)}/planned day` : '— plan';
    const actualPerDay = value.actualMl !== null && value.actualDays
      ? `${liters(value.actualMl / value.actualDays)}/logged day`
      : '— actual';
    const matchedPercent = value.actualMl !== null && value.plannedForRecordedMl > 0
      ? `${(value.actualMl / value.plannedForRecordedMl * 100).toFixed(0)}% paired`
      : 'no paired amounts';
    return `${plannedPerDay} · ${actualPerDay}\n${matchedPercent} · n=${value.elapsedDays} days · ${value.plannedDays} planned / ${value.actualDays} recorded days`;
  };
  const activityDateRows = (items: typeof records, group: 'active' | 'rest') =>
    hydrationActivityRecords(items.filter(record => !record.loading && !record.failed), group, today());
  const activityName = (record: HydrationActivityRecord, group: 'active' | 'rest') =>
    group === 'rest' ? 'Rest day' : (record.tennis?.sessions ?? [])
      .filter(session => session.kind === 'practice' || session.kind === 'match')
      .map(session => `${session.kind === 'practice' ? 'Practice' : 'Match'} · ${session.startTime} · ${session.durationMinutes} min`)
      .join(' / ');
  const hydrationMonthDetails = (value: typeof hydrationSummary) =>
    `${value.plannedEntryCount ? `${liters(value.plannedMl)} planned across ${value.plannedDays} days` : 'No drink entries planned'} · ` +
    `${value.actualMl === null ? 'no actual amounts recorded' : `${liters(value.actualMl)} recorded of ${liters(value.plannedForRecordedMl)} planned for recorded drinks`} · ` +
    `${value.recordedEntryCount}/${value.plannedEntryCount} drinks recorded · no entries saved on ${value.noEntryDays}/${value.elapsedDays} days`;
  const volumeDelta = (milliliters: number | null) => milliliters === null
    ? 'unavailable'
    : Math.abs(milliliters) < 1 ? 'no change' : `${milliliters > 0 ? '+' : '−'}${liters(Math.abs(milliliters))}/day`;
  const recordedVsPlanned = (percent: number | null) => percent === null ? 'unavailable' : `${percent.toFixed(0)}%`;
  const durationDelta = summary.averageMinutes === null || comparisonSummary.averageMinutes === null
    ? 'unavailable'
    : summary.averageMinutes === comparisonSummary.averageMinutes ? 'no change'
      : `${summary.averageMinutes > comparisonSummary.averageMinutes ? '+' : '−'}${formatSleepDuration(Math.abs(summary.averageMinutes - comparisonSummary.averageMinutes))}`;
  const qualityDelta = summary.averageQuality === null || comparisonSummary.averageQuality === null
    ? 'unavailable'
    : `${summary.averageQuality === comparisonSummary.averageQuality ? '' : summary.averageQuality > comparisonSummary.averageQuality ? '+' : '−'}${Math.abs(summary.averageQuality - comparisonSummary.averageQuality).toFixed(1)} points`;
  const movePeriod = (amount: number) => {
    if (rangeMode === 'week') moveWeek(amount);
    else setMonth(current => shiftSleepMonth(current, amount));
  };
  const resetMonthComparison = () => {
    const selection = sleepMonthSelectionForPlannerDate(date);
    setMonth(selection.month);
    setComparisonMonth(selection.comparisonMonth);
  };
  const selectRangeMode = (value: string) => {
    if (value === 'week' || value === 'month') setPreferredRangeMode(value);
    if (value === 'week' || value === 'month' || value === 'quality-range') {
      setRangeMode(value);
    }
  };
  const liters = (milliliters: number) => `${(milliliters / 1000).toFixed(2)} L`;

  return <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 8 }}>
    <Text style={{ fontFamily: F.bold, color: c.foreground }}>Sleep patterns</Text>
    <Chips testPrefix="select-sleep-summary-range" value={rangeMode} onChange={selectRangeMode}
      options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'quality-range', label: 'Multi-month' }]} />
    {rangeMode === 'month' ? monthSelectionReady ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MonthField label="Month to review" value={month} onChangeText={setMonth} testID="select-sleep-month" />
        <MonthField label="Compare with" value={comparisonMonth} onChangeText={setComparisonMonth} testID="select-sleep-comparison-month" />
      </View>
      <Btn small variant="ghost" icon="rotate-ccw" label="Reset to Planner month"
        accessibilityLabel="Reset monthly sleep comparison to the selected Planner date"
        accessibilityHint="Sets the comparison month to the month before the selected Planner date."
        testID="button-reset-sleep-month-comparison" onPress={resetMonthComparison} />
    </> : <Muted>Loading this person’s saved month selections…</Muted> : null}
    {rangeMode === 'quality-range' ? <View style={{ flexDirection: 'row', gap: 8 }}>
      <MonthField label="Start month" value={qualityRangeStart} onChangeText={setQualityRangeStart} testID="select-sleep-quality-start-month" />
      <MonthField label="End month" value={qualityRangeEnd} onChangeText={setQualityRangeEnd} testID="select-sleep-quality-end-month" />
    </View> : null}
    {rangeMode === 'quality-range' ? <Muted>Monthly sleep and hydration comparisons · up to 10 years</Muted> : null}
    {rangeMode === 'week' || (rangeMode === 'month' && monthSelectionReady) ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      <Btn small variant="ghost" label={`Previous ${rangeMode}`} testID={`button-sleep-previous-${rangeMode}`} onPress={() => movePeriod(-1)} />
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground, textAlign: 'center', flex: 1 }}>{periodTitle}</Text>
      <Btn small variant="ghost" label={`Next ${rangeMode}`} testID={`button-sleep-next-${rangeMode}`} onPress={() => movePeriod(1)} />
    </View> : null}
    {rangeMode !== 'quality-range' && monthPreferenceError ? <Muted>{monthPreferenceError}</Muted> : null}
    {rangeMode === 'quality-range' ? !qualityRangeValid ? <Muted>Choose a valid range of up to 10 years, with the start month on or before the end month.</Muted> :
      <View style={{ gap: 8 }}>
        {qualityRangeRecords.isLoading ? <Muted>Loading sleep-quality history…</Muted> :
          qualityRangeRecords.isError ? <Muted>Sleep-quality history could not be loaded.</Muted> :
          <View testID="sleep-quality-trend" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 7 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>Month-by-month sleep quality</Text>
            <Muted>Average self-reported rating and counts include only saved ratings from 1–5. Missing dates and unrated records are excluded.</Muted>
            {qualitySummaries.map(item => {
              const isExpanded = expandedQualityMonth === item.month;
              const savedRecords = qualityDetailRecords.get(item.month) ?? [];
              const unratedCount = savedRecords.filter(record => !isValidSleepQuality(record.sleep.quality)).length;
              return <View key={item.month} testID={`sleep-quality-month-${item.month}`} style={{
                borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, gap: 3,
              }}>
                <Pressable
                  testID={`button-toggle-sleep-quality-month-${item.month}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpanded ? 'Hide' : 'Open'} saved sleep records for ${monthTitle(item.month)}`}
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => {
                    tap();
                    setExpandedQualityMonth(current => current === item.month ? null : item.month);
                  }}
                  style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontFamily: F.semi, color: c.foreground }}>{monthTitle(item.month)}</Text>
                  <Muted>{item.averageQuality === null ? 'No past quality ratings.' :
                    `Average rating ${item.averageQuality.toFixed(1)}/5 · ${item.ratedDays} ${item.ratedDays === 1 ? 'rating' : 'ratings'}`}</Muted>
                  <Muted>Rating counts (1–5): {item.qualityCounts.map((count, index) => `${index + 1}: ${count}`).join(' · ')}</Muted>
                  <Muted>{savedRecords.length} saved {savedRecords.length === 1 ? 'record' : 'records'} · {unratedCount} without a valid rating</Muted>
                  <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.primary }}>
                    {isExpanded ? 'Hide saved dates' : 'View saved dates'}
                  </Text>
                </Pressable>
                {isExpanded ? <View testID={`sleep-quality-records-${item.month}`} style={{
                  borderTopWidth: 1, borderTopColor: c.border, paddingTop: 5, gap: 5,
                }}>
                  {savedRecords.length ? savedRecords.map(record => {
                    const quality = record.sleep.quality;
                    const rated = isValidSleepQuality(quality);
                    const minutes = calculateTotalSleepMinutes(record.sleep);
                    const dateLabel = prettyDate(record.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                    return <Pressable
                      key={record.date}
                      testID={`button-open-sleep-quality-record-${record.date}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Open sleep record for ${dateLabel} in Planner, ${rated ? `rated ${quality} out of 5` : 'not rated'}`}
                      accessibilityHint="Selects this date for the active person in Planner and loads its saved sleep record."
                      onPress={() => {
                        tap();
                        setExpandedDate(record.date);
                        onSelectDate(record.date);
                      }}
                      style={({ pressed }) => ({
                        borderTopWidth: 1, borderTopColor: c.border, borderLeftWidth: 3,
                        borderLeftColor: record.date === date ? c.primary : c.border,
                        backgroundColor: record.date === date ? c.card : 'transparent',
                        paddingTop: 6, paddingLeft: 8, paddingRight: 5, gap: 2, opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                        <Text style={{ fontFamily: F.semi, color: c.foreground }}>
                          {prettyDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={{ fontFamily: F.semi, color: rated ? c.primary : c.muted, textAlign: 'right' }}>
                          {rated ? `Rated ${quality}/5` : 'Not rated · excluded'}
                        </Text>
                      </View>
                      <Muted>{minutes === null ? 'Duration unavailable' : `Duration ${formatSleepDuration(minutes)}`}</Muted>
                      <Muted>{record.sleep.note.trim() || 'No notes saved for this date.'}</Muted>
                      {record.date === date ? <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.primary }}>Selected Planner date</Text> : null}
                    </Pressable>;
                  }) : <Muted>No saved sleep records for this month. Missing dates are not listed or included in the average.</Muted>}
                  {savedRecords.length ? <Muted>Only saved dates appear here. Unrated records are visible but excluded from the average; missing dates have no saved record.</Muted> : null}
                </View> : null}
              </View>;
            })}
          </View>}
        {qualityRangeRecords.isLoading ? <Muted>Loading activity-grouped sleep ratings…</Muted> :
          qualityRangeRecords.isError ? <Muted>Activity-grouped sleep ratings could not be loaded.</Muted> :
            <View testID="sleep-quality-activity-comparison" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 7 }}>
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Sleep ratings by practice, match, and rest days</Text>
              <Muted>Practice and match days require a saved tennis session of that type. Rest days use the saved Rest activity or tennis Rest mode, unless a practice or match is also saved. Other activity days are excluded. Only valid ratings from 1–5 count. These are descriptive comparisons and do not show that activity caused a sleep rating.</Muted>
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Whole selected range</Text>
              {sleepActivityRangeSummaries.map(value => <View key={value.group} testID={`sleep-quality-activity-range-${value.group}`} style={{ gap: 2 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{sleepActivityGroupTitle(value.group)}</Text>
                <Muted>{sleepActivityRatingLine(value)}</Muted>
                <Muted>{sleepActivityCountsLine(value)}</Muted>
              </View>)}
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Month by month</Text>
              {sleepActivityMonthSummaries.map(({ month: summaryMonth, summaries }) => <View key={summaryMonth}
                testID={`sleep-quality-activity-month-${summaryMonth}`}
                style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, gap: 4 }}>
                <Text style={{ fontFamily: F.semi, color: c.foreground }}>{monthTitle(summaryMonth)}</Text>
                {summaries.map(value => <View key={value.group} testID={`sleep-quality-activity-month-${summaryMonth}-${value.group}`} style={{ gap: 2 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{sleepActivityGroupTitle(value.group)}</Text>
                  <Muted>{sleepActivityRatingLine(value)}</Muted>
                  <Muted>{sleepActivityCountsLine(value)}</Muted>
                </View>)}
              </View>)}
            </View>}
        {hydrationActivityRangeRecords.isLoading ? <Muted>Loading hydration activity history…</Muted> :
          hydrationActivityRangeRecords.isError ? <Muted>Hydration activity history could not be loaded.</Muted> :
            <View testID="hydration-activity-range" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 7 }}>
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Hydration on practice/match vs rest days</Text>
              <Muted>Compare each month and the whole selected range. Planned amounts average over planned days; actual amounts average over days with entries recorded. Paired percentages use only drinks with an actual amount. This summarizes logs, not fluid targets.</Muted>
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Whole selected range</Text>
              {hydrationActivityRangeSummary.map(value => <View key={value.group} testID={`hydration-activity-range-group-${value.group}`} style={{ gap: 2 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>
                  {value.group === 'active' ? 'Practice / match activity days' : 'Rest days'}
                </Text>
                <Muted>{value.elapsedDays ? activityHydrationValue(value) : 'No past dates in the selected range yet.'}</Muted>
              </View>)}
              <Text style={{ fontFamily: F.semi, color: c.foreground }}>Month by month</Text>
              {hydrationActivityMonthSummaries.map(({ month: summaryMonth, summaries }) => <View key={summaryMonth}
                testID={`hydration-activity-range-month-${summaryMonth}`}
                style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, gap: 4 }}>
                <Text style={{ fontFamily: F.semi, color: c.foreground }}>{monthTitle(summaryMonth)}</Text>
                {summaries.map(value => <View key={value.group} testID={`hydration-activity-range-month-${summaryMonth}-${value.group}`} style={{ gap: 2 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>
                    {value.group === 'active' ? 'Practice / match activity days' : 'Rest days'}
                  </Text>
                  <Muted>{value.elapsedDays ? activityHydrationValue(value) : 'No past dates in this month yet.'}</Muted>
                </View>)}
              </View>)}
            </View>}
      </View> :
    rangeMode === 'month' && !monthSelectionReady ? <Muted>Loading the selected month comparison…</Muted> :
      periodLoading ? <Muted>Loading sleep records…</Muted> : periodFailed ? <Muted>Some dates could not be loaded. Try reopening this range.</Muted> :
      rangeMode === 'month' ? <View testID="sleep-month-comparison" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 5 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>Month comparison</Text>
        {comparisonMonth === month ? <Muted>Choose a different month to compare against.</Muted> :
          comparisonPeriodLoading ? <Muted>Loading {monthTitle(comparisonMonth)}…</Muted> :
            comparisonPeriodFailed ? <Muted>{monthTitle(comparisonMonth)} records could not be loaded.</Muted> : <>
          <Text style={{ fontFamily: F.semi, color: c.foreground }}>{monthTitle(month)}</Text>
          <Muted>{summary.elapsedDays ? monthCounts(summary) : 'No past dates in this month yet.'}</Muted>
          <Muted>{monthAverages(summary)}</Muted>
          <Muted>{qualityDistribution(summary)}</Muted>
          <Text style={{ fontFamily: F.semi, color: c.foreground }}>Hydration</Text>
          <Muted>{hydrationMonthDetails(hydrationSummary)}</Muted>
          <Text style={{ fontFamily: F.semi, color: c.foreground }}>{monthTitle(comparisonMonth)}</Text>
          <Muted>{comparisonSummary.elapsedDays ? monthCounts(comparisonSummary) : 'No past dates in this month yet.'}</Muted>
          <Muted>{monthAverages(comparisonSummary)}</Muted>
          <Muted>{qualityDistribution(comparisonSummary)}</Muted>
          <Text style={{ fontFamily: F.semi, color: c.foreground }}>Hydration</Text>
          <Muted>{hydrationMonthDetails(comparisonHydrationSummary)}</Muted>
          <View testID="sleep-weekday-quality-comparison" style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, marginTop: 3, gap: 4 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>Mean sleep quality by weekday</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 10, color: c.muted }}>Day</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(month)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(comparisonMonth)}</Text>
            </View>
            {weekdayQuality.map((daySummary, index) => <View key={daySummary.weekday} testID={`sleep-weekday-quality-${daySummary.weekday}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][daySummary.weekday]}</Text>
              {[daySummary, comparisonWeekdayQuality[index]].map((value, monthIndex) => <View key={monthIndex} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.regular, fontSize: 11, color: c.foreground }}>{weekdayQualityAverage(value)}</Text>
                <Text testID={`sleep-weekday-quality-counts-${monthIndex}-${daySummary.weekday}`} style={{ fontFamily: F.regular, fontSize: 9, color: c.muted, textAlign: 'center' }}>{weekdayQualityCounts(value)}</Text>
              </View>)}
            </View>)}
            <Muted>Mean /5 · n valid ratings. Counts below are scores 1–5; missing, unrated, and invalid scores are excluded.</Muted>
          </View>
          <View testID="sleep-weekday-duration-comparison" style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, marginTop: 3, gap: 4 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>Mean sleep duration by weekday</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 10, color: c.muted }}>Day</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(month)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(comparisonMonth)}</Text>
            </View>
            {weekdayDuration.map((daySummary, index) => <View key={daySummary.weekday} testID={`sleep-weekday-duration-${daySummary.weekday}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][daySummary.weekday]}</Text>
              {[daySummary, comparisonWeekdayDuration[index]].map((value, monthIndex) => <Text key={monthIndex}
                testID={`sleep-weekday-duration-value-${monthIndex}-${daySummary.weekday}`}
                style={{ flex: 1, textAlign: 'center', fontFamily: F.regular, fontSize: 10, color: c.foreground }}>
                {weekdayDurationAverage(value)}
              </Text>)}
            </View>)}
            <Muted>Mean duration · n valid overnight or nap-only records. Missing and invalid durations are excluded.</Muted>
          </View>
          <View testID="hydration-weekday-comparison" style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, marginTop: 3, gap: 4 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>Hydration by weekday</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 10, color: c.muted }}>Day</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(month)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 10, color: c.muted }}>{monthTitle(comparisonMonth)}</Text>
            </View>
            {weekdayHydration.map((daySummary, index) => <View key={daySummary.weekday} testID={`hydration-weekday-${daySummary.weekday}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ width: 34, fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][daySummary.weekday]}</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.regular, fontSize: 9, color: c.foreground }}>{weekdayHydrationValue(daySummary)}</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.regular, fontSize: 9, color: c.foreground }}>{weekdayHydrationValue(comparisonWeekdayHydration[index])}</Text>
            </View>)}
            <Muted>Plan averages use days with a plan; actual averages use days with amounts entered. Recorded-to-plan excludes drinks without actuals. This is a log comparison, not a fluid target.</Muted>
          </View>
          <View testID="hydration-activity-comparison" style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, marginTop: 3, gap: 5 }}>
            <Text style={{ fontFamily: F.semi, color: c.foreground }}>Hydration on activity vs rest days</Text>
            {activityHydration.map((value, index) => <View key={value.group} testID={`hydration-activity-${value.group}`} style={{ gap: 2 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>
                {value.group === 'active' ? 'Practice / match activity days' : 'Rest days'}
              </Text>
              <Muted>{monthTitle(month)}: {activityHydrationValue(value)}</Muted>
              <Muted>{monthTitle(comparisonMonth)}: {activityHydrationValue(comparisonActivityHydration[index])}</Muted>
              <Btn small variant="ghost" label={expandedActivityGroup === value.group ? 'Hide dates' : 'Show dates'}
                testID={`button-hydration-activity-dates-${value.group}`}
                onPress={() => setExpandedActivityGroup(expandedActivityGroup === value.group ? null : value.group)} />
              {expandedActivityGroup === value.group ? <View testID={`hydration-activity-dates-${value.group}`} style={{ gap: 6 }}>
                {[{ title: monthTitle(month), items: records }, { title: monthTitle(comparisonMonth), items: comparisonRecords }].map(period => {
                  const matches = activityDateRows(period.items, value.group);
                  return <View key={period.title} style={{ gap: 4 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.foreground }}>{period.title}</Text>
                    {period.items.some(record => record.loading) ? <Muted>Loading some dates…</Muted> : null}
                    {period.items.some(record => record.failed) ? <Muted>Some dates could not be loaded.</Muted> : null}
                    {matches.map(record => {
                      const entries = record.hydration?.entries ?? [];
                      const plannedMl = entries.reduce((sum, entry) => sum + entry.plannedMl, 0);
                      const entered = entries.filter(entry => entry.actualMl !== null);
                      const actualMl = entered.reduce((sum, entry) => sum + (entry.actualMl ?? 0), 0);
                      return <Pressable key={record.date} testID={`hydration-activity-date-${value.group}-${record.date}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${prettyDate(record.date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${activityName(record, value.group)} in Planner`}
                        onPress={() => onSelectDate(record.date)}
                        style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 8, gap: 2 }}>
                        <Text style={{ fontFamily: F.semi, color: c.foreground }}>{prettyDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                        <Muted>{activityName(record, value.group)}</Muted>
                        <Muted>{entries.length ? `Planned ${liters(plannedMl)}` : 'No hydration entries saved'} · recorded {entered.length ? `${liters(actualMl)} (${entered.length}/${entries.length} drinks)` : `not entered (0/${entries.length} drinks)`}</Muted>
                      </Pressable>;
                    })}
                    {!matches.length && !period.items.some(record => record.loading || record.failed) ? <Muted>No matching saved dates.</Muted> : null}
                  </View>;
                })}
              </View> : null}
            </View>)}
            <Muted>Practice/match days use this person’s saved tennis sessions; rest days use the saved Rest activity. Other activity days without a tennis practice or match are excluded. Averages use days with plans or recorded amounts; paired percentages exclude drinks without actual amounts. These are log comparisons, not fluid targets.</Muted>
          </View>
          <Muted>Change: duration {durationDelta} · quality {qualityDelta} versus {monthTitle(comparisonMonth)}.</Muted>
          <Muted>Hydration change versus {monthTitle(comparisonMonth)}: planned per planned day {volumeDelta(hydrationComparison.plannedPerPlannedDayChangeMl)} · recorded per day with actual entries {volumeDelta(hydrationComparison.recordedPerRecordedDayChangeMl)} · recorded/planned for drinks with actuals {recordedVsPlanned(hydrationComparison.currentRecordedVsPlannedPercent)} vs {recordedVsPlanned(hydrationComparison.comparisonRecordedVsPlannedPercent)}. This is a log comparison, not a hydration target.</Muted>
          <Muted>Missing dates are shown separately and excluded from averages.</Muted>
        </>}
      </View> : summary.elapsedDays === 0 ? <Muted>No past dates in this range yet.</Muted> : <>
        <Muted>{monthCounts(summary)}</Muted>
        <Muted>{monthAverages(summary)}. Missing dates are excluded from averages.</Muted>
      </>}
    <Muted>Tap a date to load its sleep record in the Planner. Saved records stay attached to their original dates.</Muted>
    {!dateOfBirth ? <Muted>Add the person’s date of birth in Settings to compare logged nights with age-based ranges.</Muted> : null}
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 6 }}>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Find sleep notes by words or quality</Text>
      <Field label="Search this person’s saved sleep notes" value={noteSearch} onChangeText={setNoteSearch} placeholder="Search words in notes" maxLength={100} testID="input-sleep-note-search" />
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Quality rating · select any that match</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {sleepNoteQualityChoices.map(choice => {
          const selected = noteQualityFilters.includes(choice.value);
          return <Pressable key={choice.value} testID={`button-sleep-note-quality-${choice.value}`}
            accessibilityRole="button" accessibilityLabel={`Filter by sleep quality ${choice.label}`}
            accessibilityState={{ selected }}
            onPress={() => {
              tap();
              setNoteQualityFilters(current => current.includes(choice.value)
                ? current.filter(value => value !== choice.value)
                : [...current, choice.value].sort((a, b) => a - b));
            }}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: selected ? c.primary : c.secondary, borderWidth: 1,
              borderColor: selected ? c.primary : c.border }}>
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: selected ? c.primaryForeground : c.foreground }}>{choice.label}</Text>
          </Pressable>;
        })}
      </View>
      <Muted>Choose one or more ratings. When you also search words, both filters apply.</Muted>
      {noteFiltersActive ? <Btn small variant="ghost" label="Clear filters" testID="button-clear-sleep-note-filters"
        onPress={() => { setNoteSearch(''); setNoteQualityFilters([]); }} /> : null}
      {!noteFiltersActive ? <Muted>Search notes or filter rated sleep logs for this person. Your normal date-based review stays below.</Muted> :
        noteSearchPending ? <Muted>Searching saved sleep logs…</Muted> :
        noteResults.isLoading ? <Muted>Searching saved notes…</Muted> :
          noteResults.isError ? <ErrorBox error={noteResults.error} /> :
            noteResults.data?.length ? noteResults.data.map(result => <Pressable
              key={result.date}
              testID={`button-sleep-note-result-${result.date}`}
              accessibilityRole="button"
              accessibilityLabel={`Open sleep record from ${result.date}, rated ${result.sleep.quality} out of 5`}
              onPress={() => {
                tap();
                setExpandedDate(result.date);
                onSelectDate(result.date);
              }}
              style={({ pressed }) => ({
                borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: F.semi, color: c.primary }}>{result.date} · {formatSleepDuration(calculateTotalSleepMinutes(result.sleep) ?? 0)} · {result.sleep.quality}/5</Text>
              <Muted>{result.sleep.note.trim() || 'No note saved for this date.'}</Muted>
            </Pressable>) : <Muted>{noteSearch.trim() && noteQualityFilters.length
              ? 'No saved sleep logs match this text and rating selection.'
              : noteQualityFilters.length ? 'No saved sleep logs match these ratings.'
                : `No saved sleep notes match “${noteSearch.trim()}”.`}</Muted>}
    </View>
    {rangeMode === 'month' ? !monthSelectionReady ? <Muted>Loading the selected month breakdown…</Muted> : <View testID="sleep-month-weekly-breakdown" style={{ gap: 7 }}>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Week-by-week sleep & hydration</Text>
      {periodLoading || periodFailed ? <Muted>{periodLoading ? 'Loading weekly records…' : 'Weekly summaries unavailable because some dates could not be loaded.'}</Muted> :
         weeklySummaries.map((week, index) => {
           const isExpanded = expandedHydrationWeek === week.startDate;
           return <View key={week.startDate} testID={`sleep-month-week-${week.startDate}`} style={{
             borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 9, gap: 3,
           }}>
             <Text style={{ fontFamily: F.semi, color: c.foreground }}>
               Week {index + 1} · {prettyDate(week.startDate, { month: 'short', day: 'numeric' })}–{prettyDate(week.endDate, { month: 'short', day: 'numeric' })}
               {week.partial ? ' · partial week' : ''}
             </Text>
             <Muted>{week.sleep.elapsedDays ? monthCounts(week.sleep) : 'No past sleep dates in this week yet.'}</Muted>
             <Muted>{monthAverages(week.sleep)}</Muted>
             {week.hydration.elapsedDays ? <>
               <Muted>Hydration: {week.hydration.plannedEntryCount ? `${liters(week.hydration.plannedMl)} planned across ${week.hydration.plannedDays} days` : 'no drink entries planned'}.</Muted>
               <Muted>{week.hydration.actualMl === null
                 ? 'No actual drink amounts recorded yet.'
                 : `${liters(week.hydration.actualMl)} recorded of ${liters(week.hydration.plannedForRecordedMl)} planned for those entries.`}
                 {` ${week.hydration.recordedEntryCount}/${week.hydration.plannedEntryCount} drink entries recorded; no entries saved on ${week.hydration.noEntryDays}/${week.hydration.elapsedDays} days.`}
               </Muted>
               <Pressable
                 testID={`button-hydration-week-dates-${week.startDate}`}
                 accessibilityRole="button"
                 accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} daily hydration amounts for week ${index + 1}`}
                 accessibilityState={{ expanded: isExpanded }}
                 onPress={() => {
                   tap();
                   setExpandedHydrationWeek(current => current === week.startDate ? null : week.startDate);
                 }}
                 style={({ pressed }) => ({ paddingVertical: 5, opacity: pressed ? 0.7 : 1 })}
               >
                 <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.primary }}>
                   {isExpanded ? 'Hide daily amounts' : 'Show daily amounts'}
                 </Text>
               </Pressable>
               {isExpanded ? <View testID={`hydration-week-dates-${week.startDate}`} style={{ gap: 5, paddingTop: 2 }}>
                 {week.hydrationDays.map(day => {
                   const noEntries = day.plannedEntryCount === 0;
                   const actualLabel = day.actualMl === null ? 'Not recorded' : `${liters(day.actualMl)} recorded`;
                   const status = noEntries
                     ? 'No drink entries'
                     : day.recordedEntryCount === 0
                       ? 'Planned drinks · no actual amounts entered'
                       : `${day.recordedEntryCount}/${day.plannedEntryCount} drinks recorded`;
                   return <View key={day.date} testID={`hydration-week-day-${day.date}`} style={{
                     borderTopWidth: 1, borderTopColor: c.border, paddingTop: 5, gap: 2,
                   }}>
                     <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground }}>
                       {prettyDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                     </Text>
                     <View style={{ flexDirection: 'row', gap: 8 }}>
                       <Text style={{ flex: 1, fontSize: 11, color: c.muted }}>Planned · {liters(day.plannedMl)}</Text>
                       <Text style={{ flex: 1, fontSize: 11, color: c.muted }}>Actual · {actualLabel}</Text>
                     </View>
                     <Muted>{status}</Muted>
                   </View>;
                 })}
               </View> : null}
             </> : <Muted>No past hydration dates in this week yet.</Muted>}
           </View>;
         })}
    </View> : null}
    {records.map(record => <Pressable
      key={record.date}
      testID={`button-open-sleep-date-${record.date}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${prettyDate(record.date, { weekday: 'long', month: 'long', day: 'numeric' })} sleep record in Planner`}
      accessibilityHint="Selects this date in the Planner and shows its saved sleep details."
      onPress={() => {
        tap();
        setExpandedDate(current => current === record.date ? null : record.date);
        onSelectDate(record.date);
      }}
      style={({ pressed }) => ({
        borderTopWidth: 1, borderTopColor: c.border, borderLeftWidth: 3,
        borderLeftColor: record.date === date ? c.primary : c.border,
        backgroundColor: record.date === date ? c.card : 'transparent',
        paddingTop: 7, paddingLeft: 8, paddingRight: 5, gap: 2, opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>
          {prettyDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={{ fontFamily: F.semi, color: c.foreground, textAlign: 'right' }}>
          {record.loading ? 'Loading…' : record.failed ? 'Could not load' : !record.sleep
            ? (record.date > today() ? 'Upcoming' : dateOfBirth && record.date < dateOfBirth ? 'No log · before DOB' : 'No log')
            : record.minutes === null ? `${record.napOnly ? 'Nap-only' : record.overnight ? 'Overnight' : 'Logged'} · duration unavailable`
              : `${formatSleepDuration(record.minutes)} · ${record.napOnly ? 'nap-only' : record.overnight ? 'overnight' : 'logged'} · ${record.sleep.quality}/5`}
        </Text>
      </View>
      {record.comparison ? <Muted>{record.comparison}{record.reference?.includesNaps ? ' · reference includes naps' : ''}</Muted> : null}
      {record.date === date ? <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.primary }}>Selected Planner date</Text> : null}
      {expandedDate === record.date ? <View testID={`sleep-details-${record.date}`} style={{ gap: 2, paddingTop: 4 }}>
        {record.loading ? <Muted>Loading sleep details…</Muted> : record.failed ? <Muted>Could not load this sleep record.</Muted> : record.sleep ? <>
          {record.sleep.bedtime && record.sleep.wakeTime
            ? <Muted>Overnight: {record.sleep.bedtime}–{record.sleep.wakeTime}</Muted>
            : <Muted>No overnight times recorded.</Muted>}
          {record.sleep.naps?.length
            ? <Muted>Naps: {record.sleep.naps.map(interval => `${interval.startTime}–${interval.endTime}`).join(', ')}</Muted>
            : null}
          {record.sleep.wakeUps?.length
            ? <Muted>Wake-ups: {record.sleep.wakeUps.map(interval => `${interval.startTime}–${interval.endTime}`).join(', ')}</Muted>
            : null}
          <Muted>Sleep quality: {record.sleep.quality}/5</Muted>
          {record.sleep.note.trim() ? <Muted>Notes: {record.sleep.note}</Muted> : <Muted>No notes saved.</Muted>}
        </> : <Muted>No sleep log is saved for this date yet. The Planner is set to this date.</Muted>}
      </View> : null}
    </Pressable>)}
    <Muted>Age-based daily ranges are a reference, not a diagnosis. Totals include entered naps and subtract entered wake-ups; unrecorded sleep is not inferred.</Muted>
  </View>;
}

export function SleepLogCard({ personId, personName, date, dateOfBirth, onSelectDate }: {
  personId: number;
  personName: string;
  date: string;
  dateOfBirth: string | null;
  onSelectDate: (date: string) => void;
}) {
  const c = useColors();
  const day = useGetDayActivity({ personId, date });
  const [sourceSelection, setSourceSelection] = useState(() => ({
    personId, targetDate: date, sourceDate: shiftDate(date, -1),
  }));
  const sourceDate = sourceSelection.personId === personId && sourceSelection.targetDate === date
    ? sourceSelection.sourceDate
    : shiftDate(date, -1);
  const sourceDay = useGetDayActivity({ personId, date: sourceDate });
  const sourceTimes = reusableSleepTimes(sourceDay.data?.sleep);
  const save = useSaveSleepRecord();
  const [routineState, setRoutineState] = useState<{
    personId: number | null;
    value: ReturnType<typeof reusableSleepTimes>;
    loading: boolean;
    error: string | null;
    errorKind: 'load' | 'save' | null;
  }>({ personId: null, value: null, loading: true, error: null, errorKind: null });
  const routine = routineState.personId === personId ? routineState.value : null;
  const routineLoading = routineState.personId !== personId || routineState.loading;
  const routineError = routineState.personId === personId && routineState.errorKind === 'load' ? routineState.error : null;
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineNotice, setRoutineNotice] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [quality, setQuality] = useState('unrated');
  const [note, setNote] = useState('');
  const [naps, setNaps] = useState<SleepInterval[]>([]);
  const [wakeUps, setWakeUps] = useState<SleepInterval[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const duration = sleepDurationMinutes(bedtime.trim() || null, wakeTime.trim() || null);
  const totalDuration = calculateTotalSleepMinutes({ bedtime: bedtime.trim() || null, wakeTime: wakeTime.trim() || null, naps, wakeUps });
  const hasOvernightInput = Boolean(bedtime.trim() || wakeTime.trim());
  const overnightPairValid = !hasOvernightInput || (Boolean(bedtime.trim() && wakeTime.trim()) && duration !== null);
  const wakeUpsValid = duration !== null || wakeUps.length === 0;
  const age = dateOfBirth ? getAgeOnDate(dateOfBirth, date) : null;
  const currentTimes = reusableSleepTimes({ bedtime: bedtime.trim(), wakeTime: wakeTime.trim() });

  useEffect(() => {
    let active = true;
    setRoutineState({ personId, value: null, loading: true, error: null, errorKind: null });
    sleepRoutinePreferences.load(personId).then(value => {
      if (active) setRoutineState({ personId, value, loading: false, error: null, errorKind: null });
    }).catch(problem => {
      if (active) setRoutineState({
        personId, value: null, loading: false,
        error: problem instanceof Error ? problem.message : String(problem),
        errorKind: 'load',
      });
    });
    return () => { active = false; };
  }, [personId]);

  useEffect(() => {
    if (!day.isSuccess) return;
    setBedtime(day.data.sleep?.bedtime ?? '');
    setWakeTime(day.data.sleep?.wakeTime ?? '');
    setQuality(day.data.sleep ? String(day.data.sleep.quality) : 'unrated');
    setNote(day.data.sleep?.note ?? '');
    setNaps(day.data.sleep?.naps?.map(interval => ({ ...interval })) ?? []);
    setWakeUps(day.data.sleep?.wakeUps?.map(interval => ({ ...interval })) ?? []);
    setError(null);
    setNotice('');
  }, [personId, date, day.data, day.isSuccess]);

  async function saveRecord() {
    setError(null);
    setNotice('');
    try {
      await save.mutateAsync({ data: {
        personId, date, sleep: {
          bedtime: bedtime.trim() || null, wakeTime: wakeTime.trim() || null, quality: Number(quality), note: note.trim(), naps, wakeUps,
        },
      } });
      setNotice(`Sleep record saved for ${date}.`);
    } catch (problem) { setError(problem); }
  }

  async function clearRecord() {
    setError(null);
    setNotice('');
    try {
      await save.mutateAsync({ data: { personId, date, sleep: null } });
      setNotice(`Sleep record removed for ${date}.`);
    } catch (problem) { setError(problem); }
  }

  function copySourceTimes() {
    if (!sourceTimes || sourceDate === date) return;
    setBedtime(sourceTimes.bedtime);
    setWakeTime(sourceTimes.wakeTime);
    setNotice(`Filled bedtime and wake time from ${sourceDate}. Review and save this date to keep them.`);
    setError(null);
  }

  function applyRoutine() {
    if (!routine) return;
    setBedtime(routine.bedtime);
    setWakeTime(routine.wakeTime);
    setRoutineNotice('Filled bedtime and wake time from your routine. Review and save this date to keep them.');
  }

  async function saveRoutine() {
    if (!currentTimes || routineSaving || routineLoading) return;
    setRoutineSaving(true);
    setRoutineNotice('');
    setRoutineState({ personId, value: routine, loading: false, error: null, errorKind: null });
    try {
      await sleepRoutinePreferences.save(personId, currentTimes);
      setRoutineState({ personId, value: currentTimes, loading: false, error: null, errorKind: null });
      setRoutineNotice('Bedtime and wake-time routine saved for this person.');
    } catch (problem) {
      setRoutineState({
        personId, value: routine, loading: false,
        error: problem instanceof Error ? problem.message : String(problem),
        errorKind: 'save',
      });
    } finally {
      setRoutineSaving(false);
    }
  }

  const canSave = totalDuration !== null && overnightPairValid && wakeUpsValid && quality !== 'unrated' && note.length <= 1000 && !save.isPending;
  return <Card>
    <Eyebrow>Sleep · {personName} · {date}</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>Sleep log for this date</Text>
    <Muted>Each date has its own sleep record. Enter both overnight times, or leave them blank and record naps only. Overlapping intervals count once.</Muted>
    {day.isLoading ? <Muted>Loading sleep record…</Muted> : day.isError ? <ErrorBox error={day.error} onRetry={() => day.refetch()} /> : <>
      <Muted>Source person: {personName}</Muted>
      <DateField label="Copy times from saved date" value={sourceDate}
        onChangeText={value => setSourceSelection({ personId, targetDate: date, sourceDate: value })}
        testID="input-sleep-copy-source-date" />
      <Muted>Choose any date with a saved bedtime and wake time for {personName}.</Muted>
      {sourceDay.isLoading ? <Muted>Checking {sourceDate} for sleep times…</Muted> : sourceDay.isError
        ? <ErrorBox error={sourceDay.error} onRetry={() => sourceDay.refetch()} />
        : sourceTimes && sourceDate === date
          ? <Muted>Select a different date; {date} is the date currently being edited.</Muted>
          : sourceTimes
            ? <Btn small variant="ghost" icon="copy" label={`Use times from ${sourceDate}`}
              testID="button-copy-sleep-times-from-date" onPress={copySourceTimes} />
          : <Muted>No overnight bedtime and wake time are saved for {sourceDate}. Choose a different date.</Muted>}
      <Muted>Only bedtime and wake time are copied. Ratings, notes, naps, and wake-ups stay unchanged.</Muted>
      <View testID="sleep-routine-controls" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, gap: 6 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>Reusable sleep routine</Text>
        <Muted>This routine is saved on this device for {personName}, separately from dated sleep logs.</Muted>
        {routineLoading ? <Muted>Loading this person’s sleep routine…</Muted> :
          routine ? <>
            <Muted>Saved: {routine.bedtime} bedtime · {routine.wakeTime} wake time</Muted>
            <Btn small variant="ghost" icon="copy" label="Apply routine"
              testID="button-apply-sleep-routine" onPress={applyRoutine} />
          </> : <Muted>No routine saved for {personName}.</Muted>}
        <Btn small variant="ghost" icon="check" label={routine ? 'Update routine from these times' : 'Save these times as a routine'}
          loading={routineSaving} disabled={routineLoading || routineSaving || !currentTimes}
          testID="button-save-sleep-routine" onPress={() => void saveRoutine()} />
        {routineError ? <Muted>Could not load this person’s sleep routine. {routineError}</Muted> : null}
        {routineState.personId === personId && routineState.errorKind === 'save' && routineState.error
          ? <Muted>Could not save this person’s sleep routine. {routineState.error}</Muted> : null}
        {routineNotice ? <Muted>{routineNotice}</Muted> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><TimeField label="Bedtime (24-hour)" value={bedtime} onChangeText={setBedtime} placeholder="22:30" testID="input-sleep-bedtime" /></View>
        <View style={{ flex: 1 }}><TimeField label="Wake time (24-hour)" value={wakeTime} onChangeText={setWakeTime} placeholder="06:45" testID="input-sleep-wake-time" /></View>
      </View>
      {duration !== null ? <Muted>Overnight duration: <Text style={{ fontFamily: F.semi, color: c.foreground }}>{formatSleepDuration(duration)}</Text></Muted> :
        <Muted>Overnight times are optional. Enter both together, or leave both blank for a nap-only record.</Muted>}
      <SleepIntervalEditor label="Naps (optional)" testPrefix="nap" intervals={naps} onChange={setNaps} startHint="13:00" endHint="14:00" maxEntries={10} />
      {duration !== null || wakeUps.length > 0
        ? <SleepIntervalEditor label="Overnight wake-ups (optional)" testPrefix="wake-up" intervals={wakeUps} onChange={setWakeUps} startHint="02:00" endHint="02:15" maxEntries={20} />
        : <Muted>Overnight wake-ups can be added when both overnight times are entered.</Muted>}
      {totalDuration !== null ? <Muted>Total recorded sleep{duration === null ? ' from naps' : ' after wake-ups and overlapping intervals are accounted for'}: <Text style={{ fontFamily: F.semi, color: c.foreground }}>{formatSleepDuration(totalDuration)}</Text></Muted> :
        hasOvernightInput ? <Muted>Enter both valid overnight times, or clear them and add at least one valid nap.</Muted> :
          <Muted>Add at least one valid nap or enter overnight times to calculate total sleep.</Muted>}
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Sleep quality</Text>
      <Chips testPrefix="select-sleep-quality" value={quality} onChange={setQuality} options={qualityChoices} />
      <Field label="Notes (optional)" value={note} onChangeText={setNote} placeholder="Anything to remember about this night" maxLength={1000} multiline testID="input-sleep-note" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn icon="check" label="Save sleep" loading={save.isPending} disabled={!canSave} testID="button-save-sleep-log" onPress={() => void saveRecord()} />
        {day.data?.sleep ? <Btn small variant="ghost" label="Clear date" disabled={save.isPending} testID="button-clear-sleep-log" onPress={() => void clearRecord()} /> : null}
      </View>
      {notice ? <Muted>{notice}</Muted> : null}
      {error ? <ErrorBox error={error} /> : null}
    </>}
    <SleepWeekSummary personId={personId} date={date} dateOfBirth={dateOfBirth} onSelectDate={onSelectDate} />
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 6 }}>
      <Text style={{ fontFamily: F.bold, color: c.foreground }}>Sleep goals that support steady progress</Text>
      <Muted>{sleepRange(age)}</Muted>
      <Muted>Regular, sufficient sleep is linked with attention, learning, memory, mood, and physical and mental health. Athletes can use their age-based range as a starting point; these sources do not set a separate athlete target.</Muted>
      <Muted>Try a consistent bedtime and wake time, a quiet and cool room, and turning screens off at least 30 minutes before bed. Avoid caffeine in the afternoon or evening.</Muted>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.cdc.gov/sleep/about/index.html')}
        style={{ color: c.primary, fontFamily: F.semi }}>Source: CDC, About Sleep (updated May 15, 2024)</Text>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.aasm.org/resources/pdf/pediatricsleepdurationconsensus.pdf')}
        style={{ color: c.primary, fontFamily: F.semi }}>Source: AASM pediatric sleep-duration consensus (2016)</Text>
    </View>
  </Card>;
}
