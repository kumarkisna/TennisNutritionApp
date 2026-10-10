import { useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useDayActivitiesForDates, useGetDayActivity, useSaveSleepRecord } from '@/lib/local-api';
import { formatSleepDuration, sleepDurationMinutes, sleepReferenceForDate, sleepWeekDates } from '@/lib/sleep-tracking';
import { getAgeOnDate } from '@/lib/planning-targets';
import { today } from '@/lib/format';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, Muted } from '@/components/ui';

const qualityChoices = [
  { value: 'unrated', label: 'Choose rating' },
  { value: '1', label: '1 · Poor' },
  { value: '2', label: '2' },
  { value: '3', label: '3 · OK' },
  { value: '4', label: '4' },
  { value: '5', label: '5 · Great' },
];

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

function SleepWeekSummary({ personId, date, dateOfBirth }: { personId: number; date: string; dateOfBirth: string | null }) {
  const c = useColors();
  const [weekStart, setWeekStart] = useState(() => sleepWeekDates(date)[0] ?? date);
  useEffect(() => { setWeekStart(sleepWeekDates(date)[0] ?? date); }, [date]);
  const dates = useMemo(() => sleepWeekDates(weekStart), [weekStart]);
  const days = useDayActivitiesForDates(personId, dates);
  const records = dates.map((dayDate, index) => {
    const sleep = days[index]?.data?.sleep;
    const minutes = sleep ? sleepDurationMinutes(sleep.bedtime, sleep.wakeTime) : null;
    const reference = sleepReferenceForDate(dateOfBirth, dayDate);
    const comparison = minutes === null ? null : reference === null ? 'Add date of birth for an age-based comparison.' :
      minutes < reference.minMinutes ? `Below daily reference (${reference.label})` :
        reference.maxMinutes !== null && minutes > reference.maxMinutes ? `Above daily reference (${reference.label})` :
          `Within daily reference (${reference.label})`;
    return { date: dayDate, sleep, minutes, reference, comparison, loading: days[index]?.isLoading ?? true };
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
    <Muted>{elapsedDays === 0 ? 'Upcoming week' : `${logged.filter(record => record.date <= today()).length}/${elapsedDays} nights logged`}
      {averageMinutes !== null ? ` · average ${formatSleepDuration(averageMinutes)} · quality ${averageQuality?.toFixed(1)}/5` : ''}</Muted>
    {!dateOfBirth ? <Muted>Add the person’s date of birth in Settings to compare logged nights with age-based ranges.</Muted> : null}
    {records.map(record => <View key={record.date} style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 7, gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>
          {prettyDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={{ fontFamily: F.semi, color: c.foreground, textAlign: 'right' }}>
          {record.loading ? 'Loading…' : record.minutes === null ? (record.date > today() ? 'Upcoming' : dateOfBirth && record.date < dateOfBirth ? 'Before DOB' : 'No log') : `${formatSleepDuration(record.minutes)} · ${record.sleep?.quality}/5`}
        </Text>
      </View>
      {record.comparison ? <Muted>{record.comparison}{record.reference?.includesNaps ? ' · reference includes naps' : ''}</Muted> : null}
    </View>)}
    <Muted>Age-based daily ranges are a reference, not a diagnosis. This log records the overnight interval only; naps and wake-ups are not included.</Muted>
  </View>;
}

export function SleepLogCard({ personId, personName, date, dateOfBirth }: { personId: number; personName: string; date: string; dateOfBirth: string | null }) {
  const c = useColors();
  const day = useGetDayActivity({ personId, date });
  const save = useSaveSleepRecord();
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [quality, setQuality] = useState('unrated');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const duration = sleepDurationMinutes(bedtime, wakeTime);
  const age = dateOfBirth ? getAgeOnDate(dateOfBirth, date) : null;

  useEffect(() => {
    if (!day.isSuccess) return;
    setBedtime(day.data.sleep?.bedtime ?? '');
    setWakeTime(day.data.sleep?.wakeTime ?? '');
    setQuality(day.data.sleep ? String(day.data.sleep.quality) : 'unrated');
    setNote(day.data.sleep?.note ?? '');
    setError(null);
    setNotice('');
  }, [personId, date, day.data, day.isSuccess]);

  async function saveRecord() {
    setError(null);
    setNotice('');
    try {
      await save.mutateAsync({ data: {
        personId, date, sleep: {
          bedtime, wakeTime, quality: Number(quality), note: note.trim(),
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

  const canSave = duration !== null && quality !== 'unrated' && note.length <= 1000 && !save.isPending;
  return <Card>
    <Eyebrow>Sleep · {personName} · {date}</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>Sleep log for this date</Text>
    <Muted>Each date has its own sleep record. Enter times in 24-hour format; duration is calculated, including sleep that crosses midnight.</Muted>
    {day.isLoading ? <Muted>Loading sleep record…</Muted> : day.isError ? <ErrorBox error={day.error} onRetry={() => day.refetch()} /> : <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Bedtime (HH:MM)" value={bedtime} onChangeText={setBedtime} placeholder="22:30" maxLength={5} keyboardType="numbers-and-punctuation" testID="input-sleep-bedtime" /></View>
        <View style={{ flex: 1 }}><Field label="Wake time (HH:MM)" value={wakeTime} onChangeText={setWakeTime} placeholder="06:45" maxLength={5} keyboardType="numbers-and-punctuation" testID="input-sleep-wake-time" /></View>
      </View>
      {duration !== null ? <Muted>Calculated duration: <Text style={{ fontFamily: F.semi, color: c.foreground }}>{formatSleepDuration(duration)}</Text></Muted> :
        <Muted>Enter two different valid times to calculate sleep duration.</Muted>}
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
    <SleepWeekSummary personId={personId} date={date} dateOfBirth={dateOfBirth} />
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
