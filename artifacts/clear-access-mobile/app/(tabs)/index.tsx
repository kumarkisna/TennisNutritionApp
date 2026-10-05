import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useGetDailySummary, type Meal } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, CaloriesMacros, Card, DISCLAIMER, ErrorBox, Eyebrow, F, FiberNote, LoadingBlock, Muted, NutritionGrid, Screen, SectionTitle, Title, tap } from '@/components/ui';
import { cap, dateLabel, n } from '@/lib/format';
import { PlanningTargets } from '@/components/PlanningTargets';

const meals: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Overview() {
  const c = useColors();
  const router = useRouter();
  const { person, date, setDate } = usePlanner();
  const summary = useGetDailySummary({ date, personId: person.id });
  const total = summary.data?.totals.calories ?? 0;
  const targetCalories = summary.data?.targetCalories ?? null;
  const pct = targetCalories === null ? 0 : Math.min(100, Math.max(0, (total / targetCalories) * 100));

  return <Screen tabs onRefresh={() => summary.refetch()} refreshing={summary.isRefetching}>
    <Eyebrow>01 / Daily overview</Eyebrow>
    <Title sub={`${dateLabel(date)} · ${person.name}'s own meals and daily target.`}>{`A clear day ahead, ${person.name}.`}</Title>
    <Pressable testID="button-switch-person" onPress={() => { tap(); router.push('/people'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.accent, borderColor: c.accentBorder, borderWidth: 1, borderRadius: 16, padding: 14 }}>
      <Feather name="users" size={18} color={c.primary} />
      <View style={{ flex: 1 }}><Eyebrow>Planning for</Eyebrow><Text style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{person.name}</Text></View>
      <Text style={{ fontFamily: F.semi, fontSize: 12, color: c.primary }}>Manage people</Text>
      <Feather name="chevron-right" size={16} color={c.primary} />
    </Pressable>
    <Card tone="ink" style={{ gap: 14 }}>
      <Eyebrow light>Planned calories + macros</Eyebrow>
      {summary.isLoading ? <LoadingBlock rows={1} height={64} /> : summary.isError ? <ErrorBox error={summary.error} onRetry={() => summary.refetch()} /> : <>
        <CaloriesMacros large light calories={total} protein={summary.data?.totals.protein ?? 0} carbs={summary.data?.totals.carbs ?? 0} fat={summary.data?.totals.fat ?? 0} testPrefix="total" />
        {targetCalories === null
          ? <Text style={{ fontFamily: F.regular, fontSize: 12, color: c.inkSoft }}>Adult calorie estimate unavailable for this person and date. See planning targets for the reason.</Text>
          : <View style={{ height: 8, borderRadius: 4, backgroundColor: c.inkSecondary, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 8, backgroundColor: c.mint, borderRadius: 4 }} /></View>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.regular, fontSize: 12, color: c.inkSoft }}>{summary.data?.entryCount ?? 0} portions planned</Text>
           <Text testID="value-overview-target" style={{ fontFamily: F.regular, fontSize: 12, color: c.inkSoft }}>{targetCalories === null ? 'Adult estimate unavailable' : `Calorie target ${n(targetCalories)} kcal`}</Text>
        </View></>}
    </Card>
    <Btn label="Plan this day" icon="arrow-right" testID="link-overview-plan-day" onPress={() => { setDate(date); router.push('/planner'); }} />
    <Btn variant="ghost" label="Height history & CDC chart" icon="trending-up" testID="button-overview-height-chart" onPress={() => router.push('/height')} />
    <Btn variant="ghost" label="Weight progress & target" icon="activity" testID="button-overview-weight-progress" onPress={() => router.push('/weight')} />
    <Card>
      <Eyebrow>{person.name}'s planning targets</Eyebrow>
      <PlanningTargets person={person} date={date} />
      <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" label="Adjust details and goals" icon="arrow-right" testID="link-overview-settings" onPress={() => router.push('/settings')} /></View>
      <View style={{ alignSelf: 'flex-start' }}><Btn small variant="ghost" label="Change this day's activity" testID="link-overview-target-activity" onPress={() => router.push('/planner')} /></View>
    </Card>
    <SectionTitle kicker="Day at a glance">The four moments</SectionTitle>
    {summary.isLoading ? <LoadingBlock rows={2} height={64} /> : summary.isError ? <ErrorBox error={summary.error} onRetry={() => summary.refetch()} /> : meals.map((meal, i) => {
      const d = summary.data?.meals.find(m => m.meal === meal);
      return <Pressable key={meal} testID={`link-overview-meal-${meal}`} onPress={() => { tap(); setDate(date); router.push('/planner'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 18, padding: 16 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 11, color: c.primary }}>0{i + 1}</Text>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{cap(meal)}</Text><Muted>{d?.count ?? 0} {d?.count === 1 ? 'portion' : 'portions'}</Muted></View>
        <CaloriesMacros calories={d?.nutrition.calories ?? 0} protein={d?.nutrition.protein ?? 0} carbs={d?.nutrition.carbs ?? 0} fat={d?.nutrition.fat ?? 0} testPrefix={`overview-${meal}`} />
        <Feather name="chevron-right" size={16} color={c.mutedForeground} />
      </Pressable>;
    })}
    <SectionTitle kicker="Nutrition / total">More than a number</SectionTitle>
    {summary.data ? <Card><NutritionGrid nutrition={summary.data.totals} /><FiberNote /></Card> : summary.isLoading ? <LoadingBlock rows={1} /> : null}
    <Card tone="mint">
      <Eyebrow>The food library</Eyebrow>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Know what goes in.</Text>
      <Muted>Browse the food library saved on this device or add your own foods.</Muted>
      <View style={{ alignSelf: 'flex-start' }}><Btn small label="Explore foods" icon="arrow-right" testID="link-overview-foods" onPress={() => router.push('/foods')} /></View>
    </Card>
    <Card>
      <Eyebrow>On this device</Eyebrow>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: c.foreground }}>Your planner and food library are stored locally on this device.</Text>
    </Card>
    <Muted>{DISCLAIMER}</Muted>
  </Screen>;
}
