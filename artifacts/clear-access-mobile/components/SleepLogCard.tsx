import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useGetDayActivity, useSaveSleepRecord } from '@/lib/local-api';
import { formatSleepDuration, sleepDurationMinutes } from '@/lib/sleep-tracking';
import { getAgeOnDate } from '@/lib/planning-targets';
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
