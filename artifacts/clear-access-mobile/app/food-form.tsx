import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateFood, useDeleteFood, useListFoods, useUpdateFood, type Food, type FoodCategoryType, type FoodInput } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, Screen, SectionTitle, Text0, Title, success, warn } from '@/components/ui';
import { cap, parseOptional } from '@/lib/format';
import {
  calculateFoodNutrition,
  createEmptyFoodIngredientDraft,
  foodIngredientToDraft,
  MAX_FOOD_INGREDIENTS,
  parseFoodIngredientDrafts,
  type FoodIngredientDraft,
  type FoodNutritionPer100g,
} from '@/lib/food-nutrition';
import type { FoodIngredient } from '@/lib/local-api';

const categories: FoodCategoryType[] = ['grains', 'protein', 'vegetables', 'fruit', 'dairy', 'other'];

type FoodIngredientDraftField = Exclude<keyof FoodIngredientDraft, 'key'>;
type FoodIngredientNutrientField = Exclude<FoodIngredientDraftField, 'name' | 'grams'>;

const ingredientNutrientFields: { key: FoodIngredientNutrientField; label: string; placeholder?: string }[] = [
  { key: 'caloriesPer100g', label: 'Calories per 100 g (kcal)', placeholder: 'Required' },
  { key: 'proteinPer100g', label: 'Protein per 100 g (g)', placeholder: 'Required' },
  { key: 'carbsPer100g', label: 'Carbohydrates per 100 g (g)', placeholder: 'Required' },
  { key: 'fatPer100g', label: 'Fat per 100 g (g)', placeholder: 'Required' },
  { key: 'fiberPer100g', label: 'Fiber per 100 g (g)', placeholder: 'Required' },
  { key: 'calciumMgPer100g', label: 'Calcium per 100 g (mg)', placeholder: 'Unknown' },
  { key: 'ironMgPer100g', label: 'Iron per 100 g (mg)', placeholder: 'Unknown' },
];

function showNutrient(value: number | null, unit: string) {
  return value === null ? 'Unknown' : `${value.toFixed(1)} ${unit}`;
}

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
  const c = useColors();
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
  const [ingredients, setIngredients] = useState<FoodIngredientDraft[]>(() =>
    (existing?.ingredients ?? []).map((ingredient, index) => foodIngredientToDraft(ingredient, `saved-${index + 1}`)),
  );
  const nextIngredientId = useRef((existing?.ingredients?.length ?? 0) + 1);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parsedIngredients = ingredients.length > 0 ? parseFoodIngredientDrafts(ingredients) : null;
  const calculatedNutrition = parsedIngredients?.ok
    ? calculateFoodNutrition(parsedIngredients.ingredients)
    : null;
  const ingredientTotalGrams = parsedIngredients?.ok
    ? parsedIngredients.ingredients.reduce((total, ingredient) => total + ingredient.grams, 0)
    : null;

  function updateIngredient(key: string, field: FoodIngredientDraftField, value: string) {
    setIngredients(current => current.map(ingredient =>
      ingredient.key === key ? { ...ingredient, [field]: value } : ingredient,
    ));
    setProblem(null);
  }

  function addIngredient() {
    if (ingredients.length >= MAX_FOOD_INGREDIENTS) return;
    setIngredients(current => [
      ...current,
      createEmptyFoodIngredientDraft(`draft-${nextIngredientId.current++}`),
    ]);
    setProblem(null);
  }

  function useManualNutrition(values?: FoodNutritionPer100g | null) {
    if (values) {
      setKcal(String(values.caloriesPer100g));
      setProtein(String(values.proteinPer100g));
      setCarbs(String(values.carbsPer100g));
      setFat(String(values.fatPer100g));
      setFiber(String(values.fiberPer100g));
      setCalcium(values.calciumMgPer100g === null ? '' : String(values.calciumMgPer100g));
      setIron(values.ironMgPer100g === null ? '' : String(values.ironMgPer100g));
    }
    setIngredients([]);
    setProblem(null);
  }

  function removeIngredient(key: string) {
    const remaining = ingredients.filter(ingredient => ingredient.key !== key);
    if (remaining.length === 0 && calculatedNutrition) useManualNutrition(calculatedNutrition);
    else setIngredients(remaining);
    setProblem(null);
  }

  async function submit() {
    const bad = (m: string) => { setProblem(m); warn(); };
    if (!name.trim() || name.trim().length > 120) return bad('Enter a name up to 120 characters.');

    let nutrients: FoodNutritionPer100g;
    let ingredientValues: FoodIngredient[] = [];
    if (ingredients.length > 0) {
      if (!parsedIngredients?.ok) {
        return bad(parsedIngredients?.error ?? 'Complete the ingredient details to calculate nutrition.');
      }
      const calculated = calculateFoodNutrition(parsedIngredients.ingredients);
      if (!calculated) return bad('Complete the ingredient details to calculate nutrition.');
      ingredientValues = parsedIngredients.ingredients;
      nutrients = calculated;
    } else {
      const nums = [kcal, protein, carbs, fat, fiber].map(s => (s.trim() ? Number(s) : NaN));
      const ca = parseOptional(calcium), fe = parseOptional(iron);
      const [k, p, cb, f, fi] = nums;
      if (nums.some(x => !Number.isFinite(x) || x < 0)) return bad('Calories, protein, carbs, fat and fiber are required and cannot be negative.');
      if (k > 1000 || p > 100 || cb > 100 || f > 100 || fi > 100) return bad('Calories max 1,000 kcal; macros and fiber max 100 g per 100 g.');
      if (ca === undefined || (ca !== null && (ca < 0 || ca > 10000))) return bad('Calcium must be 0 to 10,000 mg, or empty if unknown.');
      if (fe === undefined || (fe !== null && (fe < 0 || fe > 1000))) return bad('Iron must be 0 to 1,000 mg, or empty if unknown.');
      nutrients = {
        caloriesPer100g: k,
        proteinPer100g: p,
        carbsPer100g: cb,
        fatPer100g: f,
        fiberPer100g: fi,
        calciumMgPer100g: ca,
        ironMgPer100g: fe,
      };
    }

    setProblem(null);
    const data: FoodInput = { name: name.trim(), category, ...nutrients, ingredients: ingredientValues };
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
    <Title sub="Enter nutrition per 100 g manually, or add recipe ingredients to calculate it automatically.">{existing ? `Edit ${existing.name}` : 'Add your own food'}</Title>
    <Field label="Name" value={name} onChangeText={setName} maxLength={120} testID="input-food-name" />
    <Chips testPrefix="select-food-category" value={category} onChange={setCategory} options={categories.map(c => ({ value: c, label: cap(c) }))} />
    <Card>
      <SectionTitle kicker="Optional">Calculate from ingredients</SectionTitle>
      <Muted>Enter each ingredient’s recipe weight and nutrition per 100 g. Larger amounts contribute more to the calculated values for this food.</Muted>
      <Muted>Leave calcium or iron blank when unknown; that nutrient stays unknown for the whole food unless every ingredient has a value. Enter 0 when you know it is absent.</Muted>
      {ingredients.map((ingredient, index) => <View key={ingredient.key} style={{ gap: 10, paddingTop: index === 0 ? 0 : 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text0>Ingredient {index + 1}</Text0>
          <Btn small variant="ghost" icon="trash-2" label="Remove" testID={`button-remove-food-ingredient-${ingredient.key}`} onPress={() => removeIngredient(ingredient.key)} />
        </View>
        <Field label="Ingredient name" value={ingredient.name} onChangeText={value => updateIngredient(ingredient.key, 'name', value)} maxLength={120} testID={`input-food-ingredient-name-${ingredient.key}`} />
        <Field label="Amount in recipe (g)" value={ingredient.grams} onChangeText={value => updateIngredient(ingredient.key, 'grams', value)} keyboardType="decimal-pad" placeholder="e.g. 150" testID={`input-food-ingredient-grams-${ingredient.key}`} />
        <Muted>Nutrition below is for 100 g of this ingredient.</Muted>
        {ingredientNutrientFields.map(field => <Field
          key={field.key}
          label={field.label}
          value={ingredient[field.key]}
          onChangeText={value => updateIngredient(ingredient.key, field.key, value)}
          keyboardType="decimal-pad"
          placeholder={field.placeholder}
          testID={`input-food-ingredient-${field.key}-${ingredient.key}`}
        />)}
      </View>)}
      <Btn small variant="ghost" icon="plus" label={ingredients.length >= MAX_FOOD_INGREDIENTS ? `Maximum ${MAX_FOOD_INGREDIENTS} ingredients` : 'Add ingredient'} disabled={ingredients.length >= MAX_FOOD_INGREDIENTS} onPress={addIngredient} testID="button-add-food-ingredient" />
      {ingredients.length > 0 ? <Btn small variant="ghost" label="Use manual nutrition instead" onPress={() => useManualNutrition(calculatedNutrition)} testID="button-use-manual-food-nutrition" /> : null}
    </Card>
    {ingredients.length > 0
      ? <Card tone={calculatedNutrition ? 'mint' : 'card'}>
        <SectionTitle kicker="Calculated">Nutrition per 100 g</SectionTitle>
        {calculatedNutrition && ingredientTotalGrams !== null
          ? <>
            <View testID="food-ingredient-calculation" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                ['Calories', showNutrient(calculatedNutrition.caloriesPer100g, 'kcal')],
                ['Protein', showNutrient(calculatedNutrition.proteinPer100g, 'g')],
                ['Carbohydrates', showNutrient(calculatedNutrition.carbsPer100g, 'g')],
                ['Fat', showNutrient(calculatedNutrition.fatPer100g, 'g')],
                ['Fiber', showNutrient(calculatedNutrition.fiberPer100g, 'g')],
                ['Calcium', showNutrient(calculatedNutrition.calciumMgPer100g, 'mg')],
                ['Iron', showNutrient(calculatedNutrition.ironMgPer100g, 'mg')],
              ].map(([label, value]) => <View key={label} style={{ width: '47%', gap: 2 }}>
                <Muted>{label}</Muted>
                <Text style={{ fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{value}</Text>
              </View>)}
            </View>
            <Muted>Weighted across {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} · {ingredientTotalGrams.toFixed(1)} g total recipe weight.</Muted>
          </>
          : <View testID="status-food-ingredient-calculation"><Muted>Complete each ingredient’s name, amount, calories, protein, carbohydrates, fat, and fiber to calculate the per-100 g values.</Muted></View>}
      </Card>
      : <Card>
        <SectionTitle kicker="Manual entry">Nutrition per 100 g</SectionTitle>
        <Muted>Leave calcium or iron empty when you do not know them. Unknown is saved as unknown, never as zero.</Muted>
        <Field label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" testID="input-food-calories" />
        <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" testID="input-food-protein" />
        <Field label="Carbohydrates (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" testID="input-food-carbs" />
        <Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" testID="input-food-fat" />
        <Field label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" testID="input-food-fiber" />
        <Field label="Calcium (mg), optional" value={calcium} onChangeText={setCalcium} keyboardType="decimal-pad" placeholder="Unknown" testID="input-food-calcium" />
        <Field label="Iron (mg), optional" value={iron} onChangeText={setIron} keyboardType="decimal-pad" placeholder="Unknown" testID="input-food-iron" />
      </Card>}
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
