import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateMealEntry, useDeleteMealEntry, useGetDayActivity, useListFoods, useListMealEntries, useUpdateMealEntry, type Food, type Meal } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, CaloriesMacros, Card, Chips, ErrorBox, Eyebrow, F, Field, LoadingBlock, Muted, Screen, Title, success, tap, warn } from '@/components/ui';
import { MealTimeControl } from '@/components/MealTimeControl';
import { getMealTimes } from '@/lib/meal-scheduling';
import { dietPhaseLabels } from '@/lib/tennis-planning';
import { cap, dateLabel, n } from '@/lib/format';

const mealOptions: { value: Meal; label: string }[] = (['breakfast', 'lunch', 'dinner', 'snack'] as Meal[]).map(m => ({ value: m, label: cap(m) }));

function Portion() {
  const c = useColors();
  const router = useRouter();
  const { meal: mealParam, entryId, tennisDietId } = useLocalSearchParams<{ meal?: string; entryId?: string; tennisDietId?: string }>();
  const { person, date, refreshEntries } = usePlanner();
  const day = useGetDayActivity({ personId: person.id, date });
  const [slot, setSlot] = useState<string | null | undefined>(undefined);
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
  const [mealTimeEditing, setMealTimeEditing] = useState(false);

  if (day.isLoading) return <Screen title="Portion"><LoadingBlock rows={2} /></Screen>;
  if (day.isError) return <Screen title="Portion"><ErrorBox error={day.error} onRetry={() => day.refetch()} /></Screen>;
  if (entryId && entries.isLoading) return <Screen title="Edit portion"><LoadingBlock rows={2} /></Screen>;
  if (entryId && entries.isError) return <Screen title="Edit portion"><ErrorBox error={entries.error} onRetry={() => entries.refetch()} /></Screen>;
  if (entryId && !entry) return <Screen title="Edit portion"><ErrorBox error={new Error('This portion no longer exists for the selected person and date.')} /></Screen>;

  const diets = [...(day.data?.tennis?.diets ?? [])].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const initialSlot: string | null = entry ? entry.tennisDietId ?? null : tennisDietId ?? null;
  const chosenSlot: string | null = slot !== undefined ? slot : initialSlot;
  const slotDiet = chosenSlot ? diets.find(d => d.id === chosenSlot) : undefined;
  const slotMissing = chosenSlot !== null && !slotDiet;
  const pending = create.isPending || update.isPending || remove.isPending;
  const chosenMeal: Meal = meal ?? entry?.meal ?? (mealOptions.some(m => m.value === mealParam) ? (mealParam as Meal) : 'breakfast');
  const gramsText = grams ?? String(entry?.grams ?? 100);
  const amount = Number(gramsText);
  const food = entry?.food ?? selected;
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 3000;
  const scaled = food && valid ? { kcal: food.caloriesPer100g * amount / 100, p: food.proteinPer100g * amount / 100, cb: food.carbsPer100g * amount / 100, f: food.fatPer100g * amount / 100 } : null;

  async function submit() {
    if (mealTimeEditing) { setProblem('Save or cancel the meal time before saving this portion.'); return; }
    if (!valid || !food) { setProblem('Choose a food and enter a portion between 1 and 3,000 grams.'); warn(); return; }
    if (slotMissing) { setProblem('The chosen timetable slot no longer exists. Pick another slot or No scheduled time.'); warn(); return; }
    setProblem(null);
    try {
      // null explicitly clears the slot; a string assigns it.
      if (entry) await update.mutateAsync({ id: entry.id, data: { meal: chosenMeal, grams: amount, tennisDietId: chosenSlot } });
      else await create.mutateAsync({ data: { date, personId: person.id, meal: chosenMeal, foodId: food.id, grams: amount, tennisDietId: chosenSlot } });
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
      <Field label="Find a food in your catalog" value={search} onChangeText={setSearch} placeholder="Search saved and reference foods" editable={!pending} autoCapitalize="none" testID="input-portion-food-search" />
      {foods.isLoading ? <LoadingBlock rows={3} height={52} /> : foods.isError ? <ErrorBox error={foods.error} onRetry={() => foods.refetch()} /> : !foods.data?.length ? <Muted>No matching foods in your catalog.</Muted> :
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden', backgroundColor: c.card }}>
          {foods.data.slice(0, 40).map(f => { const on = selected?.id === f.id; return <Pressable key={f.id} disabled={pending} testID={`button-select-food-${f.id}`} onPress={() => { tap(); setSelected(f); }} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 13, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: on ? c.accent : 'transparent' }}>
            <Text style={{ flex: 1, fontFamily: on ? F.bold : F.medium, fontSize: 14, color: on ? c.primary : c.foreground }}>{f.name}<Text style={{ fontFamily: F.regular, fontSize: 11, color: c.mutedForeground }}>  {f.source === 'open_food_facts' ? 'Saved' : cap(f.category)}</Text></Text>
            <CaloriesMacros calories={f.caloriesPer100g} protein={f.proteinPer100g} carbs={f.carbsPer100g} fat={f.fatPer100g} testPrefix={`portion-food-${f.id}`} /></Pressable>; })}
        </View>}
    </>}
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>Meal</Text>
    <Chips testPrefix="select-portion-meal" value={chosenMeal} onChange={setMeal} options={mealOptions} disabled={pending || mealTimeEditing} />
    {slotDiet ? <Muted>{dietPhaseLabels[slotDiet.phase]} · {slotDiet.time}. This tennis slot time overrides the meal time.</Muted> : <>
      <Muted>Scheduled {cap(chosenMeal)} at {getMealTimes(day.data?.mealTimes)[chosenMeal]}, inherited by foods in this meal.</Muted>
      <MealTimeControl personId={person.id} date={date} meal={chosenMeal} time={getMealTimes(day.data?.mealTimes)[chosenMeal]} disabled={pending} onEditingChange={setMealTimeEditing} />
    </>}
    <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: c.foreground }}>Timetable slot</Text>
    <Chips testPrefix="select-portion-slot" value={chosenSlot ?? 'none'} onChange={v => setSlot(v === 'none' ? null : v)} disabled={pending || mealTimeEditing}
      options={[{ value: 'none', label: 'No scheduled time' }, ...diets.map(d => ({ value: d.id, label: `${dietPhaseLabels[d.phase]} ${d.time}` })), ...(slotMissing && chosenSlot ? [{ value: chosenSlot, label: 'Missing slot' }] : [])]} />
    <Muted style={undefined}>{slotDiet ? `Scheduled: ${dietPhaseLabels[slotDiet.phase]} at ${slotDiet.time}. Counted once in totals, shown under this slot and ${cap(chosenMeal)}.` : slotMissing ? 'That slot no longer exists, so saving is blocked.' : 'No scheduled time. Choose No scheduled time to clear any slot.'}</Muted>
    {slotMissing ? <ErrorBox error={new Error('The route slot no longer exists. Choose an existing slot or No scheduled time.')} /> : null}
    <Field label="Portion in grams" value={gramsText} onChangeText={setGrams} editable={!pending} keyboardType="decimal-pad" testID="input-portion-grams" />
    {food ? <Card>
      <Eyebrow>{food.name} / {valid ? n(amount, 1) : '?'} g</Eyebrow>
      {scaled ? <>
        <CaloriesMacros large calories={scaled.kcal} protein={scaled.p} carbs={scaled.cb} fat={scaled.f} testPrefix="portion-preview" />
      </> : <Muted>Enter 1 to 3,000 g to preview.</Muted>}
      <Muted>Calcium {food.calciumMgPer100g === null ? 'unknown' : `${n(food.calciumMgPer100g * (valid ? amount : 0) / 100, 1)} mg`} · Iron {food.ironMgPer100g === null ? 'unknown' : `${n(food.ironMgPer100g * (valid ? amount : 0) / 100, 2)} mg`}</Muted>
    </Card> : null}
    {problem ? <ErrorBox error={new Error(problem)} /> : null}
    {err ? <ErrorBox error={err} /> : null}
    {mealTimeEditing ? <Muted>Save or cancel the meal time above before saving this food portion.</Muted> : null}
    <Btn label={entry ? 'Save portion' : 'Add to plan'} icon="check" loading={create.isPending || update.isPending} disabled={pending || slotMissing || mealTimeEditing} onPress={() => void submit()} testID="button-save-portion" />
    {entry ? (confirmDelete ? <Card tone="danger">
      <Text style={{ fontFamily: F.bold, color: c.destructive, fontSize: 15 }}>Remove {entry.food.name} from {cap(entry.meal)}?</Text>
      {remove.isError ? <ErrorBox error={remove.error} /> : null}
      <Btn variant="danger" icon="trash-2" label="Yes, delete portion" loading={remove.isPending} disabled={pending || mealTimeEditing} testID="button-confirm-delete-portion" onPress={() => void del()} />
      <Btn variant="ghost" label="Keep it" disabled={pending || mealTimeEditing} testID="button-cancel-delete-portion" onPress={() => setConfirmDelete(false)} />
    </Card> : <Btn variant="danger" icon="trash-2" label="Delete portion" disabled={pending || mealTimeEditing} testID="button-delete-portion" onPress={() => setConfirmDelete(true)} />) : null}
  </Screen>;
}
export default function PortionRoute() {
  const { person, date } = usePlanner();
  const { entryId, tennisDietId, meal } = useLocalSearchParams<{ entryId?: string; tennisDietId?: string; meal?: string }>();
  return <Portion key={`${person.id}-${date}-${entryId ?? ''}-${tennisDietId ?? ''}-${meal ?? ''}`} />;
}
