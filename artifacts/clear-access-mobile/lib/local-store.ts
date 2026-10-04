import { referenceFoodSeed } from './reference-food-seed';
import { calculatePlanningEstimates } from './planning-targets';
import { isTennisPlan, isTennisDiet, tennisPlanProblem } from './tennis-planning';
import { getMealTimes, isMealTimes } from './meal-scheduling';
import { isMealAlerts, type ReminderSource } from './meal-reminders';
import { getTennisFoodPlanFingerprint } from './tennis-copy';
import {
  ActivityLevel,
  DayActivityType,
  FoodCategory,
  Meal,
  type ActivityLevel as ActivityLevelType,
  type DayActivity,
  type DayActivityInput,
  type MealTimeInput,
  type MealAlertInput,
  type TennisPlanInput,
  type TennisPlanRatingInput,
  type TennisPlanHistoryItem,
  type TennisDietInput,
  type TennisDietDeleteInput,
  type CopyTennisFoodPlanInput,
  type CopyTennisFoodPlanResult,
  type TennisFoodPlanDate,
  type TennisDiet,
  type DailySummary,
  type Food,
  type FoodInput,
  type FoodUpdate,
  type HeightRecord,
  type HeightRecordInput,
  type HeightRecordUpdate,
  type GetDayActivityParams,
  type GetDailySummaryParams,
  type ListFoodsParams,
  type ListHeightRecordsParams,
  type ListMealEntriesParams,
  type MealEntry,
  type MealEntryInput,
  type MealEntryUpdate,
  type MealSummary,
  type Nutrition,
  type Person,
  type PersonInput,
  type PersonUpdate,
} from './local-models';

export const LOCAL_STORAGE_KEY = 'clear-access-mobile:planner:v1';
const STORE_VERSION = 2;
const MEALS = Object.values(Meal);
const ACTIVITY_LEVELS = Object.values(ActivityLevel);
const DAY_ACTIVITIES = Object.values(DayActivityType);
const CATEGORIES = Object.values(FoodCategory);
const MULTIPLIERS: Record<ActivityLevelType, number> = {
  sedentary: 1,
  light: 1.1,
  moderate: 1.2,
  very_active: 1.35,
};

export type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

type StoredFood = Food & { referenceKey?: string };
type StoredEntry = { id: number; date: string; personId: number; meal: MealEntryInput['meal']; grams: number; foodId: number; tennisDietId?: string };
type StoredHeightRecord = HeightRecord;
type StoreData = {
  version: number;
  people: Person[];
  foods: StoredFood[];
  entries: StoredEntry[];
  activities: DayActivity[];
  heightRecords: StoredHeightRecord[];
  nextPersonId: number;
  nextFoodId: number;
  nextEntryId: number;
  nextHeightRecordId: number;
  mealAlertsEnabled?: boolean;
};

type BackupEnvelope = {
  format: 'clear-access-local-backup';
  version: 1;
  createdAt: string;
  data: StoreData;
};
function fail(message: string): never {
  throw new Error(message);
}
function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => required.includes(key) || optional.includes(key));
}
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function hasTennisDiet(activities: DayActivity[], entry: { date: string; personId: number }, id: unknown): id is string {
  return typeof id === 'string' && activities.some(activity =>
    activity.date === entry.date && activity.personId === entry.personId && activity.tennis?.diets?.some(diet => diet.id === id));
}

function seedStore(): StoreData {
  const foods = referenceFoodSeed.map((food, index): StoredFood => ({
    ...food,
    id: index + 1,
    source: 'reference',
    fiberKnown: true,
    calciumMgPer100g: null,
    ironMgPer100g: null,
  }));
  const defaultPerson: Person = {
    id: 1,
    name: 'Me',
    isDefault: true,
    weightKg: null,
    ageYears: null,
    dateOfBirth: null,
    growthReferenceSex: null,
    ironGoalMg: null,
    ironGoalSource: null,
    ironGoalReviewedOn: null,
    fatGoalG: null,
    fatGoalSource: null,
    fatGoalReviewedOn: null,
    activityLevel: 'sedentary',
    baselineCalories: 2000,
    activityMultiplier: 1,
    targetCalories: 2000,
  };
  return {
    version: STORE_VERSION,
    people: [defaultPerson],
    foods,
    entries: [],
    activities: [],
    heightRecords: [],
    nextPersonId: 2,
    nextFoodId: foods.length + 1,
    nextEntryId: 1,
    nextHeightRecordId: 1,
  };
}

function validateStoredData(value: unknown): StoreData {
  if (!isRecord(value)) fail('Local planner storage is corrupted. Your data was not changed.');
  if (value.version !== STORE_VERSION) {
    fail(`Unsupported local planner storage version (${String(value.version)}). Your data was not changed.`);
  }
  const { people, foods, entries, activities, heightRecords, nextPersonId, nextFoodId, nextEntryId, nextHeightRecordId } = value;
  if (value.mealAlertsEnabled !== undefined && typeof value.mealAlertsEnabled !== 'boolean') fail('Local reminder settings are invalid. Your data was not changed.');
  if (
    !Array.isArray(people) || !Array.isArray(foods) || !Array.isArray(entries) || !Array.isArray(activities) ||
    !Array.isArray(heightRecords) ||
    !Number.isSafeInteger(nextPersonId) || !Number.isSafeInteger(nextFoodId) || !Number.isSafeInteger(nextEntryId) ||
    !Number.isSafeInteger(nextHeightRecordId) ||
    !people.some(p => isRecord(p) && p.isDefault === true)
  ) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  const personIds = new Set<number>();
  let defaultPeople = 0;
  for (const person of people) {
    if (!isRecord(person) || !Number.isSafeInteger(person.id) || (person.id as number) < 1 ||
      typeof person.name !== 'string' || !person.name.trim() ||
       !(person.dateOfBirth === null || (typeof person.dateOfBirth === 'string' &&
         isValidCalendarDate(person.dateOfBirth) && person.dateOfBirth <= todayDate())) ||
       !(person.growthReferenceSex === null || person.growthReferenceSex === 'male' || person.growthReferenceSex === 'female') ||
      !ACTIVITY_LEVELS.includes(person.activityLevel as ActivityLevelType) ||
      !Number.isInteger(person.baselineCalories) ||
      !isFiniteInRange(person.activityMultiplier, 1, 1.35) ||
      !Number.isFinite(person.targetCalories) || personIds.has(person.id as number)) {
      fail('Local planner storage contains an invalid person. Your data was not changed.');
    }
    personIds.add(person.id as number);
    if (person.isDefault === true) defaultPeople += 1;
  }
  if (defaultPeople !== 1) fail('Local planner storage must contain exactly one default person. Your data was not changed.');
  const foodIds = new Set<number>();
  for (const food of foods) {
    if (!isRecord(food) || !Number.isSafeInteger(food.id) || (food.id as number) < 1 ||
      typeof food.name !== 'string' || !food.name.trim() || foodIds.has(food.id as number) ||
      !CATEGORIES.includes(food.category as Food['category']) ||
      !['reference', 'custom', 'open_food_facts'].includes(String(food.source)) ||
      !['caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'fiberPer100g']
        .every(key => typeof food[key] === 'number' && Number.isFinite(food[key])) ||
      (food.calciumMgPer100g !== null && typeof food.calciumMgPer100g !== 'number') ||
      (food.ironMgPer100g !== null && typeof food.ironMgPer100g !== 'number')) {
      fail('Local planner storage contains an invalid food. Your data was not changed.');
    }
    foodIds.add(food.id as number);
  }
  const entryIds = new Set<number>();
  for (const entry of entries) {
    if (!isRecord(entry) || !Number.isSafeInteger(entry.id) || (entry.id as number) < 1 ||
      entryIds.has(entry.id as number) || !isValidCalendarDate(String(entry.date)) ||
      !personIds.has(entry.personId as number) || !foodIds.has(entry.foodId as number) ||
      !MEALS.includes(entry.meal as MealEntryInput['meal']) || !isFiniteInRange(entry.grams, 1, 3000)) {
      fail('Local planner storage contains an invalid meal entry. Your data was not changed.');
    }
    entryIds.add(entry.id as number);
  }
  const activityKeys = new Set<string>();
  for (const activity of activities) {
    if (!isRecord(activity) || !isValidCalendarDate(String(activity.date)) ||
      !personIds.has(activity.personId as number) ||
      !DAY_ACTIVITIES.includes(activity.activityType as DayActivity['activityType']) ||
      (activity.tennis !== undefined && !isTennisPlan(activity.tennis)) ||
      (activity.mealTimes !== undefined && !isMealTimes(activity.mealTimes)) ||
      (activity.mealAlerts !== undefined && !isMealAlerts(activity.mealAlerts))) {
      fail('Local planner storage contains an invalid day activity. Your data was not changed.');
    }
    const key = `${activity.personId}:${activity.date}`;
    if (activityKeys.has(key)) fail('Local planner storage contains duplicate day activities. Your data was not changed.');
    activityKeys.add(key);
  }
  for (const entry of entries) {
    if (entry.tennisDietId !== undefined && !hasTennisDiet(activities, entry, entry.tennisDietId)) {
      fail('Local planner storage contains an invalid timed diet link. Your data was not changed.');
    }
  }
  const heightRecordIds = new Set<number>();
  const heightRecordKeys = new Set<string>();
  for (const record of heightRecords) {
    if (!isRecord(record) || !Number.isSafeInteger(record.id) || (record.id as number) < 1 ||
      heightRecordIds.has(record.id as number) || !personIds.has(record.personId as number) ||
      typeof record.date !== 'string' || !isValidCalendarDate(record.date) || record.date > todayDate() ||
      !isFiniteInRange(record.heightCm, 20, 300)) {
      fail('Local planner storage contains an invalid height record. Your data was not changed.');
    }
    const person = people.find(candidate => isRecord(candidate) && candidate.id === record.personId);
    if (person && typeof person.dateOfBirth === 'string' && person.dateOfBirth > record.date) {
      fail('Local planner storage contains a height record before the person’s date of birth. Your data was not changed.');
    }
    const key = `${record.personId}:${record.date}`;
    if (heightRecordKeys.has(key)) {
      fail('Local planner storage contains duplicate height records. Your data was not changed.');
    }
    heightRecordKeys.add(key);
    heightRecordIds.add(record.id as number);
  }
  if ((nextPersonId as number) <= Math.max(...personIds) ||
    (foodIds.size && (nextFoodId as number) <= Math.max(...foodIds)) ||
    (entryIds.size && (nextEntryId as number) <= Math.max(...entryIds)) ||
    (heightRecordIds.size && (nextHeightRecordId as number) <= Math.max(...heightRecordIds))) {
    fail('Local planner storage has invalid next-ID counters. Your data was not changed.');
  }
  return value as unknown as StoreData;
}

function validateBackupData(value: unknown): StoreData {
  const invalid = (kind: string): never => fail(`Backup contains an invalid ${kind}.`);
  if (!isRecord(value) || !hasExactKeys(value, [
    'version', 'people', 'foods', 'entries', 'activities', 'heightRecords',
    'nextPersonId', 'nextFoodId', 'nextEntryId', 'nextHeightRecordId',
  ], ['mealAlertsEnabled']) || (Object.hasOwn(value, 'mealAlertsEnabled') && typeof value.mealAlertsEnabled !== 'boolean') || value.version !== STORE_VERSION ||
    !Array.isArray(value.people) || !Array.isArray(value.foods) || !Array.isArray(value.entries) ||
    !Array.isArray(value.activities) || !Array.isArray(value.heightRecords)) {
    return invalid('data structure');
  }
  const counters = [value.nextPersonId, value.nextFoodId, value.nextEntryId, value.nextHeightRecordId];
  if (!counters.every(counter => Number.isSafeInteger(counter) && (counter as number) >= 1)) {
    return invalid('ID counter');
  }

  const peopleById = new Map<number, Record<string, unknown>>();
  const peopleNames = new Set<string>();
  let defaultPeople = 0;
  for (const person of value.people) {
    if (!isRecord(person) || !hasExactKeys(person, [
      'id', 'name', 'isDefault', 'weightKg', 'ageYears', 'dateOfBirth', 'growthReferenceSex',
      'ironGoalMg', 'ironGoalSource', 'ironGoalReviewedOn', 'fatGoalG', 'fatGoalSource',
      'fatGoalReviewedOn', 'activityLevel', 'baselineCalories', 'activityMultiplier', 'targetCalories',
    ]) || !Number.isSafeInteger(person.id) || (person.id as number) < 1 ||
      typeof person.name !== 'string' || !person.name.trim() || person.name.length > 80 ||
      typeof person.isDefault !== 'boolean' ||
      !(person.weightKg === null || isFiniteInRange(person.weightKg, 1, 500)) ||
      !(person.ageYears === null || (Number.isInteger(person.ageYears) && isFiniteInRange(person.ageYears, 1, 120))) ||
      !(person.dateOfBirth === null || (typeof person.dateOfBirth === 'string' &&
        isValidCalendarDate(person.dateOfBirth) && person.dateOfBirth <= todayDate())) ||
      !(person.growthReferenceSex === null || person.growthReferenceSex === 'male' || person.growthReferenceSex === 'female') ||
      !(person.ironGoalMg === null || isFiniteInRange(person.ironGoalMg, Number.EPSILON, 100)) ||
      !(person.fatGoalG === null || isFiniteInRange(person.fatGoalG, Number.EPSILON, 500)) ||
      !(person.ironGoalSource === null || (typeof person.ironGoalSource === 'string' && person.ironGoalSource.length <= 300)) ||
      !(person.fatGoalSource === null || (typeof person.fatGoalSource === 'string' && person.fatGoalSource.length <= 300)) ||
      !(person.ironGoalReviewedOn === null || (typeof person.ironGoalReviewedOn === 'string' && isValidCalendarDate(person.ironGoalReviewedOn))) ||
      !(person.fatGoalReviewedOn === null || (typeof person.fatGoalReviewedOn === 'string' && isValidCalendarDate(person.fatGoalReviewedOn))) ||
      (person.ironGoalMg === null && (person.ironGoalSource !== null || person.ironGoalReviewedOn !== null)) ||
      (person.fatGoalG === null && (person.fatGoalSource !== null || person.fatGoalReviewedOn !== null)) ||
      !ACTIVITY_LEVELS.includes(person.activityLevel as ActivityLevelType) ||
      !Number.isInteger(person.baselineCalories) || !isFiniteInRange(person.baselineCalories, 1000, 5000) ||
      !isFiniteInRange(person.activityMultiplier, 1, 1.35) ||
      !Number.isInteger(person.targetCalories) || !isFiniteInRange(person.targetCalories, 1000, 6750) ||
      peopleById.has(person.id as number) ||
      peopleNames.has((person.name as string).trim().toLocaleLowerCase())) {
      return invalid('person');
    }
    const expectedMultiplier = MULTIPLIERS[person.activityLevel as ActivityLevelType];
    if (person.activityMultiplier !== expectedMultiplier ||
      person.targetCalories !== Math.round((person.baselineCalories as number) * expectedMultiplier)) {
      return invalid('person planning preferences');
    }
    peopleById.set(person.id as number, person);
    peopleNames.add((person.name as string).trim().toLocaleLowerCase());
    if (person.isDefault) defaultPeople += 1;
  }
  if (defaultPeople !== 1) return invalid('default person');

  const foodIds = new Set<number>();
  for (const food of value.foods) {
    if (!isRecord(food) || !hasExactKeys(food, [
      'id', 'name', 'category', 'source', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g',
      'fatPer100g', 'fiberPer100g', 'fiberKnown', 'calciumMgPer100g', 'ironMgPer100g',
    ], ['brand', 'sourceUrl', 'referenceKey']) ||
      !Number.isSafeInteger(food.id) || (food.id as number) < 1 ||
      typeof food.name !== 'string' || !food.name.trim() || food.name.length > 120 ||
      (food.brand !== undefined && (typeof food.brand !== 'string' || food.brand.length > 160)) ||
      (food.sourceUrl !== undefined && (typeof food.sourceUrl !== 'string' || food.sourceUrl.length > 2048)) ||
      (food.referenceKey !== undefined && (typeof food.referenceKey !== 'string' || !food.referenceKey.trim() || food.referenceKey.length > 120)) ||
      !CATEGORIES.includes(food.category as Food['category']) ||
      !['reference', 'custom', 'open_food_facts'].includes(String(food.source)) ||
      !isFiniteNumber(food.caloriesPer100g) ||
      !isFiniteNumber(food.proteinPer100g) ||
      !isFiniteNumber(food.carbsPer100g) ||
      !isFiniteNumber(food.fatPer100g) ||
      !isFiniteNumber(food.fiberPer100g) ||
      typeof food.fiberKnown !== 'boolean' ||
      !(food.calciumMgPer100g === null || isFiniteNumber(food.calciumMgPer100g)) ||
      !(food.ironMgPer100g === null || isFiniteNumber(food.ironMgPer100g)) ||
      foodIds.has(food.id as number)) {
      return invalid('food');
    }
    foodIds.add(food.id as number);
  }

  const entryIds = new Set<number>();
  for (const entry of value.entries) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['id', 'date', 'personId', 'meal', 'grams', 'foodId'], ['tennisDietId']) ||
      !Number.isSafeInteger(entry.id) || (entry.id as number) < 1 || entryIds.has(entry.id as number) ||
      typeof entry.date !== 'string' || !isValidCalendarDate(entry.date) ||
      !Number.isSafeInteger(entry.personId) || !peopleById.has(entry.personId as number) ||
      !Number.isSafeInteger(entry.foodId) || !foodIds.has(entry.foodId as number) ||
      !MEALS.includes(entry.meal as MealEntryInput['meal']) || !isFiniteInRange(entry.grams, 1, 3000)) {
      return invalid('meal entry');
    }
    entryIds.add(entry.id as number);
  }

  const activityKeys = new Set<string>();
  for (const activity of value.activities) {
    if (!isRecord(activity) || !hasExactKeys(activity, ['date', 'personId', 'activityType'], ['tennis', 'mealTimes', 'mealAlerts']) ||
      typeof activity.date !== 'string' || !isValidCalendarDate(activity.date) ||
      !Number.isSafeInteger(activity.personId) || !peopleById.has(activity.personId as number) ||
      !DAY_ACTIVITIES.includes(activity.activityType as DayActivity['activityType']) ||
      (Object.hasOwn(activity, 'tennis') && !isTennisPlan(activity.tennis)) ||
      (Object.hasOwn(activity, 'mealTimes') && !isMealTimes(activity.mealTimes)) ||
      (Object.hasOwn(activity, 'mealAlerts') && !isMealAlerts(activity.mealAlerts))) {
      return invalid('day activity');
    }
    const key = `${activity.personId}:${activity.date}`;
    if (activityKeys.has(key)) return invalid('duplicate day activity');
    activityKeys.add(key);
  }
  for (const entry of value.entries) {
    if (Object.hasOwn(entry, 'tennisDietId') && !hasTennisDiet(value.activities as DayActivity[], entry, entry.tennisDietId)) {
      return invalid('timed diet link');
    }
  }

  const heightRecordIds = new Set<number>();
  const heightRecordKeys = new Set<string>();
  for (const record of value.heightRecords) {
    if (!isRecord(record) || !hasExactKeys(record, ['id', 'personId', 'date', 'heightCm']) ||
      !Number.isSafeInteger(record.id) || (record.id as number) < 1 || heightRecordIds.has(record.id as number) ||
      !Number.isSafeInteger(record.personId) || !peopleById.has(record.personId as number) ||
      typeof record.date !== 'string' || !isValidCalendarDate(record.date) || record.date > todayDate() ||
      !isFiniteInRange(record.heightCm, 20, 300)) {
      return invalid('height record');
    }
    const person = peopleById.get(record.personId as number)!;
    if (typeof person.dateOfBirth === 'string' && person.dateOfBirth > record.date) {
      return invalid('height record date');
    }
    const key = `${record.personId}:${record.date}`;
    if (heightRecordKeys.has(key)) return invalid('duplicate height record');
    heightRecordKeys.add(key);
    heightRecordIds.add(record.id as number);
  }

  if ((value.nextPersonId as number) <= Math.max(0, ...peopleById.keys()) ||
    (value.nextFoodId as number) <= Math.max(0, ...foodIds) ||
    (value.nextEntryId as number) <= Math.max(0, ...entryIds) ||
    (value.nextHeightRecordId as number) <= Math.max(0, ...heightRecordIds)) {
    return invalid('ID counter');
  }
  return value as unknown as StoreData;
}

function migrateVersionOne(value: unknown): StoreData {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.people)) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  const migrated = {
    ...value,
    version: STORE_VERSION,
    people: value.people.map(person => isRecord(person) ? {
      ...person,
      dateOfBirth: person.dateOfBirth === undefined ? null : person.dateOfBirth,
      growthReferenceSex: person.growthReferenceSex === undefined ? null : person.growthReferenceSex,
    } : person),
    heightRecords: [],
    nextHeightRecordId: 1,
  };
  return validateStoredData(migrated);
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
function publicFood(food: StoredFood): Food {
  const { referenceKey: _referenceKey, ...result } = food;
  return result;
}
function foodNutrition(food: Food, grams: number): Nutrition {
  const portion = grams / 100;
  return {
    calories: round1(food.caloriesPer100g * portion),
    protein: round1(food.proteinPer100g * portion),
    carbs: round1(food.carbsPer100g * portion),
    fat: round1(food.fatPer100g * portion),
    fiber: round1(food.fiberPer100g * portion),
    calciumMg: food.calciumMgPer100g === null ? null : round1(food.calciumMgPer100g * portion),
    ironMg: food.ironMgPer100g === null ? null : round1(food.ironMgPer100g * portion),
  };
}
function sumNutrition(items: Nutrition[]): Nutrition {
  const sumKnownMineral = (key: 'calciumMg' | 'ironMg') =>
    items.some(item => item[key] === null) ? null : round1(items.reduce((sum, item) => sum + (item[key] ?? 0), 0));
  return {
    calories: round1(items.reduce((sum, item) => sum + item.calories, 0)),
    protein: round1(items.reduce((sum, item) => sum + item.protein, 0)),
    carbs: round1(items.reduce((sum, item) => sum + item.carbs, 0)),
    fat: round1(items.reduce((sum, item) => sum + item.fat, 0)),
    fiber: round1(items.reduce((sum, item) => sum + item.fiber, 0)),
    calciumMg: sumKnownMineral('calciumMg'),
    ironMg: sumKnownMineral('ironMg'),
  };
}
function toMealEntry(data: StoreData, entry: StoredEntry): MealEntry {
  const food = data.foods.find(candidate => candidate.id === entry.foodId);
  if (!food) return fail('A planned food is missing from the local catalog.');
  const visibleFood = publicFood(food);
  return {
    id: entry.id,
    date: entry.date,
    personId: entry.personId,
    meal: entry.meal,
    grams: entry.grams,
    ...(entry.tennisDietId ? { tennisDietId: entry.tennisDietId } : {}),
    food: visibleFood,
    nutrition: foodNutrition(visibleFood, entry.grams),
  };
}
function findPerson(data: StoreData, id: number): Person {
  const person = data.people.find(candidate => candidate.id === id);
  if (!person) return fail('Person not found in your planner.');
  return person;
}
function validatePersonInput(input: PersonInput | PersonUpdate, existing?: Person): Omit<Person, 'id' | 'isDefault'> {
  const result = { ...existing, ...input } as Partial<Person>;
  const name = result.name?.trim();
  if (name !== undefined && (!name || name.length > 80)) fail('Enter a name up to 80 characters.');
  const activityLevel = result.activityLevel;
  if (!activityLevel || !ACTIVITY_LEVELS.includes(activityLevel)) fail('Choose a valid activity level.');
  const baselineCalories = result.baselineCalories;
  if (!Number.isInteger(baselineCalories) || !isFiniteInRange(baselineCalories, 1000, 5000)) {
    fail('Baseline calories must be an integer from 1,000 to 5,000.');
  }
  if (result.weightKg !== null && result.weightKg !== undefined && !isFiniteInRange(result.weightKg, 1, 500)) {
    fail('Weight must be between 1 and 500 kg, or left blank.');
  }
  if (result.ageYears !== null && result.ageYears !== undefined &&
    (!Number.isInteger(result.ageYears) || !isFiniteInRange(result.ageYears, 1, 120))) {
    fail('Age must be a whole number from 1 to 120, or left blank.');
  }
  if (result.dateOfBirth !== null && result.dateOfBirth !== undefined) {
    if (typeof result.dateOfBirth !== 'string' || !isValidCalendarDate(result.dateOfBirth)) {
      fail('Enter a valid date of birth.');
    }
    if (result.dateOfBirth > todayDate()) fail('Date of birth cannot be in the future.');
  }
  if (result.growthReferenceSex !== null && result.growthReferenceSex !== undefined &&
    result.growthReferenceSex !== 'male' && result.growthReferenceSex !== 'female') {
    fail('Choose a valid growth reference sex.');
  }
  const normalized: Record<string, unknown> = { ...result };
  for (const prefix of ['iron', 'fat'] as const) {
    const amountKey = prefix === 'iron' ? 'ironGoalMg' : 'fatGoalG';
    const sourceKey = prefix === 'iron' ? 'ironGoalSource' : 'fatGoalSource';
    const reviewedKey = prefix === 'iron' ? 'ironGoalReviewedOn' : 'fatGoalReviewedOn';
    const amount = normalized[amountKey] as number | null | undefined;
    if (amount !== null && amount !== undefined &&
      !isFiniteInRange(amount, Number.EPSILON, prefix === 'iron' ? 100 : 500)) {
      fail(`${prefix === 'iron' ? 'Iron' : 'Fat'} goal must be greater than zero and within the supported range.`);
    }
    const source = normalized[sourceKey] as string | null | undefined;
    const reviewedOn = normalized[reviewedKey] as string | null | undefined;
    if (amount === null || amount === undefined) {
      if (input[sourceKey] != null && input[sourceKey]!.trim() || input[reviewedKey]) {
        fail('Source details can only be saved while that goal is set.');
      }
      normalized[sourceKey] = null;
      normalized[reviewedKey] = null;
    } else {
      if (source !== null && source !== undefined && (typeof source !== 'string' || source.length > 300)) {
        fail('Goal source notes must be 300 characters or fewer.');
      }
      normalized[sourceKey] = source?.trim() || null;
      if (reviewedOn !== null && reviewedOn !== undefined && !isValidCalendarDate(reviewedOn)) {
        fail('Enter a valid goal review date.');
      }
    }
  }
  return {
    name: name ?? existing?.name ?? '',
    weightKg: normalized.weightKg as number | null ?? null,
    ageYears: normalized.ageYears as number | null ?? null,
    dateOfBirth: normalized.dateOfBirth as string | null ?? null,
    growthReferenceSex: normalized.growthReferenceSex as Person['growthReferenceSex'] ?? null,
    ironGoalMg: normalized.ironGoalMg as number | null ?? null,
    ironGoalSource: normalized.ironGoalSource as string | null ?? null,
    ironGoalReviewedOn: normalized.ironGoalReviewedOn as string | null ?? null,
    fatGoalG: normalized.fatGoalG as number | null ?? null,
    fatGoalSource: normalized.fatGoalSource as string | null ?? null,
    fatGoalReviewedOn: normalized.fatGoalReviewedOn as string | null ?? null,
    activityLevel,
    baselineCalories,
    activityMultiplier: MULTIPLIERS[activityLevel],
    targetCalories: Math.round(baselineCalories * MULTIPLIERS[activityLevel]),
  };
}
function validateFood(data: FoodInput | FoodUpdate, existing?: Food): Omit<Food, 'id' | 'source' | 'fiberKnown'> {
  const result = { ...existing, ...data } as Partial<Food>;
  const name = result.name?.trim();
  if (name !== undefined && (!name || name.length > 120)) fail('Enter a food name up to 120 characters.');
  if (!result.category || !CATEGORIES.includes(result.category)) fail('Choose a valid food category.');
  const fields: Array<[keyof Food, string, number, number]> = [
    ['caloriesPer100g', 'Calories', 0, 1000],
    ['proteinPer100g', 'Protein', 0, 100],
    ['carbsPer100g', 'Carbohydrates', 0, 100],
    ['fatPer100g', 'Fat', 0, 100],
    ['fiberPer100g', 'Fiber', 0, 100],
  ];
  for (const [key, label, min, max] of fields) {
    const value = result[key];
    if (!isFiniteInRange(value, min, max)) fail(`${label} per 100 g must be from ${min} to ${max}.`);
  }
  for (const [key, label, max] of [
    ['calciumMgPer100g', 'Calcium', 10000],
    ['ironMgPer100g', 'Iron', 1000],
  ] as const) {
    const value = result[key];
    if (value !== null && value !== undefined && !isFiniteInRange(value, 0, max)) {
      fail(`${label} per 100 g must be 0 to ${max} mg, or unknown.`);
    }
  }
  return {
    name: name ?? '',
    category: result.category,
    caloriesPer100g: result.caloriesPer100g!,
    proteinPer100g: result.proteinPer100g!,
    carbsPer100g: result.carbsPer100g!,
    fatPer100g: result.fatPer100g!,
    fiberPer100g: result.fiberPer100g!,
    calciumMgPer100g: result.calciumMgPer100g ?? null,
    ironMgPer100g: result.ironMgPer100g ?? null,
  };
}

export function createLocalStore(storage: AsyncKeyValueStorage, storageKey = LOCAL_STORAGE_KEY) {
  let data: StoreData | undefined;
  let hydration: Promise<StoreData> | undefined;
  let writeQueue: Promise<unknown> = Promise.resolve();
  let restoreInProgress: Promise<void> | undefined;

  const load = (): Promise<StoreData> => {
    if (restoreInProgress) return restoreInProgress.then(() => load());
    if (data) return Promise.resolve(data);
    if (hydration) return hydration;
    hydration = (async () => {
      let serialized: string | null;
      try {
        serialized = await storage.getItem(storageKey);
      } catch (error) {
        throw new Error(`Could not read local planner data: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (serialized === null) {
        const initial = seedStore();
        try {
          await storage.setItem(storageKey, JSON.stringify(initial));
        } catch (error) {
          throw new Error(`Could not save the initial local planner data: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = initial;
        return initial;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        fail('Local planner storage is corrupted and could not be read. Your data was not changed.');
      }
      if (isRecord(parsed) && parsed.version === 1) {
        const migrated = migrateVersionOne(parsed);
        try {
          // Keep the v1 bytes until the complete, validated replacement is durable.
          await storage.setItem(storageKey, JSON.stringify(migrated));
        } catch (error) {
          throw new Error(`Could not migrate local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = migrated;
        return migrated;
      }
      data = validateStoredData(parsed);
      return data;
    })();
    return hydration;
  };

  const transact = <T>(change: (draft: StoreData) => T): Promise<T> => {
    const pending = writeQueue.then(async () => {
      const current = await load();
      const draft = clone(current);
      const result = change(draft);
      try {
        await storage.setItem(storageKey, JSON.stringify(draft));
      } catch (error) {
        throw new Error(`Could not save local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
      }
      data = draft;
      return clone(result);
    });
    writeQueue = pending.then(() => undefined, () => undefined);
    return pending;
  };

  const read = async <T>(select: (current: StoreData) => T): Promise<T> =>
    clone(select(await load()));

  return {
    async listPeople(): Promise<Person[]> {
      return read(current => current.people);
    },
    async createPerson(input: PersonInput): Promise<Person> {
      return transact(draft => {
        const fields = validatePersonInput(input);
        if (draft.people.some(person => person.name.toLocaleLowerCase() === fields.name.toLocaleLowerCase())) {
          fail('That person is already in your planner.');
        }
        const person: Person = { id: draft.nextPersonId++, isDefault: false, ...fields };
        draft.people.push(person);
        return person;
      });
    },
    async updatePerson(id: number, input: PersonUpdate): Promise<Person> {
      return transact(draft => {
        const existing = findPerson(draft, id);
        const fields = validatePersonInput(input, existing);
        if (fields.dateOfBirth && draft.heightRecords.some(record =>
          record.personId === id && record.date < fields.dateOfBirth!)) {
          fail('Date of birth cannot be after an existing height measurement.');
        }
        if (draft.people.some(person => person.id !== id && person.name.toLocaleLowerCase() === fields.name.toLocaleLowerCase())) {
          fail('That person is already in your planner.');
        }
        Object.assign(existing, fields);
        return existing;
      });
    },
    async deletePerson(id: number): Promise<void> {
      return transact(draft => {
        const person = findPerson(draft, id);
        if (person.isDefault) fail('The default person cannot be deleted.');
        draft.people = draft.people.filter(candidate => candidate.id !== id);
        draft.entries = draft.entries.filter(entry => entry.personId !== id);
        draft.activities = draft.activities.filter(activity => activity.personId !== id);
        draft.heightRecords = draft.heightRecords.filter(record => record.personId !== id);
      });
    },
    async listFoods(params?: ListFoodsParams): Promise<Food[]> {
      const search = params?.search?.trim().toLocaleLowerCase();
      return read(current => current.foods
        .filter(food => !search || `${food.name} ${food.brand ?? ''}`.toLocaleLowerCase().includes(search))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 100)
        .map(publicFood));
    },
    async listHeightRecords(params?: ListHeightRecordsParams): Promise<HeightRecord[]> {
      return read(current => {
        if (params?.personId !== undefined) {
          if (!Number.isSafeInteger(params.personId) || params.personId < 1) fail('Choose a valid person.');
          findPerson(current, params.personId);
        }
        return current.heightRecords
          .filter(record => params?.personId === undefined || record.personId === params.personId)
          .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
      });
    },
    async createHeightRecord(input: HeightRecordInput): Promise<HeightRecord> {
      return transact(draft => {
        if (!Number.isSafeInteger(input.personId) || input.personId < 1) fail('Choose a valid person.');
        const person = findPerson(draft, input.personId);
        if (!isValidCalendarDate(input.date)) fail('Enter a valid height measurement date.');
        if (input.date > todayDate()) fail('Height measurement date cannot be in the future.');
        if (person.dateOfBirth && input.date < person.dateOfBirth) {
          fail('Height measurement date cannot be before the person’s date of birth.');
        }
        if (!isFiniteInRange(input.heightCm, 20, 300)) fail('Height must be between 20 and 300 cm.');
        if (draft.heightRecords.some(record => record.personId === input.personId && record.date === input.date)) {
          fail('A height record already exists for this person on that date. Edit the existing record instead.');
        }
        const record: StoredHeightRecord = {
          id: draft.nextHeightRecordId++,
          personId: input.personId,
          date: input.date,
          heightCm: input.heightCm,
        };
        draft.heightRecords.push(record);
        return record;
      });
    },
    async updateHeightRecord(id: number, input: HeightRecordUpdate): Promise<HeightRecord> {
      return transact(draft => {
        const record = draft.heightRecords.find(candidate => candidate.id === id);
        if (!record) fail('Height record not found.');
        const person = findPerson(draft, record.personId);
        const date = input.date === undefined ? record.date : input.date;
        const heightCm = input.heightCm === undefined ? record.heightCm : input.heightCm;
        if (!isValidCalendarDate(date)) fail('Enter a valid height measurement date.');
        if (date > todayDate()) fail('Height measurement date cannot be in the future.');
        if (person.dateOfBirth && date < person.dateOfBirth) {
          fail('Height measurement date cannot be before the person’s date of birth.');
        }
        if (!isFiniteInRange(heightCm, 20, 300)) fail('Height must be between 20 and 300 cm.');
        if (draft.heightRecords.some(candidate =>
          candidate.id !== id && candidate.personId === record.personId && candidate.date === date)) {
          fail('A height record already exists for this person on that date. Edit the existing record instead.');
        }
        record.date = date;
        record.heightCm = heightCm;
        return record;
      });
    },
    async deleteHeightRecord(id: number): Promise<void> {
      return transact(draft => {
        if (!draft.heightRecords.some(record => record.id === id)) fail('Height record not found.');
        draft.heightRecords = draft.heightRecords.filter(record => record.id !== id);
      });
    },
    async createFood(input: FoodInput): Promise<Food> {
      return transact(draft => {
        const fields = validateFood(input);
        const food: StoredFood = {
          id: draft.nextFoodId++,
          ...fields,
          source: 'custom',
          fiberKnown: true,
        };
        draft.foods.push(food);
        return publicFood(food);
      });
    },
    async updateFood(id: number, input: FoodUpdate): Promise<Food> {
      return transact(draft => {
        const food = draft.foods.find(candidate => candidate.id === id);
        if (!food || food.source !== 'custom') fail('Only custom foods can be edited.');
        const fields = validateFood(input, food);
        Object.assign(food, fields, { fiberKnown: true });
        return publicFood(food);
      });
    },
    async deleteFood(id: number): Promise<void> {
      return transact(draft => {
        const food = draft.foods.find(candidate => candidate.id === id);
        if (!food || food.source !== 'custom') fail('Only custom foods can be deleted.');
        if (draft.entries.some(entry => entry.foodId === id)) {
          fail('Remove this food from your planned meals before deleting it.');
        }
        draft.foods = draft.foods.filter(candidate => candidate.id !== id);
      });
    },
    async listMealEntries(params: ListMealEntriesParams): Promise<MealEntry[]> {
      if (!isValidCalendarDate(params.date)) fail('Choose a valid date.');
      return read(current => {
        findPerson(current, params.personId);
        return current.entries
          .filter(entry => entry.date === params.date && entry.personId === params.personId)
          .sort((left, right) => left.id - right.id)
          .map(entry => toMealEntry(current, entry));
      });
    },
    async createMealEntry(input: MealEntryInput): Promise<MealEntry> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (!MEALS.includes(input.meal)) fail('Choose a valid meal.');
        if (!Number.isSafeInteger(input.foodId) || input.foodId < 1) fail('Choose a valid food.');
        if (!isFiniteInRange(input.grams, 1, 3000)) fail('Portion must be between 1 and 3,000 grams.');
        const food = draft.foods.find(candidate => candidate.id === input.foodId);
        if (!food) fail('Food not found in your local catalog.');
        if (input.tennisDietId != null && !hasTennisDiet(draft.activities, input, input.tennisDietId)) fail('This timed diet is unavailable for the selected person and date.');
        const entry: StoredEntry = {
          id: draft.nextEntryId++,
          date: input.date,
          personId: input.personId,
          meal: input.meal,
          grams: input.grams,
          foodId: input.foodId,
          ...(input.tennisDietId != null ? { tennisDietId: input.tennisDietId } : {}),
        };
        draft.entries.push(entry);
        let activity = draft.activities.find(item => item.date === input.date && item.personId === input.personId);
        if (!activity) {
          activity = { date: input.date, personId: input.personId, activityType: 'rest' };
          draft.activities.push(activity);
        }
        activity.mealTimes ??= getMealTimes();
        return toMealEntry(draft, entry);
      });
    },
    async updateMealEntry(id: number, input: MealEntryUpdate): Promise<MealEntry> {
      return transact(draft => {
        const entry = draft.entries.find(candidate => candidate.id === id);
        if (!entry) fail('Planned food not found.');
        if (input.meal !== undefined) {
          if (!MEALS.includes(input.meal)) fail('Choose a valid meal.');
          entry.meal = input.meal;
        }
        if (input.grams !== undefined) {
          if (!isFiniteInRange(input.grams, 1, 3000)) fail('Portion must be between 1 and 3,000 grams.');
          entry.grams = input.grams;
        }
        if (input.tennisDietId !== undefined) {
          if (input.tennisDietId === null) delete entry.tennisDietId;
          else {
            if (!hasTennisDiet(draft.activities, entry, input.tennisDietId)) fail('This timed diet is unavailable for this portion’s person and date.');
            entry.tennisDietId = input.tennisDietId;
          }
        }
        return toMealEntry(draft, entry);
      });
    },
    async deleteMealEntry(id: number): Promise<void> {
      return transact(draft => {
        if (!draft.entries.some(entry => entry.id === id)) fail('Planned food not found.');
        draft.entries = draft.entries.filter(entry => entry.id !== id);
      });
    },
    async getDailySummary(params: GetDailySummaryParams): Promise<DailySummary> {
      if (!isValidCalendarDate(params.date)) fail('Choose a valid date.');
      return read(current => {
        const person = findPerson(current, params.personId);
        const activity = current.activities.find(candidate =>
          candidate.date === params.date && candidate.personId === params.personId)?.activityType ?? 'rest';
        const estimate = calculatePlanningEstimates(
          { weightKg: person.weightKg, ageYears: person.ageYears, dateOfBirth: person.dateOfBirth },
          activity,
          params.date,
        );
        const entries = current.entries
          .filter(entry => entry.date === params.date && entry.personId === params.personId)
          .sort((left, right) => left.id - right.id)
          .map(entry => toMealEntry(current, entry));
        const meals: MealSummary[] = MEALS.map(meal => {
          const matching = entries.filter(entry => entry.meal === meal);
          return {
            meal,
            count: matching.length,
            nutrition: sumNutrition(matching.map(entry => entry.nutrition)),
          };
        });
        return {
          date: params.date,
          personId: person.id,
          targetCalories: estimate.calories,
          totals: sumNutrition(entries.map(entry => entry.nutrition)),
          entryCount: entries.length,
          meals,
        };
      });
    },
    async getDayActivity(params: GetDayActivityParams): Promise<DayActivity> {
      if (!isValidCalendarDate(params.date)) fail('Choose a valid date.');
      return read(current => {
        findPerson(current, params.personId);
        return current.activities.find(activity => activity.date === params.date && activity.personId === params.personId) ??
          { date: params.date, personId: params.personId, activityType: 'rest' as const };
      });
    },
    async exportBackup(): Promise<string> {
      const pending = writeQueue.then(async () => {
        const current = await load();
        const envelope: BackupEnvelope = {
          format: 'clear-access-local-backup',
          version: 1,
          createdAt: new Date().toISOString(),
          data: clone(current),
        };
        const serialized = JSON.stringify(envelope, null, 2);
        parseBackup(serialized);
        return serialized;
      });
      writeQueue = pending.then(() => undefined, () => undefined);
      return pending;
    },
    previewBackup(serialized: string): BackupPreview {
      const { envelope, data: backup } = parseBackup(serialized);
      return summarizeBackup(backup, envelope.createdAt);
    },
    async getBackupSummary(): Promise<BackupPreview> {
      const current = await load();
      return summarizeBackup(current, new Date().toISOString());
    },
    async restoreBackup(serialized: string): Promise<void> {
      // Validate immediately for useful failures, then validate again when this operation
      // reaches the write queue so no state can be committed from stale assumptions.
      parseBackup(serialized);
      let restorationGuard: Promise<void> = Promise.resolve();
      const pending = writeQueue.then(async () => {
        restoreInProgress = restorationGuard;
        const pendingHydration = hydration;
        if (pendingHydration) await pendingHydration.catch(() => undefined);
        const restored = parseBackup(serialized).data;
        try {
          await storage.setItem(storageKey, JSON.stringify(restored));
        } catch (error) {
          throw new Error(`Could not restore local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = clone(restored);
        hydration = undefined;
      });
      writeQueue = pending.then(() => undefined, () => undefined);
      restorationGuard = pending.then(() => undefined, () => undefined);
      void restorationGuard.then(() => {
        if (restoreInProgress === restorationGuard) restoreInProgress = undefined;
      });
      return pending;
    },
    async saveDayActivity(input: DayActivityInput): Promise<DayActivity> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (!DAY_ACTIVITIES.includes(input.activityType)) fail('Choose a valid planned activity.');
        const found = draft.activities.find(activity => activity.date === input.date && activity.personId === input.personId);
        if (found) found.activityType = input.activityType;
        else draft.activities.push({ date: input.date, personId: input.personId, activityType: input.activityType });
        return draft.activities.find(activity => activity.date === input.date && activity.personId === input.personId)!;
      });
    },
    async saveMealTime(input: MealTimeInput): Promise<DayActivity> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (!MEALS.includes(input.meal)) fail('Choose a valid meal.');
        const found = draft.activities.find(item => item.date === input.date && item.personId === input.personId);
        const times = getMealTimes(found?.mealTimes);
        times[input.meal] = input.time;
        if (!isMealTimes(times)) fail('Enter a valid 24-hour HH:MM time, such as 08:00.');
        if (found) found.mealTimes = times;
        else draft.activities.push({ date: input.date, personId: input.personId, activityType: 'rest', mealTimes: times });
        return draft.activities.find(item => item.date === input.date && item.personId === input.personId)!;
      });
    },
    async getMealReminderSource(): Promise<ReminderSource> {
      return read(current => ({
        enabled: current.mealAlertsEnabled ?? false,
        people: current.people.map(({ id, name }) => ({ id, name })),
        days: current.activities.map(({ date, personId, mealTimes, mealAlerts }) => ({ date, personId, mealTimes, mealAlerts })),
      }));
    },
    async setMealAlertsEnabled(enabled: boolean): Promise<void> {
      return transact(draft => {
        if (typeof enabled !== 'boolean') fail('Choose on or off for meal alerts.');
        draft.mealAlertsEnabled = enabled;
      });
    },
    async saveMealAlerts(input: MealAlertInput): Promise<DayActivity> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (!MEALS.includes(input.meal) || !isMealAlerts({ [input.meal]: input.alerts })) fail('Use at most 8 valid alerts per meal, from 0 to 180 minutes before the meal.');
        let day = draft.activities.find(item => item.date === input.date && item.personId === input.personId);
        if (!day) {
          day = { date: input.date, personId: input.personId, activityType: 'rest', mealTimes: getMealTimes() };
          draft.activities.push(day);
        }
        day.mealAlerts = { ...day.mealAlerts, [input.meal]: clone(input.alerts) };
        day.mealTimes ??= getMealTimes();
        return day;
      });
    },
    async saveTennisPlan(input: TennisPlanInput): Promise<DayActivity> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (input.plan !== null) {
          const problem = tennisPlanProblem(input.plan);
          if (problem) fail(problem);
        }
        let activity = draft.activities.find(item => item.date === input.date && item.personId === input.personId);
        if (!activity) {
          activity = { date: input.date, personId: input.personId, activityType: 'rest' };
          draft.activities.push(activity);
        }
        if (input.plan === null) {
          delete activity.tennis;
          for (const entry of draft.entries) {
            if (entry.date === input.date && entry.personId === input.personId) delete entry.tennisDietId;
          }
        } else {
          const plan = clone(input.plan);
          // Schedule editing has its own transaction. A stale session editor cannot erase timed foods.
          if (activity.tennis?.diets) plan.diets = clone(activity.tennis.diets);
          // Editing sessions/notes must not silently discard an existing experience score.
          if (plan.experienceRating === undefined && activity.tennis?.experienceRating !== undefined) {
            plan.experienceRating = activity.tennis.experienceRating;
          }
          activity.tennis = plan;
        }
        return activity;
      });
    },
    async saveTennisPlanRating(input: TennisPlanRatingInput): Promise<DayActivity> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        if (input.rating !== null &&
            (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > 10)) {
          fail('Choose a whole-number experience rating from 0 to 10.');
        }
        const activity = draft.activities.find(day => day.date === input.date && day.personId === input.personId);
        if (!activity?.tennis) fail('Save a tennis plan for this person and date before rating it.');
        if (input.rating === null) delete activity.tennis.experienceRating;
        else activity.tennis.experienceRating = input.rating;
        return activity;
      });
    },
    async saveTennisDiet(input: TennisDietInput): Promise<TennisDiet> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        const plan = draft.activities.find(activity => activity.date === input.date && activity.personId === input.personId)?.tennis;
        if (!plan) fail('Save a tennis day plan before scheduling food.');
        const diets = plan.diets ?? [];
        const existing = input.id === undefined ? undefined : diets.find(diet => diet.id === input.id);
        if (input.id !== undefined && !existing) fail('This timed diet no longer exists.');
        if (!existing && diets.length >= 24) fail('Plan at most 24 timed diets in one day.');
        let id = input.id ?? `diet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        if (!existing && diets.some(diet => diet.id === id)) fail('Could not create a unique timed diet. Please try again.');
        const diet = { id, phase: input.phase, time: input.time };
        if (!isTennisDiet(diet)) fail('Choose a stage and a valid 24-hour HH:MM time.');
        if (existing) Object.assign(existing, diet);
        else diets.push(diet);
        plan.diets = diets;
        return diet;
      });
    },
    async deleteTennisDiet(input: TennisDietDeleteInput): Promise<void> {
      return transact(draft => {
        if (!isValidCalendarDate(input.date)) fail('Choose a valid date.');
        findPerson(draft, input.personId);
        const plan = draft.activities.find(activity => activity.date === input.date && activity.personId === input.personId)?.tennis;
        if (!plan?.diets?.some(diet => diet.id === input.id)) fail('This timed diet no longer exists.');
        plan.diets = plan.diets.filter(diet => diet.id !== input.id);
        // Unschedule, never delete the user's food portions.
        for (const entry of draft.entries) {
          if (entry.personId === input.personId && entry.date === input.date && entry.tennisDietId === input.id) delete entry.tennisDietId;
        }
      });
    },
    async listTennisFoodPlanDates(personId: number): Promise<TennisFoodPlanDate[]> {
      return read(current => {
        findPerson(current, personId);
        return current.activities.filter(day => day.personId === personId && day.tennis?.diets?.length)
          .map(day => {
            const ids = new Set(day.tennis!.diets!.map(slot => slot.id));
            return { date: day.date, slots: ids.size, foods: current.entries.filter(entry =>
              entry.personId === personId && entry.date === day.date && entry.tennisDietId && ids.has(entry.tennisDietId)).length };
          }).sort((a, b) => b.date.localeCompare(a.date));
      });
    },
    async listTennisPlanHistory(personId: number): Promise<TennisPlanHistoryItem[]> {
      return read(current => {
        findPerson(current, personId);
        return current.activities.filter(day => day.personId === personId && day.tennis)
          .map(day => {
            const plan = day.tennis!;
            const slotIds = new Set(plan.diets?.map(slot => slot.id) ?? []);
            const foods = current.entries.filter(entry =>
              entry.personId === personId && entry.date === day.date && entry.tennisDietId && slotIds.has(entry.tennisDietId)).length;
            return {
              date: day.date, rating: plan.experienceRating ?? null, tennisDayType: plan.mode,
              activityType: day.activityType, sessions: plan.sessions.length,
              slots: slotIds.size, foods,
            };
          }).sort((a, b) => b.date.localeCompare(a.date));
      });
    },
    async copyTennisFoodPlan(input: CopyTennisFoodPlanInput): Promise<CopyTennisFoodPlanResult> {
      return transact(draft => {
        if (!isValidCalendarDate(input.sourceDate) || !isValidCalendarDate(input.targetDate)) fail('Choose valid source and destination dates.');
        const sourcePerson = findPerson(draft, input.sourcePersonId);
        const targetPerson = findPerson(draft, input.targetPersonId);
        if (sourcePerson.id === targetPerson.id && input.sourceDate === input.targetDate) {
          fail('Choose a different destination date when copying for the same person.');
        }
        if (input.expectedTargetName !== targetPerson.name) fail('The destination person changed. Review your selection and try again.');
        const source = draft.activities.find(day => day.personId === sourcePerson.id && day.date === input.sourceDate)?.tennis;
        if (!source?.diets?.length) fail('The source date has no tennis food timetable. Choose another date.');
        const sourceIds = new Set(source.diets.map(slot => slot.id));
        const entries = draft.entries.filter(entry => entry.personId === sourcePerson.id &&
          entry.date === input.sourceDate && entry.tennisDietId && sourceIds.has(entry.tennisDietId));
        if (input.expectedSource !== getTennisFoodPlanFingerprint(source, entries.map(entry => toMealEntry(draft, entry)), sourcePerson.name)) {
          fail('The source food plan changed. Refresh the preview and review it before copying.');
        }
        let target = draft.activities.find(day => day.personId === targetPerson.id && day.date === input.targetDate);
        if (target?.tennis?.diets?.length) fail('The destination already has a tennis food timetable. Choose another date; nothing was overwritten.');
        // No replacement or deletion: ordinary meals and all destination preferences survive.
        if (!target) {
          target = { date: input.targetDate, personId: targetPerson.id, activityType: 'rest' };
          draft.activities.push(target);
        }
        const idMap = new Map<string, string>();
        const used = new Set(sourceIds);
        let sequence = 0;
        const diets = source.diets.map(slot => {
          let id: string;
          do { id = `diet-copy-${targetPerson.id.toString(36)}-${input.targetDate}-${draft.nextEntryId.toString(36)}-${(sequence++).toString(36)}`; } while (used.has(id));
          used.add(id); idMap.set(slot.id, id);
          return { ...slot, id };
        });
        // Existing practice/match sessions are independent of imported food times.
        if (target.tennis) target.tennis = { ...target.tennis, diets };
        else {
          target.tennis = { ...clone(source), diets };
          // A past experience score belongs to the source date, not the copied plan.
          delete target.tennis.experienceRating;
        }
        if (entries.length && !target.mealTimes) target.mealTimes = getMealTimes();
        for (const entry of entries) {
          draft.entries.push({
            id: draft.nextEntryId++, personId: targetPerson.id, date: input.targetDate,
            meal: entry.meal, grams: entry.grams, foodId: entry.foodId,
            tennisDietId: idMap.get(entry.tennisDietId!)!,
          });
        }
        return { personId: targetPerson.id, date: input.targetDate, copiedSlots: diets.length, copiedFoods: entries.length };
      });
    },
    async exportForTests(): Promise<unknown> {
      return read(current => current);
    },
  };
}

export type BackupPreview = {
  createdAt: string;
  people: Array<{ id: number; name: string; entries: number; activities: number; heightRecords: number }>;
  foods: number;
  entries: number;
  activities: number;
  heightRecords: number;
};

function summarizeBackup(data: StoreData, createdAt: string): BackupPreview {
  return {
    createdAt,
    people: data.people.map(person => ({
      id: person.id,
      name: person.name,
      entries: data.entries.filter(entry => entry.personId === person.id).length,
      activities: data.activities.filter(activity => activity.personId === person.id).length,
      heightRecords: data.heightRecords.filter(record => record.personId === person.id).length,
    })),
    foods: data.foods.length,
    entries: data.entries.length,
    activities: data.activities.length,
    heightRecords: data.heightRecords.length,
  };
}

function isISODateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function parseBackup(serialized: string): { envelope: BackupEnvelope; data: StoreData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('Backup is not valid JSON.');
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ['format', 'version', 'createdAt', 'data'])) {
    fail('Backup has an invalid envelope.');
  }
  if (parsed.format !== 'clear-access-local-backup' || parsed.version !== 1) {
    fail(`Unsupported local backup format or version (${String(parsed.version)}).`);
  }
  if (!isISODateTime(parsed.createdAt)) fail('Backup has an invalid creation timestamp.');
  const data = validateBackupData(parsed.data);
  return { envelope: parsed as unknown as BackupEnvelope, data };
}
