import { Linking, Text, View } from 'react-native';
import { useGetDayActivity, type Person } from '@/lib/local-api';
import { activityCaloriesPerKg, calculatePlanningEstimates, getPlanningTargets, nutritionSources, sportsActivities } from '@/lib/planning-targets';
import { useColors } from '@/hooks/useColors';
import { dateLabel, n } from '@/lib/format';
import { ErrorBox, F, LoadingBlock, Muted } from './ui';

export function PlanningTargets({ person, date, testPrefix = 'target' }: {
  person: Person; date: string; testPrefix?: string;
}) {
  const c = useColors();
  const activity = useGetDayActivity({ personId: person.id, date });
  if (activity.isLoading) return <LoadingBlock rows={1} height={140} />;
  if (activity.isError) return <ErrorBox error={activity.error} onRetry={() => activity.refetch()} />;
  if (!activity.data) return <Muted>Planning references are unavailable.</Muted>;
  const selected = activity.data.activityType;
  const targets = getPlanningTargets(person, selected, date);
  const estimates = calculatePlanningEstimates(person, selected, date);
  const labels = {
    calories: 'Calories · adult estimate',
    protein: 'Protein · reference',
    carbs: sportsActivities[selected].carbs ? 'Carbs · workbook reference' : 'Carbs · ISSN general fitness',
    fat: 'Fat · adult estimate',
  };
  return <View style={{ gap: 12 }}>
    <Muted>{dateLabel(date)} · {sportsActivities[selected].label}</Muted>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {(Object.keys(targets) as (keyof typeof targets)[]).map(key => <View key={key} style={{ flexBasis: '45%', flexGrow: 1, backgroundColor: c.secondary, borderRadius: 12, padding: 12, gap: 6 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 10, color: c.mutedForeground }}>{labels[key]}</Text>
        <Text testID={`value-${testPrefix}-${key}`} style={{ fontFamily: F.bold, fontSize: 17, color: key === 'protein' || key === 'carbs' ? c.primary : c.foreground }}>{targets[key]}</Text>
      </View>)}
    </View>
    <Muted>Calories use an app-chosen planning heuristic: {person.weightKg === null ? 'body weight' : `${n(person.weightKg, 1)} kg`} × {activityCaloriesPerKg[selected]} kcal/kg/day for this activity, rounded to whole kcal. The ISSN review discusses general fitness at 25–35 kcal/kg/day and frequent demanding training at 50–80; these activity-specific values are not official ISSN or CDC rules. Fat uses an app-chosen 30% of estimated calories ÷ 9 kcal/g; the review's 20–35% energy range is context, not a prescribed fat intake.</Muted>
    <Muted>{estimates.unavailableReason ?? 'Adult-only rough estimate; not a clinical requirement.'} Adult estimates are intentionally unavailable when age is unknown or under 18.</Muted>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(nutritionSources.exerciseNutrition)} style={{ color: c.primary, textDecorationLine: 'underline', fontFamily: F.semi, fontSize: 12 }}>ISSN exercise & sport nutrition review</Text>
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(nutritionSources.fatEnergy)} style={{ color: c.primary, textDecorationLine: 'underline', fontFamily: F.semi, fontSize: 12 }}>Fat energy conversion source</Text>
    </View>
    <Muted>Protein and carbohydrate ranges are transparent references, not clinical requirements. Where the workbook has no numeric carbohydrate value (rest, low intensity, strength), the range shown is separately labelled ISSN general fitness at 3–5 g/kg/day; it is not a workbook or strength-specific recommendation.</Muted>
    {selected === 'training_60' || selected === 'training_120' ? <Muted>The protein range is the workbook's basic range, not a sport-specific target.</Muted> : null}
  </View>;
}