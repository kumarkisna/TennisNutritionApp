import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreatePerson, useUpdatePerson, type ActivityLevelType, type PersonInput } from '@/lib/local-api';
import { useOptionalPlanner } from '@/contexts/PlannerProvider';
import { Btn, Card, Chips, ErrorBox, Eyebrow, Field, Muted, Screen, Title, success, warn } from '@/components/ui';
import { NutritionGoalSelector } from '@/components/NutritionGoalSelector';
import { DateOfBirthAgeFields } from '@/components/DateOfBirthAgeFields';
import { activityOptions } from '@/lib/activity';
import { isIsoDate, parseOptional, today } from '@/lib/format';

function PersonForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const planner = useOptionalPlanner();
  const people = planner?.people ?? [];
  const editing = id ? people.find(p => p.id === Number(id)) : undefined;
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const [name, setName] = useState(editing?.name ?? '');
  const [weight, setWeight] = useState(editing?.weightKg == null ? '' : String(editing.weightKg));
  const [targetWeight, setTargetWeight] = useState(editing?.targetWeightKg == null ? '' : String(editing.targetWeightKg));
  const [dateOfBirth, setDateOfBirth] = useState(editing?.dateOfBirth ?? '');
  const [nutritionGoal, setNutritionGoal] = useState(editing?.nutritionGoal ?? null);
  const [level, setLevel] = useState<ActivityLevelType>(editing?.activityLevel ?? 'moderate');
  const [baseline, setBaseline] = useState(String(editing?.baselineCalories ?? 1800));
  const [iron, setIron] = useState(editing?.ironGoalMg == null ? '' : String(editing.ironGoalMg));
  const [ironSrc, setIronSrc] = useState(editing?.ironGoalSource ?? '');
  const [ironDate, setIronDate] = useState(editing?.ironGoalReviewedOn ?? '');
  const [fat, setFat] = useState(editing?.fatGoalG == null ? '' : String(editing.fatGoalG));
  const [fatSrc, setFatSrc] = useState(editing?.fatGoalSource ?? '');
  const [fatDate, setFatDate] = useState(editing?.fatGoalReviewedOn ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    const cleaned = name.trim();
    const weightKg = parseOptional(weight);
    const targetWeightKg = parseOptional(targetWeight);
    const dob = dateOfBirth.trim() || null;
    const ironMg = parseOptional(iron);
    const fatG = parseOptional(fat);
    const kcal = Number(baseline);
    if (!cleaned || cleaned.length > 80 || !Number.isInteger(kcal) || kcal < 1000 || kcal > 5000) {
      setProblem('Enter a name (up to 80 characters) and a baseline from 1,000 to 5,000 kcal.'); warn(); return;
    }
    if (weightKg === undefined || (weightKg !== null && (weightKg < 1 || weightKg > 500))) {
      setProblem('Body weight must be between 1 and 500 kg, or empty.'); warn(); return;
    }
    if (targetWeightKg === undefined || (targetWeightKg !== null && (targetWeightKg < 1 || targetWeightKg > 500))) {
      setProblem('Target weight must be between 1 and 500 kg, or empty.'); warn(); return;
    }
    if (dob && !isIsoDate(dob)) {
      setProblem('Enter a real date of birth in YYYY-MM-DD format, or clear it.'); warn(); return;
    }
    if (dob && dob > today()) {
      setProblem('Date of birth cannot be in the future.'); warn(); return;
    }
    if (ironMg === undefined || (ironMg !== null && (ironMg <= 0 || ironMg > 100))) {
      setProblem('Iron goal must be above 0 and at most 100 mg, or empty.'); warn(); return;
    }
    if (fatG === undefined || (fatG !== null && (fatG <= 0 || fatG > 500))) {
      setProblem('Fat goal must be above 0 and at most 500 g, or empty.'); warn(); return;
    }
    if (ironDate.trim() && !isIsoDate(ironDate.trim())) {
      setProblem('Iron review date must be YYYY-MM-DD.'); warn(); return;
    }
    if (fatDate.trim() && !isIsoDate(fatDate.trim())) {
      setProblem('Fat review date must be YYYY-MM-DD.'); warn(); return;
    }
    if (ironSrc.length > 300 || fatSrc.length > 300) {
      setProblem('Source notes can be up to 300 characters.'); warn(); return;
    }
    setProblem(null);
    const data: PersonInput = {
      name: cleaned, weightKg, targetWeightKg, dateOfBirth: dob, nutritionGoal,
      activityLevel: level, baselineCalories: kcal,
      ironGoalMg: ironMg,
      ironGoalSource: ironMg === null ? null : ironSrc.trim() || null,
      ironGoalReviewedOn: ironMg === null ? null : ironDate.trim() || null,
      fatGoalG: fatG,
      fatGoalSource: fatG === null ? null : fatSrc.trim() || null,
      fatGoalReviewedOn: fatG === null ? null : fatDate.trim() || null,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else { const created = await create.mutateAsync({ data }); planner?.selectPerson(created.id); }
      planner?.refreshPeople(); success(); router.back();
    } catch { warn(); }
  }
  const err = create.error ?? update.error;
  return <Screen title={editing ? 'Edit person' : 'Add person'}>
    <Eyebrow>{editing ? 'Edit' : 'New'} person</Eyebrow>
    <Title>{editing ? `Edit ${editing.name}` : 'Add a person'}</Title>
    <Field label="Name" value={name} onChangeText={setName} maxLength={80} testID="input-manage-person-name" />
    <Eyebrow>Body details</Eyebrow>
    <Field label="Planning body weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Not set" hint="Used by planning estimates. This is separate from dated weigh-ins below." testID="input-manage-person-weight" />
    <Field label="Target weight (kg)" value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" placeholder="No target" hint="Optional comparison for the progress chart only. It does not change planning body weight, calories, or nutrition references." testID="input-manage-person-target-weight" />
    <DateOfBirthAgeFields dateOfBirth={dateOfBirth} onChangeDateOfBirth={setDateOfBirth} testPrefix="input-manage-person" />
    <NutritionGoalSelector value={nutritionGoal} onChange={setNutritionGoal} testPrefix="select-manage-person-nutrition-goal" />
    <Eyebrow>Legacy/manual energy settings</Eyebrow>
    <Chips testPrefix="select-manage-person-activity" value={level} onChange={setLevel} options={activityOptions.map(o => ({ value: o.value, label: o.title }))} />
    <Muted>Legacy/manual activity level and multiplier retained for saved-data compatibility; they do not control daily automatic targets.</Muted>
    <Field label="Legacy baseline kcal / day" value={baseline} onChangeText={setBaseline} keyboardType="number-pad" testID="input-manage-person-baseline" hint="Retained for saved-data compatibility only. Daily automatic calories and fat estimates use body weight and the planned activity for each date." />
    <Card>
      <Eyebrow>Optional iron goal</Eyebrow>
      <Muted>Only enter a goal you have chosen yourself or reviewed with a qualified professional. The app does not suggest one. Leave empty for none.</Muted>
      <Field label="Iron goal (mg / day)" value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="No goal" testID="input-manage-person-iron-goal" />
      <Field label="Source note" value={ironSrc} onChangeText={setIronSrc} placeholder="Where this goal comes from" maxLength={300} testID="input-manage-person-iron-source" />
      <Field label="Reviewed on (YYYY-MM-DD)" value={ironDate} onChangeText={setIronDate} placeholder="Optional" autoCapitalize="none" maxLength={10} testID="input-manage-person-iron-reviewed" />
      <Muted>Source and date are user-provided and not verified by this app. Clearing the goal also clears them.</Muted>
    </Card>
    <Card>
      <Eyebrow>Optional manual fat goal</Eyebrow>
      <Muted>This saved personal goal is separate and does not override the automatic adult fat estimate. The workbook’s fat ranges depend on person groups, so none is inferred. Leave empty for none.</Muted>
      <Field label="Manual fat goal (g / day)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="No goal" testID="input-manage-person-fat-goal" />
      <Field label="Source note" value={fatSrc} onChangeText={setFatSrc} placeholder="Where this goal comes from" maxLength={300} testID="input-manage-person-fat-source" />
      <Field label="Reviewed on (YYYY-MM-DD)" value={fatDate} onChangeText={setFatDate} placeholder="Optional" autoCapitalize="none" maxLength={10} testID="input-manage-person-fat-reviewed" />
    </Card>
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    <Btn label={editing ? 'Save person' : 'Create person'} icon="check" loading={create.isPending || update.isPending} onPress={() => void submit()} testID="button-save-person" />
    <Btn variant="ghost" label="Cancel" onPress={() => router.back()} testID="button-cancel-person" />
  </Screen>;
}
export default function PersonFormRoute() { return <PersonForm />; }
