import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { dietPhaseLabels } from '@/lib/tennis-planning';
import { useGetDailySummary, useGetDayActivity, useListMealEntries, type Meal } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { usePlannerLayout } from '@/contexts/PlannerLayoutProvider';
import { useColors } from '@/hooks/useColors';
import { MealTimeControl } from '@/components/MealTimeControl';
import { MealAlertsControl } from '@/components/MealAlertsControl';
import { PrintDayPlanButton } from '@/components/PrintDayPlanButton';
import { getMealTimes } from '@/lib/meal-scheduling';
import { ReferencePanel } from '@/components/ReferencePanel';
import { TennisPlanPanel } from '@/components/TennisPlanPanel';
import { PlanningTargets } from '@/components/PlanningTargets';
import { SleepLogCard } from '@/components/SleepLogCard';
import { HydrationCard } from '@/components/HydrationCard';
import type { PlannerSection } from '@/lib/planner-layout-preferences';
import { Btn, CaloriesMacros, Card, DISCLAIMER, ErrorBox, Eyebrow, F, FiberNote, IconBtn, LoadingBlock, Muted, NutritionGrid, Screen, SectionTitle, Title, tap, warn } from '@/components/ui';
import { cap, dateLabel, isIsoDate, n, shiftDate, today } from '@/lib/format';

const meals: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Planner() {
  const c = useColors();
  const router = useRouter();
  const { person, date, setDate } = usePlanner();
  const { settings, updateSettings } = usePlannerLayout();
  const [reordering, setReordering] = useState(false);
  const showDetails = settings.mode === 'current';
  const params = { personId: person.id, date };
  const summary = useGetDailySummary(params);
  const entries = useListMealEntries(params);
  const day = useGetDayActivity(params);
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft && isIsoDate(draft)) setDate(draft);
    setDraft(null);
  }
  const planningInformation = <>
    <Card>
      <Eyebrow>Planning targets</Eyebrow>
      <PlanningTargets person={person} date={date} testPrefix="planner-target" showDetails={showDetails} />
    </Card>
    <ReferencePanel person={person} date={date} totals={summary.data?.totals} summaryLoading={summary.isLoading} summaryError={summary.isError} showDetails={showDetails} />
    {summary.isError ? <ErrorBox error={summary.error} onRetry={() => summary.refetch()} /> : null}
  </>;
  const mealActions = <>
    <SectionTitle kicker="Meals">Planned portions</SectionTitle>
    {showDetails ? <Muted>Meal times are editable suggestions for this day — adjust for routine, appetite or training. Foods inherit their meal time; tennis-timed portions keep their own saved slot time, so changing a meal time does not retime them.</Muted> : null}
    {day.isError ? <ErrorBox error={day.error} onRetry={() => day.refetch()} /> : null}
    {entries.isLoading ? <LoadingBlock rows={3} /> : entries.isError ? <ErrorBox error={entries.error} onRetry={() => entries.refetch()} /> : meals.map(meal => {
      const list = (entries.data ?? []).filter(e => e.meal === meal);
      const ms = summary.data?.meals.find(m => m.meal === meal);
      return <Card key={meal}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, fontSize: 18, color: c.foreground }}>{cap(meal)}</Text><Muted>{list.length} {list.length === 1 ? 'portion' : 'portions'}</Muted></View>
          <Btn small icon="plus" label="Add" testID={`button-add-${meal}`} onPress={() => router.push({ pathname: '/portion', params: { meal } })} />
        </View>
        {day.isError ? <Muted>Meal time unavailable.</Muted> : <MealTimeControl personId={person.id} date={date} meal={meal} time={getMealTimes(day.data?.mealTimes)[meal]} loading={day.isLoading} />}
        <MealAlertsControl personId={person.id} date={date} meal={meal} mealTime={getMealTimes(day.data?.mealTimes)[meal]} alerts={day.data?.mealAlerts?.[meal]} loading={day.isLoading} error={day.isError} showDetails={showDetails} />
        {summary.isLoading ? <LoadingBlock rows={1} height={70} /> : !summary.isError && ms ? <CaloriesMacros calories={ms.nutrition.calories} protein={ms.nutrition.protein} carbs={ms.nutrition.carbs} fat={ms.nutrition.fat} testPrefix={`meal-${meal}`} /> : null}
        {list.length === 0 ? <Muted>Nothing planned for {meal} yet.</Muted> : list.map(e => <Pressable key={e.id} testID={`row-entry-${e.id}`} onPress={() => { tap(); router.push({ pathname: '/portion', params: { meal, entryId: String(e.id) } }); }}
          style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 14, color: c.foreground }}>{e.food.name}</Text>
            <CaloriesMacros calories={e.nutrition.calories} protein={e.nutrition.protein} carbs={e.nutrition.carbs} fat={e.nutrition.fat} testPrefix={`entry-${e.id}`} />
          </View>
          <Muted>{n(e.grams, 1)} g · tap to edit</Muted>
          {(() => { const d = e.tennisDietId ? day.data?.tennis?.diets?.find(x => x.id === e.tennisDietId) : undefined; return d ? <Text testID={`badge-entry-timing-${e.id}`} style={{ fontFamily: F.bold, fontSize: 11.5, color: c.primary }}>{dietPhaseLabels[d.phase]} · {d.time}</Text> : null; })()}
        </Pressable>)}
      </Card>;
    })}
  </>;
  const dayTotalsSection = summary.isLoading ? <LoadingBlock rows={1} height={94} /> : summary.data && !summary.isError ? <Card>
    <Eyebrow>Day totals / planned</Eyebrow>
    <CaloriesMacros large calories={summary.data.totals.calories} protein={summary.data.totals.protein} carbs={summary.data.totals.carbs} fat={summary.data.totals.fat} testPrefix="planner-total" />
  </Card> : null;
  const sleepLogSection = <SleepLogCard personId={person.id} personName={person.name} date={date} dateOfBirth={person.dateOfBirth} />;
  const tennisPlanSection = <TennisPlanPanel key={`${person.id}-${date}`} person={person} date={date} showDetails={showDetails} />;
  const sectionLabels: Record<PlannerSection, string> = {
    sleep: 'Sleep log', totals: 'Day totals', tennis: 'Tennis plan', guidance: 'Planning guidance', hydration: 'Hydration', meals: 'Planned portions',
  };
  const sectionNodes: Record<PlannerSection, ReactNode> = {
    sleep: sleepLogSection,
    totals: dayTotalsSection,
    tennis: tennisPlanSection,
    guidance: planningInformation,
    hydration: <HydrationCard personId={person.id} date={date} personName={person.name} dateOfBirth={person.dateOfBirth} sex={person.growthReferenceSex} day={day.data} />,
    meals: mealActions,
  };
  async function moveSection(section: PlannerSection, delta: -1 | 1) {
    const next = [...settings.sectionOrder];
    const index = next.indexOf(section);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    if (!(await updateSettings({ sectionOrder: next }))) warn();
  }
  return <Screen tabs onRefresh={() => { summary.refetch(); entries.refetch(); day.refetch(); }} refreshing={summary.isRefetching || entries.isRefetching || day.isRefetching}>
    <Eyebrow>02 / Day planner</Eyebrow>
    <Title sub={showDetails ? `${dateLabel(date)} · ${person.name}'s plan.` : undefined}>Shape the day.</Title>
    <View testID="control-plan-date" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconBtn icon="chevron-left" label="Previous day" testID="button-previous-day" onPress={() => setDate(shiftDate(date, -1))} />
      <TextInput testID="input-plan-date" value={draft ?? date} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10}
        style={{ flex: 1, minHeight: 42, borderRadius: 999, borderWidth: 1, borderColor: draft !== null && !isIsoDate(draft) ? c.destructiveBorder : c.input, backgroundColor: c.card, textAlign: 'center', fontFamily: F.bold, fontSize: 14, color: c.foreground }} />
      <IconBtn icon="chevron-right" label="Next day" testID="button-next-day" onPress={() => setDate(shiftDate(date, 1))} />
      {date !== today() ? <Btn small variant="ghost" label="Today" testID="button-today" onPress={() => setDate(today())} /> : null}
    </View>
    <Pressable testID="button-planner-person" onPress={() => { tap(); router.push('/people'); }}><Muted>Planning for <Text style={{ fontFamily: F.bold, color: c.primary }}>{person.name}</Text> · tap to switch person</Muted></Pressable>
    <Btn icon="calendar" variant="ghost" label="Meal history & ratings" testID="button-meal-history" onPress={() => router.push('/meal-history')} />
    <PrintDayPlanButton
      personName={person.name}
      date={date}
      activityType={day.data?.activityType ?? 'rest'}
      tennisPlan={day.data?.tennis}
      entries={entries.data ?? []}
      mealTimes={getMealTimes(day.data?.mealTimes)}
      tennisDiets={day.data?.tennis?.diets ?? []}
      sleepLog={day.data?.sleep}
      hydration={day.data?.hydration}
      disabled={!entries.isSuccess || !day.isSuccess || entries.isFetching || day.isFetching}
    />
      <Btn small variant="ghost" label={reordering ? 'Done reordering' : 'Reorder sections'} testID="button-toggle-section-reorder" onPress={() => setReordering(value => !value)} />
    {settings.sectionOrder.map((section, index) => <View key={section} testID={`planner-section-${section}`} style={{ gap: 6 }}>
      {reordering ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Muted>{index + 1} of {settings.sectionOrder.length} · {sectionLabels[section]}</Muted>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Btn small variant="ghost" icon="chevron-up" label="Up" testID={`button-move-section-${section}-up`} disabled={index === 0} onPress={() => void moveSection(section, -1)} />
          <Btn small variant="ghost" icon="chevron-down" label="Down" testID={`button-move-section-${section}-down`} disabled={index === settings.sectionOrder.length - 1} onPress={() => void moveSection(section, 1)} />
        </View>
      </View> : null}
      {sectionNodes[section]}
    </View>)}
    {summary.data ? <Card><Eyebrow>Day totals</Eyebrow><NutritionGrid nutrition={summary.data.totals} /><FiberNote /></Card> : null}
    <Muted>{DISCLAIMER}</Muted>
  </Screen>;
}
