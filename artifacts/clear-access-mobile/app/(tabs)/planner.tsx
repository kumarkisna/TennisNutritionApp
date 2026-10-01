import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGetDailySummary, useListMealEntries, type Meal } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { ReferencePanel } from '@/components/ReferencePanel';
import { PlanningTargets } from '@/components/PlanningTargets';
import { Btn, CaloriesMacros, Card, DISCLAIMER, ErrorBox, Eyebrow, F, FiberNote, IconBtn, LoadingBlock, Muted, NutritionGrid, Screen, SectionTitle, Title, tap } from '@/components/ui';
import { cap, dateLabel, isIsoDate, n, shiftDate, today } from '@/lib/format';

const meals: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Planner() {
  const c = useColors();
  const router = useRouter();
  const { person, date, setDate } = usePlanner();
  const params = { personId: person.id, date };
  const summary = useGetDailySummary(params);
  const entries = useListMealEntries(params);
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft && isIsoDate(draft)) setDate(draft);
    setDraft(null);
  }
  return <Screen tabs onRefresh={() => { summary.refetch(); entries.refetch(); }} refreshing={summary.isRefetching || entries.isRefetching}>
    <Eyebrow>02 / Day planner</Eyebrow>
    <Title sub={`${dateLabel(date)} · ${person.name}'s plan.`}>Shape the day.</Title>
    <View testID="control-plan-date" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconBtn icon="chevron-left" label="Previous day" testID="button-previous-day" onPress={() => setDate(shiftDate(date, -1))} />
      <TextInput testID="input-plan-date" value={draft ?? date} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10}
        style={{ flex: 1, minHeight: 42, borderRadius: 999, borderWidth: 1, borderColor: draft !== null && !isIsoDate(draft) ? c.destructive : c.input, backgroundColor: c.card, textAlign: 'center', fontFamily: F.bold, fontSize: 14, color: c.foreground }} />
      <IconBtn icon="chevron-right" label="Next day" testID="button-next-day" onPress={() => setDate(shiftDate(date, 1))} />
      {date !== today() ? <Btn small variant="ghost" label="Today" testID="button-today" onPress={() => setDate(today())} /> : null}
    </View>
    <Pressable testID="button-planner-person" onPress={() => { tap(); router.push('/people'); }}><Muted>Planning for <Text style={{ fontFamily: F.bold, color: c.primary }}>{person.name}</Text> · tap to switch person</Muted></Pressable>

    {summary.isLoading ? <LoadingBlock rows={1} height={94} /> : summary.data && !summary.isError ? <Card>
      <Eyebrow>Day totals / planned</Eyebrow>
      <CaloriesMacros large calories={summary.data.totals.calories} protein={summary.data.totals.protein} carbs={summary.data.totals.carbs} fat={summary.data.totals.fat} testPrefix="planner-total" />
    </Card> : null}
    <Card>
      <Eyebrow>Planning targets</Eyebrow>
      <PlanningTargets person={person} date={date} testPrefix="planner-target" />
    </Card>
    <ReferencePanel person={person} date={date} totals={summary.data?.totals} summaryLoading={summary.isLoading} summaryError={summary.isError} />
    {summary.isError ? <ErrorBox error={summary.error} onRetry={() => summary.refetch()} /> : null}

    <SectionTitle kicker="Meals">Planned portions</SectionTitle>
    {entries.isLoading ? <LoadingBlock rows={3} /> : entries.isError ? <ErrorBox error={entries.error} onRetry={() => entries.refetch()} /> : meals.map(meal => {
      const list = (entries.data ?? []).filter(e => e.meal === meal);
      const ms = summary.data?.meals.find(m => m.meal === meal);
      return <Card key={meal}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
           <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>{cap(meal)}</Text><Muted>{list.length} {list.length === 1 ? 'portion' : 'portions'}</Muted></View>
          <Btn small icon="plus" label="Add" testID={`button-add-${meal}`} onPress={() => router.push({ pathname: '/portion', params: { meal } })} />
        </View>
        {summary.isLoading ? <LoadingBlock rows={1} height={70} /> : !summary.isError && ms ? <CaloriesMacros calories={ms.nutrition.calories} protein={ms.nutrition.protein} carbs={ms.nutrition.carbs} fat={ms.nutrition.fat} testPrefix={`meal-${meal}`} /> : null}
        {list.length === 0 ? <Muted>Nothing planned for {meal} yet.</Muted> : list.map(e => <Pressable key={e.id} testID={`row-entry-${e.id}`} onPress={() => { tap(); router.push({ pathname: '/portion', params: { meal, entryId: String(e.id) } }); }}
          style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{e.food.name}</Text>
            <CaloriesMacros calories={e.nutrition.calories} protein={e.nutrition.protein} carbs={e.nutrition.carbs} fat={e.nutrition.fat} testPrefix={`entry-${e.id}`} />
          </View>
          <Muted>{n(e.grams, 1)} g · tap to edit</Muted>
        </Pressable>)}
      </Card>;
    })}
    {summary.data ? <Card><Eyebrow>Day totals</Eyebrow><NutritionGrid nutrition={summary.data.totals} /><FiberNote /></Card> : null}
    <Muted>{DISCLAIMER}</Muted>
  </Screen>;
}
