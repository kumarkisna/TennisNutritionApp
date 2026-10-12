import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useDayActivitiesForDates, useGetDayActivity, useSaveSleepRecord, useSearchSleepNotes } from '@/lib/local-api';
import { getAgeOnDate } from '@/lib/planning-targets';
import { shiftDate, today } from '@/lib/format';
import type { SleepInterval } from '@/lib/local-models';
import { calculateTotalSleepMinutes, formatSleepDuration, reusableSleepTimes, sleepDurationMinutes, sleepReferenceForDate, sleepWeekDates } from '@/lib/sleep-tracking';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, Muted, tap } from '@/components/ui';

const qualityChoices = [
  { value: 'unrated', label: 'Choose rating' },
  { value: '1', label: '1 · Poor' },
  { value: '2', label: '2' },
  { value: '3', label: '3 · OK' },
  { value: '4', label: '4' },
  { value: '5', label: '5 · Great' },
];

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
        <Field label={`Start ${index + 1}`} value={interval.startTime} onChangeText={value => onChange(intervals.map((item, i) => i === index ? { ...item, startTime: value } : item))} placeholder={startHint} maxLength={5} keyboardType="numbers-and-punctuation" testID={`input-${testPrefix}-${index}-start`} />
      </View>
      <View style={{ flex: 1 }}>
        <Field label={`End ${index + 1}`} value={interval.endTime} onChangeText={value => onChange(intervals.map((item, i) => i === index ? { ...item, endTime: value } : item))} placeholder={endHint} maxLength={5} keyboardType="numbers-and-punctuation" testID={`input-${testPrefix}-${index}-end`} />
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState('');
  const [settledNoteSearch, setSettledNoteSearch] = useState('');
  useEffect(() => { setWeekStart(sleepWeekDates(date)[0] ?? date); }, [date]);
  useEffect(() => {
    const timer = setTimeout(() => setSettledNoteSearch(noteSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [noteSearch]);
  const dates = useMemo(() => sleepWeekDates(weekStart), [weekStart]);
  const days = useDayActivitiesForDates(personId, dates);
  const noteResults = useSearchSleepNotes(personId, settledNoteSearch);
  const records = dates.map((dayDate, index) => {
    const sleep = days[index]?.data?.sleep;
    const minutes = sleep ? calculateTotalSleepMinutes(sleep) : null;
    const reference = sleepReferenceForDate(dateOfBirth, dayDate);
    const comparison = minutes === null ? null : reference === null ? 'Add date of birth for an age-based comparison.' :
      minutes < reference.minMinutes ? `Below daily reference (${reference.label})` :
        reference.maxMinutes !== null && minutes > reference.maxMinutes ? `Above daily reference (${reference.label})` :
          `Within daily reference (${reference.label})`;
    return {
      date: dayDate, sleep, minutes, reference, comparison, loading: days[index]?.isLoading ?? true,
      napOnly: sleep?.bedtime === null && sleep?.wakeTime === null,
    };
  });
  const logged = records.filter(record => record.minutes !== null);
  const averageMinutes = logged.length ? Math.round(logged.reduce((sum, record) => sum + record.minutes!, 0) / logged.length) : null;
  const averageQuality = logged.length ? logged.reduce((sum, record) => sum + (record.sleep?.quality ?? 0), 0) / logged.length : null;
  const elapsedDays = records.filter(record => record.date <= today()).length;
  const moveWeek = (amount: number) => {
    const start = new Date(`${weekStart}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + amount * 7);
    setWeekStart(start.toISOString().slice(0, 10));
  };
  const prettyDate = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });

  return <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 8 }}>
    <Text style={{ fontFamily: F.bold, color: c.foreground }}>This week’s sleep</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      <Btn small variant="ghost" label="Previous week" testID="button-sleep-previous-week" onPress={() => moveWeek(-1)} />
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.foreground }}>
        {prettyDate(dates[0], { month: 'short', day: 'numeric' })} – {prettyDate(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
      <Btn small variant="ghost" label="Next week" testID="button-sleep-next-week" onPress={() => moveWeek(1)} />
    </View>
    <Muted>{elapsedDays === 0 ? 'Upcoming week' : `${logged.filter(record => record.date <= today()).length}/${elapsedDays} dates logged`}
      {averageMinutes !== null ? ` · average ${formatSleepDuration(averageMinutes)} · quality ${averageQuality?.toFixed(1)}/5` : ''}</Muted>
    <Muted>Tap a date to load its sleep record in the Planner. Saved records stay attached to their original dates.</Muted>
    {!dateOfBirth ? <Muted>Add the person’s date of birth in Settings to compare logged nights with age-based ranges.</Muted> : null}
    <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 6 }}>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>Find a sleep note</Text>
      <Field label="Search this person’s saved sleep notes" value={noteSearch} onChangeText={setNoteSearch} placeholder="Search words in notes" maxLength={100} testID="input-sleep-note-search" />
      {noteSearch.trim() ? <Btn small variant="ghost" label="Clear search" testID="button-clear-sleep-note-search" onPress={() => setNoteSearch('')} /> : null}
      {!noteSearch.trim() ? <Muted>Search notes saved on any date for this person.</Muted> :
        noteSearch.trim().toLowerCase() !== settledNoteSearch.toLowerCase() ? <Muted>Searching saved notes…</Muted> :
        noteResults.isLoading ? <Muted>Searching saved notes…</Muted> :
          noteResults.isError ? <ErrorBox error={noteResults.error} /> :
            noteResults.data?.length ? noteResults.data.map(result => <Pressable
              key={result.date}
              testID={`button-sleep-note-result-${result.date}`}
              accessibilityRole="button"
              accessibilityLabel={`Open sleep note from ${result.date}: ${result.sleep.note}`}
              onPress={() => {
                tap();
                setExpandedDate(result.date);
                onSelectDate(result.date);
              }}
              style={({ pressed }) => ({
                borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: F.semi, color: c.primary }}>{result.date} · {formatSleepDuration(calculateTotalSleepMinutes(result.sleep) ?? 0)}</Text>
              <Muted>{result.sleep.note}</Muted>
            </Pressable>) : <Muted>No saved sleep notes match “{noteSearch.trim()}”.</Muted>}
    </View>
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
          {record.loading ? 'Loading…' : record.minutes === null ? (record.date > today() ? 'Upcoming' : dateOfBirth && record.date < dateOfBirth ? 'Before DOB' : 'No log') : `${formatSleepDuration(record.minutes)}${record.napOnly ? ' · nap-only' : ''} · ${record.sleep?.quality}/5`}
        </Text>
      </View>
      {record.comparison ? <Muted>{record.comparison}{record.reference?.includesNaps ? ' · reference includes naps' : ''}</Muted> : null}
      {record.date === date ? <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.primary }}>Selected Planner date</Text> : null}
      {expandedDate === record.date ? <View testID={`sleep-details-${record.date}`} style={{ gap: 2, paddingTop: 4 }}>
        {record.loading ? <Muted>Loading sleep details…</Muted> : record.sleep ? <>
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
  const previousDate = shiftDate(date, -1);
  const previousDay = useGetDayActivity({ personId, date: previousDate });
  const previousTimes = reusableSleepTimes(previousDay.data?.sleep);
  const save = useSaveSleepRecord();
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

  function copyPreviousTimes() {
    if (!previousTimes) return;
    setBedtime(previousTimes.bedtime);
    setWakeTime(previousTimes.wakeTime);
    setNotice(`Filled bedtime and wake time from ${previousDate}. Review and save this date to keep them.`);
    setError(null);
  }

  const canSave = totalDuration !== null && overnightPairValid && wakeUpsValid && quality !== 'unrated' && note.length <= 1000 && !save.isPending;
  return <Card>
    <Eyebrow>Sleep · {personName} · {date}</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>Sleep log for this date</Text>
    <Muted>Each date has its own sleep record. Enter both overnight times, or leave them blank and record naps only. Overlapping intervals count once.</Muted>
    {day.isLoading ? <Muted>Loading sleep record…</Muted> : day.isError ? <ErrorBox error={day.error} onRetry={() => day.refetch()} /> : <>
      {previousDay.isLoading ? <Muted>Checking the previous date for sleep times…</Muted> : previousDay.isError
        ? <ErrorBox error={previousDay.error} onRetry={() => previousDay.refetch()} />
        : previousTimes
          ? <Btn small variant="ghost" icon="copy" label="Use previous day’s times"
            testID="button-copy-sleep-times-from-previous-day" onPress={copyPreviousTimes} />
          : <Muted>No overnight bedtime and wake time are saved for {previousDate}, so there are no times to copy.</Muted>}
      <Muted>Only bedtime and wake time are copied. Ratings, notes, naps, and wake-ups stay unchanged.</Muted>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Bedtime (HH:MM)" value={bedtime} onChangeText={setBedtime} placeholder="22:30" maxLength={5} keyboardType="numbers-and-punctuation" testID="input-sleep-bedtime" /></View>
        <View style={{ flex: 1 }}><Field label="Wake time (HH:MM)" value={wakeTime} onChangeText={setWakeTime} placeholder="06:45" maxLength={5} keyboardType="numbers-and-punctuation" testID="input-sleep-wake-time" /></View>
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
