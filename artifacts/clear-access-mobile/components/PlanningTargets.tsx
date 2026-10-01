import { Text, View } from 'react-native';
import { useGetDayActivity, type Person } from '@/lib/local-api';
import { getPlanningTargets, sportsActivities } from '@/lib/planning-targets';
import { useColors } from '@/hooks/useColors';
import { dateLabel } from '@/lib/format';
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
  const targets = getPlanningTargets(person, selected);
  const labels = { calories: 'Calories · estimate', protein: 'Protein · reference', carbs: 'Carbs · reference', fat: 'Fat · your goal' };
  return <View style={{ gap: 12 }}>
    <Muted>{dateLabel(date)} · {sportsActivities[selected].label}</Muted>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {(Object.keys(targets) as (keyof typeof targets)[]).map(key => <View key={key} style={{ flexBasis: '45%', flexGrow: 1, backgroundColor: c.secondary, borderRadius: 12, padding: 12, gap: 6 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 10, color: c.mutedForeground }}>{labels[key]}</Text>
        <Text testID={`value-${testPrefix}-${key}`} style={{ fontFamily: F.bold, fontSize: 17, color: key === 'protein' || key === 'carbs' ? c.primary : c.foreground }}>{targets[key]}</Text>
      </View>)}
    </View>
    <Muted>Protein and carbohydrate ranges use saved body weight and this day's activity. Workbook references are not medical requirements. Fat uses only your saved personal goal.</Muted>
    {selected === 'training_60' || selected === 'training_120' ? <Muted>The protein range is the workbook's basic range, not a sport-specific target.</Muted> : null}
  </View>;
}