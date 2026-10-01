import { useState } from 'react';
import { PlanningTargets } from '@/components/PlanningTargets';
import { Text } from 'react-native';
import { useUpdatePerson, type ActivityLevelType, type Person, type PersonUpdate } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { Btn, Card, Chips, ErrorBox, Eyebrow, Field, Muted, Screen, Title, success, warn } from '@/components/ui';
import { isIsoDate, n, parseOptional } from '@/lib/format';
import { activityOptions } from '@/lib/activity';

const s = (v: number | string | null) => (v === null ? '' : String(v));

function SettingsForm({ person }: { person: Person }) {
  const { refreshPeople } = usePlanner();
  const update = useUpdatePerson();
  const [weight, setWeight] = useState(s(person.weightKg));
  const [age, setAge] = useState(s(person.ageYears));
  const [level, setLevel] = useState<ActivityLevelType>(person.activityLevel);
  const [baseline, setBaseline] = useState(String(person.baselineCalories));
  const [iron, setIron] = useState(s(person.ironGoalMg));
  const [ironSrc, setIronSrc] = useState(s(person.ironGoalSource));
  const [ironDate, setIronDate] = useState(s(person.ironGoalReviewedOn));
  const [fat, setFat] = useState(s(person.fatGoalG));
  const [fatSrc, setFatSrc] = useState(s(person.fatGoalSource));
  const [fatDate, setFatDate] = useState(s(person.fatGoalReviewedOn));
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const w = parseOptional(weight), a = parseOptional(age), i = parseOptional(iron), f = parseOptional(fat);
    const b = Number(baseline);
    const bad = (m: string) => { setProblem(m); warn(); };
    if (w === undefined || (w !== null && (w < 1 || w > 500))) return bad('Body weight must be between 1 and 500 kg, or empty.');
    if (a === undefined || (a !== null && (!Number.isInteger(a) || a < 1 || a > 120))) return bad('Age must be a whole number from 1 to 120, or empty.');
    if (!Number.isInteger(b) || b < 1000 || b > 5000) return bad('Baseline must be a whole number from 1,000 to 5,000 kcal.');
    if (i === undefined || (i !== null && (i <= 0 || i > 100))) return bad('Iron goal must be above 0 and at most 100 mg, or empty.');
    if (f === undefined || (f !== null && (f <= 0 || f > 500))) return bad('Fat goal must be above 0 and at most 500 g, or empty.');
    if (ironDate.trim() && !isIsoDate(ironDate.trim())) return bad('Iron review date must be YYYY-MM-DD.');
    if (fatDate.trim() && !isIsoDate(fatDate.trim())) return bad('Fat review date must be YYYY-MM-DD.');
    if (ironSrc.length > 300 || fatSrc.length > 300) return bad('Source notes can be up to 300 characters.');
    setProblem(null);
    const data: PersonUpdate = {
      weightKg: w, ageYears: a, activityLevel: level, baselineCalories: b,
      ironGoalMg: i, ironGoalSource: i === null ? null : ironSrc.trim() || null, ironGoalReviewedOn: i === null ? null : ironDate.trim() || null,
      fatGoalG: f, fatGoalSource: f === null ? null : fatSrc.trim() || null, fatGoalReviewedOn: f === null ? null : fatDate.trim() || null,
    };
    try {
      await update.mutateAsync({ id: person.id, data });
      refreshPeople(); setSaved(true); success();
    } catch { /* shown below */ }
  }

  return <>
    <Card>
      <Eyebrow>Body and energy</Eyebrow>
      <Field label="Body weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Not set" hint="Used to scale workbook carbohydrate and protein ranges. Clear to remove." testID="input-weight" />
      <Field label="Age (years)" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Not set" hint="Used for the workbook calcium reference (ages 12+). Clear to remove." testID="input-age" />
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11.5, color: '#3c575e' }}>Activity estimate</Text>
      <Chips testPrefix="select-activity-level" value={level} onChange={setLevel} options={activityOptions.map(o => ({ value: o.value, label: o.title }))} />
      <Muted>{activityOptions.find(o => o.value === level)?.description}. Multiplier ×{activityOptions.find(o => o.value === level)?.multiplier}.</Muted>
      <Field label="Baseline kcal / day" value={baseline} onChangeText={setBaseline} keyboardType="number-pad" testID="input-baseline" hint={`Current planning target: ~${n(person.targetCalories)} kcal. An estimate, not a requirement.`} />
    </Card>
    <Card>
      <Eyebrow>Optional iron goal</Eyebrow>
      <Muted>Only enter a goal you have chosen yourself or reviewed with a qualified professional. The app does not suggest one. Leave empty for none.</Muted>
      <Field label="Iron goal (mg / day)" value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="No goal" testID="input-iron-goal" />
      <Field label="Source note" value={ironSrc} onChangeText={setIronSrc} placeholder="Where this goal comes from" maxLength={300} testID="input-iron-source" />
      <Field label="Reviewed on (YYYY-MM-DD)" value={ironDate} onChangeText={setIronDate} placeholder="Optional" autoCapitalize="none" maxLength={10} testID="input-iron-reviewed" />
      <Muted>Source and date are user-provided and not verified by this app. Clearing the goal also clears them.</Muted>
    </Card>
    <Card>
      <Eyebrow>Optional fat goal</Eyebrow>
      <Muted>The workbook’s fat ranges depend on person groups, so none is inferred. Leave empty for none.</Muted>
      <Field label="Fat goal (g / day)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="No goal" testID="input-fat-goal" />
      <Field label="Source note" value={fatSrc} onChangeText={setFatSrc} placeholder="Where this goal comes from" maxLength={300} testID="input-fat-source" />
      <Field label="Reviewed on (YYYY-MM-DD)" value={fatDate} onChangeText={setFatDate} placeholder="Optional" autoCapitalize="none" maxLength={10} testID="input-fat-reviewed" />
    </Card>
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {update.isError ? <ErrorBox error={update.error} onRetry={() => void save()} /> : null}
    {saved ? <Text testID="status-settings-saved" style={{ fontFamily: 'Inter_700Bold', color: '#176d61' }}>Saved for {person.name}.</Text> : null}
    <Btn label="Save settings" icon="check" loading={update.isPending} onPress={() => void save()} testID="button-save-settings" />
  </>;
}

export default function Settings() {
  const { person, date } = usePlanner();
  return <Screen tabs>
    <Eyebrow>04 / Settings</Eyebrow>
    <Title sub="Each person keeps their own details. Estimates are for planning only, never medical requirements.">{`${person.name}'s details.`}</Title>
    <Card>
      <Eyebrow>Saved planning targets</Eyebrow>
      <PlanningTargets person={person} date={date} testPrefix="settings-target" />
      <Muted>These use saved details. Save changes below to update them. Choose the day's planned activity in Planner.</Muted>
    </Card>
    <SettingsForm key={person.id} person={person} />
  </Screen>;
}
