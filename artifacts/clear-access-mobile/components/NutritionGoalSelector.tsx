import type { NutritionGoal } from '@/lib/local-models';
import { Card, Chips, Eyebrow, Muted } from '@/components/ui';

type NutritionGoalChoice = 'none' | NutritionGoal;

const options: { value: NutritionGoalChoice; label: string }[] = [
  { value: 'none', label: 'No goal' },
  { value: 'weight_loss', label: 'Weight loss' },
];

export function NutritionGoalSelector({
  value,
  onChange,
  testPrefix,
}: {
  value: NutritionGoal | null;
  onChange: (goal: NutritionGoal | null) => void;
  testPrefix: string;
}) {
  return (
    <Card>
      <Eyebrow>Optional nutrition goal</Eyebrow>
      <Chips<NutritionGoalChoice>
        testPrefix={testPrefix}
        value={value ?? 'none'}
        onChange={choice => onChange(choice === 'none' ? null : choice)}
        options={options}
      />
      <Muted>This records the person’s stated goal only; it does not change calorie estimates or nutrition references.</Muted>
    </Card>
  );
}
