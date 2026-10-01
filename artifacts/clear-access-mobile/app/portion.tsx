import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateMealEntry, useDeleteMealEntry, useListFoods, useListMealEntries, useUpdateMealEntry, type Food, type Meal } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, Screen, Title, success, tap, warn } from '@/components/ui';
import { cap, dateLabel, n } from '@/lib/format';

const mealOptions: { value: Meal; label: string }[] = (['breakfast', 'lunch', 'dinner', 'snack'] as Meal[]).map(m => ({ value: m, label: cap(m) }));

function Portion() {
  const c = useColors();
  const router = useRouter();
  const { meal: mealParam, entryId } = useLocalSearchParams<{ meal?: string; entryId?: string }>();
  const { person, date, refreshEntries } = usePlanner();
  const entries = useListMealEntries({ personId: person.id, date });
  const entry = entryId ? entries.data?.find(e => e.id === Number(entryId)) : undefined;
  const create = useCreateMealEntry();
  const update = useUpdateMealEntry();
  const remove = useDeleteMealEntry();
  const [search, setSearch] = useState('');
  const foods = useListFoods(search.trim() ? { search: search.trim() } : undefined);
  const [selected, setSelected] = useState<Food | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [grams, setGrams] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (entryId && entries.isLoading) return <Screen title="Edit portion"><LoadingBlock rows={2} /></Screen>;
  if (entryId && entries.isError) return <Screen title="Edit portion"><ErrorBox error={entries.error} onRetry={() => entries.refetch()} /></Screen>;
  if (entryId && !entry) return <Screen title="Edit portion"><ErrorBox error={new Error('This portion no longer exists for the selected person and date.')} /></Screen>;

  const chosenMeal: Meal = meal ?? entry?.meal ?? (mealOptions.some(m => m.value === mealParam) ? (mealParam as Meal) : 'breakfast');
  const gramsText = grams ?? String(entry?.grams ?? 100);
  const amount = Number(gramsText);
  const food = entry?.food ?? selected;
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 3000;
  const scaled = food && valid ? { kcal: food.caloriesPer100g * amount / 100, p: food.proteinPer100g * amount / 100, cb: food.carbsPer100g * amount / 100, f: food.fatPer100g * amount / 100 } : null;

  async function submit() {
    if (!valid || !food) { setProblem('Choose a food and enter a portion between 1 and 3,000 grams.'); warn(); return; }
    setProblem(null);
    try {
      if (entry) await update.mutateAsync({ id: entry.id, data: { meal: chosenMeal, grams: amount } });
      else await create.mutateAsync({ data: { date, personId: person.id, meal: chosenMeal, foodId: food.id, grams: amount } });
      refreshEntries(); success(); router.back();
    } catch { warn(); }
  }
  async function del() {
    if (!entry) return;
    try { await remove.mutateAsync({ id: entry.id }); refreshEntries(); success(); router.back(); } catch { warn(); }
  }
  const err = create.error ?? update.error;

  return <Screen title={entry ? 'Edit portion' : 'Add portion'}>
    <Eyebrow>{entry ? 'Adjust portion' : 'New portion'} / {dateLabel(date)}</Eyebrow>
    <Title sub={`For ${person.name}.`}>{entry ? 'Make an adjustment.' : 'Add to your day.'}</Title>
    {entry ? <Card tone="mint"><Eyebrow>Food</Eyebrow><Text style={{ fontFamily: F.bold, fontSize: 16, color: c.foreground }}>{entry.food.name}</Text><Muted>Food cannot be changed on an existing entry. Delete it and add another instead.</Muted></Card> : <>
      <Field label="Find a food in your catalog" value={search} onChangeText={setSearch} placeholder="Search saved and reference foods" autoCapitalize="none" testID="input-portion-food-search" />
      {foods.isLoading ? <LoadingBlock rows={3} height={52} /> : foods.isError ? <ErrorBox error={foods.error} onRetry={() => foods.refetch()} /> : !foods.data?.length ? <Muted>No matching foods in your catalog.</Muted> :
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden', backgroundColor: c.card }}>
          {foods.data.slice(0, 40).map(f => { const on = selected?.id === f.id; return <Pressable key={f.id} testID={`button-select-food-${f.id}`} onPress={() => { tap(); setSelected(f); }} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 13, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: on ? c.accent : 'transparent' }}>
            <Text style={{ flex: 1, fontFamily: on ? F.bold : F.medium, fontSize: 14, color: on ? c.primary : c.foreground }}>{f.name}<Text style={{ fontFamily: F.regular, fontSize: 11, color: c.mutedForeground }}>  {f.source === 'open_food_facts' ? 'Saved' : cap(f.category)}</Text></Text>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>{n(f.caloriesPer100g)} kcal</Text></Pressable>; })}
        </View>}
    </>}
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: '#3c575e' }}>Meal</Text>
    <Chips testPrefix="select-portion-meal" value={chosenMeal} onChange={setMeal} options={mealOptions} />
    <Field label="Portion in grams" value={gramsText} onChangeText={setGrams} keyboardType="decimal-pad" testID="input-portion-grams" />
    {food ? <Card>
      <Eyebrow>{food.name} / {valid ? n(amount, 1) : '?'} g</Eyebrow>
      {scaled ? <Text style={{ fontFamily: F.bold, fontSize: 22, color: c.foreground }}>{n(scaled.kcal)} kcal <Text style={{ fontSize: 12, fontFamily: F.medium, color: c.mutedForeground }}>P {n(scaled.p, 1)} · C {n(scaled.cb, 1)} · F {n(scaled.f, 1)} g</Text></Text> : <Muted>Enter 1 to 3,000 g to preview.</Muted>}
      <Muted>Calcium {food.calciumMgPer100g === null ? 'unknown' : `${n(food.calciumMgPer100g * (valid ? amount : 0) / 100, 1)} mg`} · Iron {food.ironMgPer100g === null ? 'unknown' : `${n(food.ironMgPer100g * (valid ? amount : 0) / 100, 2)} mg`}</Muted>
    </Card> : null}
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    <Btn label={entry ? 'Save portion' : 'Add to plan'} icon="check" loading={create.isPending || update.isPending} onPress={() => void submit()} testID="button-save-portion" />
    {entry ? (confirmDelete ? <Card tone="danger">
      <Text style={{ fontFamily: F.bold, color: '#943d33', fontSize: 15 }}>Remove {entry.food.name} from {cap(entry.meal)}?</Text>
      {remove.isError ? <ErrorBox error={remove.error} /> : null}
      <Btn variant="danger" icon="trash-2" label="Yes, delete portion" loading={remove.isPending} testID="button-confirm-delete-portion" onPress={() => void del()} />
      <Btn variant="ghost" label="Keep it" testID="button-cancel-delete-portion" onPress={() => setConfirmDelete(false)} />
    </Card> : <Btn variant="danger" icon="trash-2" label="Delete portion" testID="button-delete-portion" onPress={() => setConfirmDelete(true)} />) : null}
  </Screen>;
}
export default function PortionRoute() { return <Portion />; }
