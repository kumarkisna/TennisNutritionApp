import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreatePerson, useUpdatePerson, type ActivityLevelType, type PersonInput } from '@/lib/local-api';
import { useOptionalPlanner } from '@/contexts/PlannerProvider';
import { Btn, Chips, ErrorBox, Eyebrow, Field, Muted, Screen, Title, success, warn } from '@/components/ui';
import { activityOptions } from '@/lib/activity';

function PersonForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const planner = useOptionalPlanner();
  const people = planner?.people ?? [];
  const editing = id ? people.find(p => p.id === Number(id)) : undefined;
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const [name, setName] = useState(editing?.name ?? '');
  const [level, setLevel] = useState<ActivityLevelType>(editing?.activityLevel ?? 'moderate');
  const [baseline, setBaseline] = useState(String(editing?.baselineCalories ?? 1800));
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    const cleaned = name.trim();
    const kcal = Number(baseline);
    if (!cleaned || cleaned.length > 80 || !Number.isInteger(kcal) || kcal < 1000 || kcal > 5000) {
      setProblem('Enter a name (up to 80 characters) and a baseline from 1,000 to 5,000 kcal.'); warn(); return;
    }
    setProblem(null);
    const data: PersonInput = { name: cleaned, activityLevel: level, baselineCalories: kcal };
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
    <Chips testPrefix="select-manage-person-activity" value={level} onChange={setLevel} options={activityOptions.map(o => ({ value: o.value, label: o.title }))} />
    <Muted>{activityOptions.find(o => o.value === level)?.description}</Muted>
    <Field label="Baseline kcal / day" value={baseline} onChangeText={setBaseline} keyboardType="number-pad" testID="input-manage-person-baseline" />
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    <Btn label={editing ? 'Save person' : 'Create person'} icon="check" loading={create.isPending || update.isPending} onPress={() => void submit()} testID="button-save-person" />
    <Btn variant="ghost" label="Cancel" onPress={() => router.back()} testID="button-cancel-person" />
  </Screen>;
}
export default function PersonFormRoute() { return <PersonForm />; }
