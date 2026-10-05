import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreatePerson, useUpdatePerson, type ActivityLevelType, type PersonInput } from '@/lib/local-api';
import { useOptionalPlanner } from '@/contexts/PlannerProvider';
import { Btn, Chips, ErrorBox, Eyebrow, Field, Muted, Screen, Title, success, warn } from '@/components/ui';
import { NutritionGoalSelector } from '@/components/NutritionGoalSelector';
import { activityOptions } from '@/lib/activity';
import { parseOptional } from '@/lib/format';

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
  const [age, setAge] = useState(editing?.ageYears == null ? '' : String(editing.ageYears));
  const [nutritionGoal, setNutritionGoal] = useState(editing?.nutritionGoal ?? null);
  const [level, setLevel] = useState<ActivityLevelType>(editing?.activityLevel ?? 'moderate');
  const [baseline, setBaseline] = useState(String(editing?.baselineCalories ?? 1800));
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    const cleaned = name.trim();
    const weightKg = parseOptional(weight);
    const ageYears = parseOptional(age);
    const kcal = Number(baseline);
    if (!cleaned || cleaned.length > 80 || !Number.isInteger(kcal) || kcal < 1000 || kcal > 5000) {
      setProblem('Enter a name (up to 80 characters) and a baseline from 1,000 to 5,000 kcal.'); warn(); return;
    }
    if (weightKg === undefined || (weightKg !== null && (weightKg < 1 || weightKg > 500))) {
      setProblem('Body weight must be between 1 and 500 kg, or empty.'); warn(); return;
    }
    if (ageYears === undefined || (ageYears !== null && (!Number.isInteger(ageYears) || ageYears < 1 || ageYears > 120))) {
      setProblem('Age must be a whole number from 1 to 120, or empty.'); warn(); return;
    }
    setProblem(null);
    const data: PersonInput = { name: cleaned, weightKg, ageYears, nutritionGoal, activityLevel: level, baselineCalories: kcal };
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
    <Field label="Body weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Not set" hint="Used to scale workbook carbohydrate and protein ranges. Clear to remove." testID="input-manage-person-weight" />
    <Field label="Age (years)" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Not set" hint="Used for calcium and adult-estimate eligibility only when no date of birth is saved. Unknown age is not assumed to be adult." testID="input-manage-person-age" />
    <NutritionGoalSelector value={nutritionGoal} onChange={setNutritionGoal} testPrefix="select-manage-person-nutrition-goal" />
    <Eyebrow>Legacy/manual energy settings</Eyebrow>
    <Chips testPrefix="select-manage-person-activity" value={level} onChange={setLevel} options={activityOptions.map(o => ({ value: o.value, label: o.title }))} />
    <Muted>Legacy/manual activity level and multiplier retained for saved-data compatibility; they do not control daily automatic targets.</Muted>
    <Field label="Legacy baseline kcal / day" value={baseline} onChangeText={setBaseline} keyboardType="number-pad" testID="input-manage-person-baseline" hint="Retained for saved-data compatibility only. Daily automatic calories and fat estimates use body weight and the planned activity for each date." />
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    <Btn label={editing ? 'Save person' : 'Create person'} icon="check" loading={create.isPending || update.isPending} onPress={() => void submit()} testID="button-save-person" />
    <Btn variant="ghost" label="Cancel" onPress={() => router.back()} testID="button-cancel-person" />
  </Screen>;
}
export default function PersonFormRoute() { return <PersonForm />; }
