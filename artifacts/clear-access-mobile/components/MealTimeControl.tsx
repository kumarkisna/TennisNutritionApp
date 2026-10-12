import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSaveMealTime, type Meal } from '@/lib/local-api';
import { DEFAULT_MEAL_TIMES } from '@/lib/meal-scheduling';
import { isClockTime } from '@/lib/tennis-planning';
import { useColors } from '@/hooks/useColors';
import { Btn, F, Muted, warn } from '@/components/ui';
import TimeField from '@/components/TimeField';

type Props = { meal: Meal; personId: number; date: string; time: string; loading?: boolean; disabled?: boolean; onEditingChange?: (editing: boolean) => void };

function Inner({ meal, personId, date, time, loading, disabled, onEditingChange }: Props) {
  const c = useColors();
  const save = useSaveMealTime();
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const editing = draft !== null;
  const pending = save.isPending || disabled;
  const def = DEFAULT_MEAL_TIMES[meal];
  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);

  async function commit(value: string) {
    if (!isClockTime(value)) { setProblem('Use 24-hour HH:MM, for example 07:30.'); warn(); return; }
    setProblem(null);
    try {
      await save.mutateAsync({ data: { date, personId, meal, time: value } });
      setDraft(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save the time. Your entry is kept.'); warn();
    }
  }

  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name="clock" size={15} color={c.primary} />
      <Text testID={`value-meal-time-${meal}`} style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground, flex: 1 }}>{loading ? '--:--' : time}</Text>
      {!editing ? <Btn small variant="ghost" label="Change time" testID={`button-edit-meal-time-${meal}`} disabled={loading || pending} onPress={() => { setProblem(null); setDraft(time); }} /> : null}
    </View>
    {editing ? <View style={{ gap: 8 }}>
      <TimeField label="Meal time (24-hour)" testID={`input-meal-time-${meal}`} value={draft} onChangeText={setDraft} editable={!pending} />
      <Muted>24-hour HH:MM. Applies to this person and day only.</Muted>
      {problem ? <Text accessibilityRole="alert" style={{ fontFamily: F.medium, fontSize: 12.5, color: c.destructive }}>{problem}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small label="Save time" icon="check" testID={`button-save-meal-time-${meal}`} loading={pending} disabled={pending} onPress={() => void commit((draft ?? '').trim())} />
        <Btn small variant="ghost" label="Cancel" testID={`button-cancel-meal-time-${meal}`} disabled={pending} onPress={() => { setDraft(null); setProblem(null); }} />
        {time !== def || draft !== def ? <Btn small variant="ghost" label={`Use default ${def}`} testID={`button-default-meal-time-${meal}`} disabled={pending} onPress={() => { setDraft(def); void commit(def); }} /> : null}
      </View>
    </View> : null}
  </View>;
}

export function MealTimeControl(props: Props) {
  return <Inner key={`${props.personId}-${props.date}-${props.meal}`} {...props} />;
}
