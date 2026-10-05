import type { DayActivityKind, Person } from './local-api';
import { n } from './format';

// Workbook and separately labelled user-supplied references, not clinical requirements.
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
  adolescent_athletes: { label: 'Adolescent athletes', short: 'Adolescent athletes', detail: 'Your supplied protein reference: minimum 2 g/kg/day and maximum 2 g/kg/day', protein: [2, 2] },
};

// App-chosen planning heuristics, not official ISSN or CDC activity rules.
export const activityCaloriesPerKg: Record<DayActivityKind, number | null> = {
  rest: 30,
  low_intensity: 35,
  training_60: 40,
  training_120: 50,
  endurance: 60,
  extreme: 70,
  strength: 45,
  adolescent_athletes: null,
};

export const nutritionSources = {
  exerciseNutrition: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2853497/',
  fatEnergy: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3905293/',
} as const;

export function formatWorkbookRange(range: [number, number] | undefined, weightKg: number | null, precision = 0) {
  if (!range) return 'Not specified in workbook';
  if (weightKg === null) return 'Add body weight to calculate';
  const [low, high] = range.map(value => value * weightKg);
  return `${n(low, precision)}${low === high ? '' : `–${n(high, precision)}`} g / day`;
}

export function adolescentProteinReference(weightKg: number | null) {
  const [minimum, maximum] = sportsActivities.adolescent_athletes.protein;
  const scaled = (value: number) => weightKg === null ? '' : ` (${n(value * weightKg, 1)} g/day)`;
  return `Your supplied protein reference: minimum ${n(minimum, 1)} g/kg/day${scaled(minimum)}; maximum ${n(maximum, 1)} g/kg/day${scaled(maximum)}. These are the supplied planning endpoints, not a medical upper limit.`;
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function getAgeOnDate(dateOfBirth: string, date: string) {
  if (!validIsoDate(dateOfBirth) || !validIsoDate(date) || dateOfBirth > date) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

export function calculatePlanningEstimates(
  person: Pick<Person, 'weightKg' | 'ageYears' | 'dateOfBirth'>,
  activity: DayActivityKind,
  date: string,
): { calories: number | null; fat: number | null; unavailableReason: string | null } {
  if (!validIsoDate(date)) {
    return { calories: null, fat: null, unavailableReason: 'A valid selected date is required for an adult estimate.' };
  }
  const coefficient = activityCaloriesPerKg[activity];
  if (coefficient === null) {
    return { calories: null, fat: null, unavailableReason: 'No calorie or fat estimate is supplied for Adolescent athletes; adult activity formulas are not applied.' };
  }
  const age = person.dateOfBirth !== null ? getAgeOnDate(person.dateOfBirth, date) : person.ageYears;
  if (person.dateOfBirth !== null && age === null) {
    return { calories: null, fat: null, unavailableReason: 'The saved date of birth is invalid or after the selected date; it takes precedence over saved age.' };
  }
  if (age === null || age === undefined) {
    const weightMissing = person.weightKg === null || !Number.isFinite(person.weightKg) || person.weightKg <= 0;
    return {
      calories: null,
      fat: null,
      unavailableReason: `Adult estimates are unavailable until a date of birth is saved.${weightMissing ? ' Body weight is also needed.' : ''}`,
    };
  }
  if (!Number.isFinite(age) || age < 18) {
    return { calories: null, fat: null, unavailableReason: 'Adult estimates are not provided for people under 18.' };
  }
  if (person.weightKg === null || !Number.isFinite(person.weightKg) || person.weightKg <= 0) {
    return { calories: null, fat: null, unavailableReason: 'Adult estimates are unavailable until body weight is saved.' };
  }
  const calories = Math.round(person.weightKg * coefficient);
  return { calories, fat: calories * 0.30 / 9, unavailableReason: null };
}

export function getPlanningTargets(
  person: Pick<Person, 'weightKg' | 'ageYears' | 'dateOfBirth' | 'fatGoalG'>,
  activity: DayActivityKind,
  date: string,
) {
  const reference = sportsActivities[activity];
  const estimates = calculatePlanningEstimates(person, activity, date);
  const usesGeneralFitnessCarbReference = !reference.carbs && activity !== 'adolescent_athletes';
  const carbs = reference.carbs
    ? formatWorkbookRange(reference.carbs, person.weightKg)
    : usesGeneralFitnessCarbReference ? formatWorkbookRange([3, 5], person.weightKg) : 'No carbohydrate reference supplied';
  return {
    calories: estimates.calories === null ? estimates.unavailableReason! : `${n(estimates.calories)} kcal / day`,
    protein: formatWorkbookRange(reference.protein, person.weightKg, activity === 'adolescent_athletes' ? 1 : 0),
    carbs: usesGeneralFitnessCarbReference ? `${carbs} (ISSN general-fitness reference)` : carbs,
    fat: estimates.fat === null ? estimates.unavailableReason! : `${n(estimates.fat, 1)} g / day`,
  };
}