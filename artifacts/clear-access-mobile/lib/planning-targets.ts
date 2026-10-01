import type { DayActivityKind, Person } from './local-api';
import { n } from './format';

// Uploaded Sports Nutrition workbook references, not clinical requirements.
export const sportsActivities: Record<DayActivityKind, {
  label: string; short: string; detail: string; carbs?: [number, number]; protein: [number, number];
}> = {
  rest: { label: 'Rest or ordinary day', short: 'Rest', detail: 'Basic nutrition; no numeric carbohydrate range in the workbook', protein: [0.8, 1] },
  low_intensity: { label: 'Low-intensity sport', short: 'Low intensity', detail: 'Gentle training', protein: [0.8, 1] },
  training_60: { label: 'Training up to 60 minutes', short: 'Up to 60 min', detail: 'Moderate to high intensity', carbs: [5, 6], protein: [0.8, 1] },
  training_120: { label: 'Training 60–120 minutes', short: '60–120 min', detail: 'Moderate to high intensity, e.g. tennis', carbs: [7, 8], protein: [0.8, 1] },
  endurance: { label: 'Endurance training 2–5 hours', short: 'Endurance 2–5 h', detail: 'Intense endurance exercise', carbs: [8, 10], protein: [1.2, 1.4] },
  extreme: { label: 'Extreme training over 5 hours', short: 'Over 5 h', detail: 'Intense endurance exercise', carbs: [10, 10], protein: [1.2, 1.4] },
  strength: { label: 'Strength or power training', short: 'Strength / power', detail: 'No numeric carbohydrate range for strength in the workbook', protein: [1.6, 1.7] },
};

export function formatWorkbookRange(range: [number, number] | undefined, weightKg: number | null) {
  if (!range) return 'Not specified in workbook';
  if (weightKg === null) return 'Add body weight to calculate';
  const [low, high] = range.map(value => value * weightKg);
  return `${n(low)}${low === high ? '' : `–${n(high)}`} g / day`;
}

export function getPlanningTargets(
  person: Pick<Person, 'targetCalories' | 'weightKg' | 'fatGoalG'>,
  activity: DayActivityKind,
) {
  const reference = sportsActivities[activity];
  return {
    calories: `${n(person.targetCalories)} kcal / day`,
    protein: formatWorkbookRange(reference.protein, person.weightKg),
    carbs: formatWorkbookRange(reference.carbs, person.weightKg),
    fat: person.fatGoalG === null ? 'No personal goal set' : `${n(person.fatGoalG, 1)} g / day`,
  };
}