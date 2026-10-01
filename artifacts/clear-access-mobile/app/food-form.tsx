import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateFood, useDeleteFood, useListFoods, useUpdateFood, type Food, type FoodCategoryType, type FoodInput } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { Btn, Card, Chips, ErrorBox, Eyebrow, Field, LoadingBlock, Muted, Screen, Text0, Title, success, warn } from '@/components/ui';
import { cap, parseOptional } from '@/lib/format';

const categories: FoodCategoryType[] = ['grains', 'protein', 'vegetables', 'fruit', 'dairy', 'other'];

function FoodForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { refreshFoods } = usePlanner();
  const foods = useListFoods();
  const existing = id ? foods.data?.find(f => f.id === Number(id)) : undefined;
  if (id && foods.isLoading) return <Screen title="Edit food"><LoadingBlock rows={3} /></Screen>;
  if (id && foods.isError) return <Screen title="Edit food"><ErrorBox error={foods.error} onRetry={() => foods.refetch()} /></Screen>;
  if (id && (!existing || existing.source !== 'custom')) return <Screen title="Edit food"><ErrorBox error={new Error('Only your own custom foods can be edited.')} /></Screen>;
  return <Inner key={existing?.id ?? 'new'} existing={existing} done={() => { refreshFoods(); router.back(); }} />;
}

function Inner({ existing, done }: { existing?: Food; done: () => void }) {
  const router = useRouter();
  const create = useCreateFood();
  const update = useUpdateFood();
  const remove = useDeleteFood();
  const v = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x));
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<FoodCategoryType>(existing?.category ?? 'other');
  const [kcal, setKcal] = useState(v(existing?.caloriesPer100g));
  const [protein, setProtein] = useState(v(existing?.proteinPer100g));
  const [carbs, setCarbs] = useState(v(existing?.carbsPer100g));
  const [fat, setFat] = useState(v(existing?.fatPer100g));
  const [fiber, setFiber] = useState(v(existing?.fiberPer100g));
  const [calcium, setCalcium] = useState(v(existing?.calciumMgPer100g));
  const [iron, setIron] = useState(v(existing?.ironMgPer100g));
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit() {
    const nums = [kcal, protein, carbs, fat, fiber].map(s => (s.trim() ? Number(s) : NaN));
    const ca = parseOptional(calcium), fe = parseOptional(iron);
    const [k, p, cb, f, fi] = nums;
    const bad = (m: string) => { setProblem(m); warn(); };
    if (!name.trim() || name.trim().length > 120) return bad('Enter a name up to 120 characters.');
    if (nums.some(x => !Number.isFinite(x) || x < 0)) return bad('Calories, protein, carbs, fat and fiber are required and cannot be negative.');
    if (k > 1000 || p > 100 || cb > 100 || f > 100 || fi > 100) return bad('Calories max 1,000 kcal; macros and fiber max 100 g per 100 g.');
    if (ca === undefined || (ca !== null && (ca < 0 || ca > 10000))) return bad('Calcium must be 0 to 10,000 mg, or empty if unknown.');
    if (fe === undefined || (fe !== null && (fe < 0 || fe > 1000))) return bad('Iron must be 0 to 1,000 mg, or empty if unknown.');
    setProblem(null);
    const data: FoodInput = { name: name.trim(), category, caloriesPer100g: k, proteinPer100g: p, carbsPer100g: cb, fatPer100g: f, fiberPer100g: fi, calciumMgPer100g: ca, ironMgPer100g: fe };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, data });
      else await create.mutateAsync({ data });
      success(); done();
    } catch { warn(); }
  }
  async function del() {
    if (!existing) return;
    try { await remove.mutateAsync({ id: existing.id }); success(); done(); } catch { warn(); }
  }
  const err = create.error ?? update.error;
  return <Screen title={existing ? 'Edit food' : 'New food'}>
    <Eyebrow>{existing ? 'Custom food' : 'New custom food'} / per 100 g</Eyebrow>
    <Title sub="Leave calcium or iron empty when you do not know them. Unknown is saved as unknown, never as zero.">{existing ? `Edit ${existing.name}` : 'Add your own food'}</Title>
    <Field label="Name" value={name} onChangeText={setName} maxLength={120} testID="input-food-name" />
    <Chips testPrefix="select-food-category" value={category} onChange={setCategory} options={categories.map(c => ({ value: c, label: cap(c) }))} />
    <Card>
      <Field label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" testID="input-food-calories" />
      <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" testID="input-food-protein" />
      <Field label="Carbohydrates (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" testID="input-food-carbs" />
      <Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" testID="input-food-fat" />
      <Field label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" testID="input-food-fiber" />
      <Field label="Calcium (mg), optional" value={calcium} onChangeText={setCalcium} keyboardType="decimal-pad" placeholder="Unknown" testID="input-food-calcium" />
      <Field label="Iron (mg), optional" value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="Unknown" testID="input-food-iron" />
    </Card>
    <Muted>Edits update every planned meal that uses this food.</Muted>
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    <Btn label={existing ? 'Save food' : 'Create food'} icon="check" loading={create.isPending || update.isPending} onPress={() => void submit()} testID="button-save-food" />
    <Btn variant="ghost" label="Cancel" onPress={() => router.back()} testID="button-cancel-food" />
    {existing ? (confirmDelete ? <Card tone="danger">
      <Text0>Delete {existing.name}? Foods used in meal entries cannot be deleted.</Text0>
      {remove.isError ? <ErrorBox error={remove.error} /> : null}
      <Btn variant="danger" icon="trash-2" label="Yes, delete food" loading={remove.isPending} testID="button-confirm-delete-food" onPress={() => void del()} />
      <Btn variant="ghost" label="Keep food" testID="button-cancel-delete-food" onPress={() => setConfirmDelete(false)} />
    </Card> : <Btn variant="danger" icon="trash-2" label="Delete food" testID="button-delete-food" onPress={() => setConfirmDelete(true)} />) : null}
  </Screen>;
}
export default function FoodFormRoute() { return <FoodForm />; }
