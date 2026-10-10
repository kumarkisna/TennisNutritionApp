import { referenceFoodSeed } from './reference-food-seed';
import { calculatePlanningEstimates, getAgeOnDate } from './planning-targets';
import { emptyTennisPlan, isTennisPlan, isTennisDiet, tennisPlanProblem, tennisActivityPlanProblem } from './tennis-planning';
import { getMealTimes, isMealTimes } from './meal-scheduling';
import { isMealAlerts, type ReminderSource } from './meal-reminders';
import { getTennisFoodDestinationFingerprint, getTennisFoodImportKey, getTennisFoodPlanFingerprint, mapTennisFoodSlots } from './tennis-copy';
import { isFoodIngredientList } from './food-nutrition';
import {
  ActivityLevel,
  DayActivityType,
  FoodCategory,
  Meal,
  NutritionGoal,
  type ActivityLevel as ActivityLevelType,
  type NutritionGoal as NutritionGoalType,
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
  type TennisFoodImportRef,
  type TennisFoodPlanDate,
  type TennisDiet,
  type DailySummary,
  type Food,
  type FoodInput,
  type FoodUpdate,
  type HeightRecord,
  type HeightRecordInput,
  type HeightRecordUpdate,
  type WeightRecord,
  type WeightRecordInput,
  type WeightRecordUpdate,
  type GetDayActivityParams,
  type GetDailySummaryParams,
  type ListFoodsParams,
  type ListHeightRecordsParams,
  type ListWeightRecordsParams,
  type ListMealEntriesParams,
  type MealEntry,
  type MealEntryInput,
  type MealEntryUpdate,
  type MealCombination,
  type MealCombinationInput,
  type MealCombinationApplyInput,
  type MealSummary,
  type Nutrition,
  type Person,
  type PersonInput,
  type PersonUpdate,
} from './local-models';

export const LOCAL_STORAGE_KEY = 'clear-access-mobile:planner:v1';
const STORE_VERSION = 7;
const MEALS = Object.values(Meal);
const ACTIVITY_LEVELS = Object.values(ActivityLevel);
const DAY_ACTIVITIES = Object.values(DayActivityType);
const NUTRITION_GOALS = Object.values(NutritionGoal);
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
type StoredMealCombination = MealCombination;
type StoredHeightRecord = HeightRecord;
type StoredWeightRecord = WeightRecord;
type StoreData = {
  version: number;
  people: Person[];
  foods: StoredFood[];
  entries: StoredEntry[];
  activities: DayActivity[];
  heightRecords: StoredHeightRecord[];
  weightRecords: StoredWeightRecord[];
  mealCombinations: StoredMealCombination[];
  nextPersonId: number;
  nextFoodId: number;
  nextEntryId: number;
  nextHeightRecordId: number;
  nextWeightRecordId: number;
  mealAlertsEnabled?: boolean;
};

type BackupEnvelope = {
  format: 'clear-access-local-backup';
  version: 1;
  createdAt: string;
  data: StoreData;
};
type FoodLibraryEnvelope = {
  format: 'clear-access-food-library';
  version: 1;
  exportedAt: string;
  foods: Food[];
};
export type FoodLibraryImportPreview = {
  exportedAt: string;
  currentCount: number;
  incomingCount: number;
  newCount: number;
  duplicateCount: number;
};
export type FoodLibraryImportResult = {
  incomingCount: number;
  imported: number;
  skippedDuplicates: number;
};
type PersonPlannerEnvelope = {
  format: 'clear-access-person-planner';
  version: 1 | 2;
  exportedAt: string;
  data: StoreData;
};
type AllPeoplePlannerEnvelope = {
  format: 'clear-access-all-people-planner';
  version: 1 | 2;
  exportedAt: string;
  data: StoreData;
};
export type ImportRecordEstimate = {
  incoming: number;
  toAdd: number;
  toSkip: number;
};
export type PersonPlannerRestoreEstimate = {
  destination: 'new' | 'existing';
  targetPerson: Pick<Person, 'id' | 'name'> | null;
  entries: ImportRecordEstimate;
  activities: ImportRecordEstimate;
  heightRecords: ImportRecordEstimate;
  weightRecords: ImportRecordEstimate;
};
export type PersonPlannerImportEstimate = PersonPlannerRestoreEstimate & {
  foods: ImportRecordEstimate;
};
export type PersonPlannerImportPreview = {
  exportedAt: string;
  personName: string;
  suggestedName: string;
  nameConflict: boolean;
  hasStableIdentity: boolean;
  matchedPerson: Pick<Person, 'id' | 'name'> | null;
  sameNamePerson: Pick<Person, 'id' | 'name'> | null;
  foods: number;
  entries: number;
  activities: number;
  heightRecords: number;
  weightRecords: number;
  estimate: PersonPlannerImportEstimate;
};
export type PersonPlannerImportResult = {
  person: Person;
  matchedExisting: boolean;
  foodsImported: number;
  entriesImported: number;
  activitiesImported: number;
  heightRecordsImported: number;
  weightRecordsImported: number;
};
export type AllPeoplePlannerImportPreview = {
  exportedAt: string;
  people: Array<{
    personName: string;
    suggestedName: string;
    nameConflict: boolean;
    hasStableIdentity: boolean;
    matchedPerson: Pick<Person, 'id' | 'name'> | null;
    sameNamePerson: Pick<Person, 'id' | 'name'> | null;
    entries: number;
    activities: number;
    heightRecords: number;
    weightRecords: number;
    estimate: PersonPlannerRestoreEstimate;
  }>;
  foods: number;
  estimate: {
    newProfiles: number;
    matchedProfiles: number;
    foods: ImportRecordEstimate;
    entries: ImportRecordEstimate;
    activities: ImportRecordEstimate;
    heightRecords: ImportRecordEstimate;
    weightRecords: ImportRecordEstimate;
  };
};
export type AllPeoplePlannerImportResult = {
  people: Person[];
  matchedPeople: Person[];
  foodsImported: number;
  entriesImported: number;
  activitiesImported: number;
  heightRecordsImported: number;
  weightRecordsImported: number;
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
function isMealCombinationList(value: unknown, foodIds: ReadonlySet<number>): value is StoredMealCombination[] {
  if (!Array.isArray(value) || value.length > 500) return false;
  const ids = new Set<string>();
  for (const combo of value) {
    if (!isRecord(combo) || !hasExactKeys(combo, ['id', 'name', 'keyword', 'rating', 'notes', 'portions']) ||
      typeof combo.id !== 'string' || !combo.id.trim() || combo.id.length > 128 || ids.has(combo.id) ||
      typeof combo.name !== 'string' || !combo.name.trim() || combo.name.length > 80 ||
      typeof combo.keyword !== 'string' || !combo.keyword.trim() || combo.keyword.length > 40 ||
      !isFiniteInRange(combo.rating, 1, 10) || !Number.isInteger(combo.rating) ||
      typeof combo.notes !== 'string' || combo.notes.length > 1000 ||
      !Array.isArray(combo.portions) || combo.portions.length < 1 || combo.portions.length > 200 ||
      combo.portions.some(item => !isRecord(item) || !hasExactKeys(item, ['meal', 'foodId', 'grams']) ||
        !MEALS.includes(item.meal as MealEntryInput['meal']) || !foodIds.has(item.foodId as number) ||
        !isFiniteInRange(item.grams, 1, 3000))) return false;
    ids.add(combo.id);
  }
  return true;
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => required.includes(key) || optional.includes(key));
}
function isBackupId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}
function isTennisFoodImportRefs(value: unknown): value is TennisFoodImportRef[] {
  if (!Array.isArray(value) || value.length > 2400) return false;
  const seen = new Set<string>();
  for (const ref of value) {
    if (!isRecord(ref) || !hasExactKeys(ref, ['sourcePersonBackupId', 'sourceDate', 'sourceDietId']) ||
      !isBackupId(ref.sourcePersonBackupId) || typeof ref.sourceDate !== 'string' ||
      !isValidCalendarDate(ref.sourceDate) || typeof ref.sourceDietId !== 'string' ||
      !ref.sourceDietId.trim() || ref.sourceDietId.length > 240) return false;
    const key = JSON.stringify([ref.sourcePersonBackupId, ref.sourceDate, ref.sourceDietId]);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
function createBackupId(existingIds: ReadonlySet<string> = new Set()): string {
  let id: string;
  do {
    const randomPart = () => Math.random().toString(36).slice(2);
    id = `ca-${Date.now().toString(36)}-${randomPart()}${randomPart()}`;
  } while (existingIds.has(id));
  return id;
}
function addMissingBackupIds(people: unknown[]): unknown[] {
  const existingIds = new Set<string>();
  for (const person of people) {
    if (!isRecord(person) || !Array.isArray(person.backupIds)) continue;
    for (const id of person.backupIds) {
      if (typeof id === 'string') existingIds.add(id);
    }
  }
  return people.map(person => {
    if (!isRecord(person) || Object.hasOwn(person, 'backupIds')) return person;
    const backupId = createBackupId(existingIds);
    existingIds.add(backupId);
    return { ...person, backupIds: [backupId] };
  });
}
function findPersonByBackupIds(people: Person[], backupIds: string[]): Person | undefined {
  const incomingIds = new Set(backupIds);
  const matches = people.filter(person => person.backupIds.some(id => incomingIds.has(id)));
  if (matches.length > 1) {
    fail('This backup ID is linked to more than one person on this device. No data was changed.');
  }
  return matches[0];
}
// Same-name restores append imported identities; keep the first ID as the profile's original identity.
function mergeBackupIds(target: Person, source: Person, people: Person[]): void {
  for (const backupId of source.backupIds) {
    if (people.some(person => person.id !== target.id && person.backupIds.includes(backupId))) {
      fail('This backup ID is already linked to another person. No data was changed.');
    }
  }
  target.backupIds = [...new Set([...target.backupIds, ...source.backupIds])];
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
function ageForDateOfBirth(dateOfBirth: unknown): number | null {
  if (typeof dateOfBirth !== 'string' || !isValidCalendarDate(dateOfBirth)) return null;
  return getAgeOnDate(dateOfBirth, todayDate());
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
    backupIds: [createBackupId()],
    name: 'Me',
    isDefault: true,
    weightKg: null,
    targetWeightKg: null,
    ageYears: null,
    dateOfBirth: null,
    growthReferenceSex: null,
    nutritionGoal: null,
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
    weightRecords: [],
    mealCombinations: [],
    nextPersonId: 2,
    nextFoodId: foods.length + 1,
    nextEntryId: 1,
    nextHeightRecordId: 1,
    nextWeightRecordId: 1,
  };
}

function validateStoredData(value: unknown): StoreData {
  if (!isRecord(value)) fail('Local planner storage is corrupted. Your data was not changed.');
  if (value.version !== STORE_VERSION) {
    fail(`Unsupported local planner storage version (${String(value.version)}). Your data was not changed.`);
  }
  const { people, foods, entries, activities, heightRecords, weightRecords, nextPersonId, nextFoodId, nextEntryId, nextHeightRecordId, nextWeightRecordId } = value;
  const mealCombinations = value.mealCombinations === undefined ? [] : value.mealCombinations;
  if (value.mealAlertsEnabled !== undefined && typeof value.mealAlertsEnabled !== 'boolean') fail('Local reminder settings are invalid. Your data was not changed.');
  if (
    !Array.isArray(people) || !Array.isArray(foods) || !Array.isArray(entries) || !Array.isArray(activities) ||
    !Array.isArray(heightRecords) ||
    !Array.isArray(weightRecords) ||
    !Array.isArray(mealCombinations) ||
    !Number.isSafeInteger(nextPersonId) || !Number.isSafeInteger(nextFoodId) || !Number.isSafeInteger(nextEntryId) ||
    !Number.isSafeInteger(nextHeightRecordId) ||
    !Number.isSafeInteger(nextWeightRecordId) ||
    !people.some(p => isRecord(p) && p.isDefault === true)
  ) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  const personIds = new Set<number>();
  const personBackupIds = new Set<string>();
  let defaultPeople = 0;
  for (const person of people) {
    if (!isRecord(person) || !Number.isSafeInteger(person.id) || (person.id as number) < 1 ||
      typeof person.name !== 'string' || !person.name.trim() ||
       !Array.isArray(person.backupIds) || person.backupIds.length === 0 ||
       person.backupIds.some(id => !isBackupId(id) || personBackupIds.has(id)) ||
       new Set(person.backupIds).size !== person.backupIds.length ||
       !(person.ageYears === null || (Number.isInteger(person.ageYears) && isFiniteInRange(person.ageYears, 0, 120))) ||
       !(person.targetWeightKg === null || isFiniteInRange(person.targetWeightKg, 1, 500)) ||
       !(person.dateOfBirth === null || (typeof person.dateOfBirth === 'string' &&
         isValidCalendarDate(person.dateOfBirth) && person.dateOfBirth <= todayDate())) ||
       (person.dateOfBirth === null && person.ageYears !== null) ||
       (person.dateOfBirth !== null && person.ageYears === null) ||
       !(person.growthReferenceSex === null || person.growthReferenceSex === 'male' || person.growthReferenceSex === 'female') ||
       !(person.nutritionGoal === null || NUTRITION_GOALS.includes(person.nutritionGoal as NutritionGoalType)) ||
      !ACTIVITY_LEVELS.includes(person.activityLevel as ActivityLevelType) ||
      !Number.isInteger(person.baselineCalories) ||
      !isFiniteInRange(person.activityMultiplier, 1, 1.35) ||
      !Number.isFinite(person.targetCalories) || personIds.has(person.id as number)) {
      fail('Local planner storage contains an invalid person. Your data was not changed.');
    }
    personIds.add(person.id as number);
     for (const backupId of person.backupIds as string[]) personBackupIds.add(backupId);
    if (person.isDefault === true) defaultPeople += 1;
  }
  if (defaultPeople !== 1) fail('Local planner storage must contain exactly one default person. Your data was not changed.');
  const foodIds = new Set<number>();
  for (const food of foods) {
    if (!isRecord(food) || !Number.isSafeInteger(food.id) || (food.id as number) < 1 ||
      typeof food.name !== 'string' || !food.name.trim() || foodIds.has(food.id as number) ||
      !CATEGORIES.includes(food.category as Food['category']) ||
      !['reference', 'custom', 'open_food_facts'].includes(String(food.source)) ||
      (food.ingredients !== undefined && (food.source !== 'custom' || !isFoodIngredientList(food.ingredients))) ||
      !['caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'fiberPer100g']
        .every(key => typeof food[key] === 'number' && Number.isFinite(food[key])) ||
      (food.calciumMgPer100g !== null && typeof food.calciumMgPer100g !== 'number') ||
      (food.ironMgPer100g !== null && typeof food.ironMgPer100g !== 'number')) {
      fail('Local planner storage contains an invalid food. Your data was not changed.');
    }
    foodIds.add(food.id as number);
  }
  if (!isMealCombinationList(mealCombinations, foodIds)) fail('Local planner storage contains an invalid meal combination. Your data was not changed.');
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
      (activity.tennisFoodImports !== undefined && !isTennisFoodImportRefs(activity.tennisFoodImports)) ||
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
  const weightRecordIds = new Set<number>();
  const weightRecordKeys = new Set<string>();
  for (const record of weightRecords) {
    if (!isRecord(record) || !Number.isSafeInteger(record.id) || (record.id as number) < 1 ||
      weightRecordIds.has(record.id as number) || !personIds.has(record.personId as number) ||
      typeof record.date !== 'string' || !isValidCalendarDate(record.date) || record.date > todayDate() ||
      !isFiniteInRange(record.weightKg, 1, 500)) {
      fail('Local planner storage contains an invalid weight record. Your data was not changed.');
    }
    const person = people.find(candidate => isRecord(candidate) && candidate.id === record.personId);
    if (person && typeof person.dateOfBirth === 'string' && person.dateOfBirth > record.date) {
      fail('Local planner storage contains a weight record before the person’s date of birth. Your data was not changed.');
    }
    const key = `${record.personId}:${record.date}`;
    if (weightRecordKeys.has(key)) {
      fail('Local planner storage contains duplicate weight records. Your data was not changed.');
    }
    weightRecordKeys.add(key);
    weightRecordIds.add(record.id as number);
  }
  if ((nextPersonId as number) <= Math.max(...personIds) ||
    (foodIds.size && (nextFoodId as number) <= Math.max(...foodIds)) ||
    (entryIds.size && (nextEntryId as number) <= Math.max(...entryIds)) ||
    (heightRecordIds.size && (nextHeightRecordId as number) <= Math.max(...heightRecordIds)) ||
    (weightRecordIds.size && (nextWeightRecordId as number) <= Math.max(...weightRecordIds))) {
    fail('Local planner storage has invalid next-ID counters. Your data was not changed.');
  }
  return { ...value, mealCombinations } as unknown as StoreData;
}

function validateBackupData(value: unknown): StoreData {
  const invalid = (kind: string): never => fail(`Backup contains an invalid ${kind}.`);
  if (isRecord(value) && [2, 3, 4, 5, 6].includes(value.version as number) && Array.isArray(value.people)) {
    return validateBackupData({
      ...value,
      version: STORE_VERSION,
      mealCombinations: [],
      people: addMissingBackupIds(value.people.map(person => isRecord(person) ? {
        ...person,
        ...(value.version === 2 ? { nutritionGoal: null } : {}),
        ageYears: ageForDateOfBirth(person.dateOfBirth),
        targetWeightKg: person.targetWeightKg === undefined ? null : person.targetWeightKg,
      } : person)),
      weightRecords: value.weightRecords === undefined ? [] : value.weightRecords,
      nextWeightRecordId: value.nextWeightRecordId === undefined ? 1 : value.nextWeightRecordId,
    });
  }
  if (!isRecord(value) || !hasExactKeys(value, [
    'version', 'people', 'foods', 'entries', 'activities', 'heightRecords', 'weightRecords',
    'nextPersonId', 'nextFoodId', 'nextEntryId', 'nextHeightRecordId', 'nextWeightRecordId', 'mealCombinations',
  ], ['mealAlertsEnabled']) || (Object.hasOwn(value, 'mealAlertsEnabled') && typeof value.mealAlertsEnabled !== 'boolean') || value.version !== STORE_VERSION ||
    !Array.isArray(value.people) || !Array.isArray(value.foods) || !Array.isArray(value.entries) ||
    !Array.isArray(value.activities) || !Array.isArray(value.heightRecords) || !Array.isArray(value.weightRecords) ||
    !Array.isArray(value.mealCombinations)) {
    return invalid('data structure');
  }
  const counters = [value.nextPersonId, value.nextFoodId, value.nextEntryId, value.nextHeightRecordId, value.nextWeightRecordId];
  if (!counters.every(counter => Number.isSafeInteger(counter) && (counter as number) >= 1)) {
    return invalid('ID counter');
  }

  const peopleById = new Map<number, Record<string, unknown>>();
  const peopleNames = new Set<string>();
  const personBackupIds = new Set<string>();
  let defaultPeople = 0;
  for (const person of value.people) {
    if (!isRecord(person) || !hasExactKeys(person, [
      'id', 'backupIds', 'name', 'isDefault', 'weightKg', 'ageYears', 'dateOfBirth', 'growthReferenceSex',
      'targetWeightKg',
      'nutritionGoal',
      'ironGoalMg', 'ironGoalSource', 'ironGoalReviewedOn', 'fatGoalG', 'fatGoalSource',
      'fatGoalReviewedOn', 'activityLevel', 'baselineCalories', 'activityMultiplier', 'targetCalories',
    ]) || !Number.isSafeInteger(person.id) || (person.id as number) < 1 ||
      typeof person.name !== 'string' || !person.name.trim() || person.name.length > 80 ||
      typeof person.isDefault !== 'boolean' ||
      !(person.weightKg === null || isFiniteInRange(person.weightKg, 1, 500)) ||
      !(person.targetWeightKg === null || isFiniteInRange(person.targetWeightKg, 1, 500)) ||
      !(person.ageYears === null || (Number.isInteger(person.ageYears) && isFiniteInRange(person.ageYears, 0, 120))) ||
      !(person.dateOfBirth === null || (typeof person.dateOfBirth === 'string' &&
        isValidCalendarDate(person.dateOfBirth) && person.dateOfBirth <= todayDate())) ||
      !Array.isArray(person.backupIds) || person.backupIds.length === 0 ||
      person.backupIds.some(id => !isBackupId(id) || personBackupIds.has(id)) ||
      new Set(person.backupIds).size !== person.backupIds.length ||
      (person.dateOfBirth === null && person.ageYears !== null) ||
      (person.dateOfBirth !== null && person.ageYears === null) ||
      !(person.growthReferenceSex === null || person.growthReferenceSex === 'male' || person.growthReferenceSex === 'female') ||
      !(person.nutritionGoal === null || NUTRITION_GOALS.includes(person.nutritionGoal as NutritionGoalType)) ||
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
    for (const backupId of person.backupIds as string[]) personBackupIds.add(backupId);
    if (person.isDefault) defaultPeople += 1;
  }
  if (defaultPeople !== 1) return invalid('default person');

  const foodIds = new Set<number>();
  for (const food of value.foods) {
    if (!isRecord(food) || !hasExactKeys(food, [
      'id', 'name', 'category', 'source', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g',
      'fatPer100g', 'fiberPer100g', 'fiberKnown', 'calciumMgPer100g', 'ironMgPer100g',
    ], ['brand', 'sourceUrl', 'referenceKey', 'ingredients']) ||
      !Number.isSafeInteger(food.id) || (food.id as number) < 1 ||
      typeof food.name !== 'string' || !food.name.trim() || food.name.length > 120 ||
      (food.brand !== undefined && (typeof food.brand !== 'string' || food.brand.length > 160)) ||
      (food.sourceUrl !== undefined && (typeof food.sourceUrl !== 'string' || food.sourceUrl.length > 2048)) ||
      (food.referenceKey !== undefined && (typeof food.referenceKey !== 'string' || !food.referenceKey.trim() || food.referenceKey.length > 120)) ||
      !CATEGORIES.includes(food.category as Food['category']) ||
      !['reference', 'custom', 'open_food_facts'].includes(String(food.source)) ||
      (food.ingredients !== undefined && (food.source !== 'custom' || !isFoodIngredientList(food.ingredients))) ||
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
  if (!isMealCombinationList(value.mealCombinations, foodIds)) return invalid('meal combination');

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
    if (!isRecord(activity) || !hasExactKeys(activity, ['date', 'personId', 'activityType'], ['tennis', 'mealTimes', 'mealAlerts', 'tennisFoodImports']) ||
      typeof activity.date !== 'string' || !isValidCalendarDate(activity.date) ||
      !Number.isSafeInteger(activity.personId) || !peopleById.has(activity.personId as number) ||
      !DAY_ACTIVITIES.includes(activity.activityType as DayActivity['activityType']) ||
      (Object.hasOwn(activity, 'tennis') && !isTennisPlan(activity.tennis)) ||
      (Object.hasOwn(activity, 'tennisFoodImports') && !isTennisFoodImportRefs(activity.tennisFoodImports)) ||
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
  const weightRecordIds = new Set<number>();
  const weightRecordKeys = new Set<string>();
  for (const record of value.weightRecords) {
    if (!isRecord(record) || !hasExactKeys(record, ['id', 'personId', 'date', 'weightKg']) ||
      !Number.isSafeInteger(record.id) || (record.id as number) < 1 || weightRecordIds.has(record.id as number) ||
      !Number.isSafeInteger(record.personId) || !peopleById.has(record.personId as number) ||
      typeof record.date !== 'string' || !isValidCalendarDate(record.date) || record.date > todayDate() ||
      !isFiniteInRange(record.weightKg, 1, 500)) {
      return invalid('weight record');
    }
    const person = peopleById.get(record.personId as number)!;
    if (typeof person.dateOfBirth === 'string' && person.dateOfBirth > record.date) {
      return invalid('weight record date');
    }
    const key = `${record.personId}:${record.date}`;
    if (weightRecordKeys.has(key)) return invalid('duplicate weight record');
    weightRecordKeys.add(key);
    weightRecordIds.add(record.id as number);
  }

  if ((value.nextPersonId as number) <= Math.max(0, ...peopleById.keys()) ||
    (value.nextFoodId as number) <= Math.max(0, ...foodIds) ||
    (value.nextEntryId as number) <= Math.max(0, ...entryIds) ||
    (value.nextHeightRecordId as number) <= Math.max(0, ...heightRecordIds) ||
    (value.nextWeightRecordId as number) <= Math.max(0, ...weightRecordIds)) {
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
    people: addMissingBackupIds(value.people.map(person => isRecord(person) ? {
      ...person,
      targetWeightKg: person.targetWeightKg === undefined ? null : person.targetWeightKg,
      dateOfBirth: person.dateOfBirth === undefined ? null : person.dateOfBirth,
      growthReferenceSex: person.growthReferenceSex === undefined ? null : person.growthReferenceSex,
      nutritionGoal: person.nutritionGoal === undefined ? null : person.nutritionGoal,
      ageYears: ageForDateOfBirth(person.dateOfBirth),
    } : person)),
    heightRecords: [],
    nextHeightRecordId: 1,
    weightRecords: [],
    nextWeightRecordId: 1,
  };
  return validateStoredData(migrated);
}

function migrateVersionTwo(value: unknown): StoreData {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.people)) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  return validateStoredData({
    ...value,
    version: STORE_VERSION,
    people: addMissingBackupIds(value.people.map(person => isRecord(person) ? {
      ...person,
      targetWeightKg: person.targetWeightKg === undefined ? null : person.targetWeightKg,
      nutritionGoal: null,
      ageYears: ageForDateOfBirth(person.dateOfBirth),
    } : person)),
    weightRecords: value.weightRecords === undefined ? [] : value.weightRecords,
    nextWeightRecordId: value.nextWeightRecordId === undefined ? 1 : value.nextWeightRecordId,
  });
}

function migrateVersionThree(value: unknown): StoreData {
  if (!isRecord(value) || value.version !== 3 || !Array.isArray(value.people)) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  return validateStoredData({
    ...value,
    version: STORE_VERSION,
    people: addMissingBackupIds(value.people.map(person => isRecord(person) ? {
      ...person,
      targetWeightKg: person.targetWeightKg === undefined ? null : person.targetWeightKg,
      ageYears: ageForDateOfBirth(person.dateOfBirth),
    } : person)),
    weightRecords: value.weightRecords === undefined ? [] : value.weightRecords,
    nextWeightRecordId: value.nextWeightRecordId === undefined ? 1 : value.nextWeightRecordId,
  });
}

function migrateVersionFour(value: unknown): StoreData {
  if (!isRecord(value) || value.version !== 4 || !Array.isArray(value.people)) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  return validateStoredData({
    ...value,
    version: STORE_VERSION,
    people: addMissingBackupIds(value.people.map(person => isRecord(person) ? {
      ...person,
      targetWeightKg: person.targetWeightKg === undefined ? null : person.targetWeightKg,
    } : person)),
    weightRecords: value.weightRecords === undefined ? [] : value.weightRecords,
    nextWeightRecordId: value.nextWeightRecordId === undefined ? 1 : value.nextWeightRecordId,
  });
}

function migrateVersionFive(value: unknown): StoreData {
  if (!isRecord(value) || value.version !== 5 || !Array.isArray(value.people)) {
    fail('Local planner storage is corrupted. Your data was not changed.');
  }
  return validateStoredData({
    ...value,
    version: STORE_VERSION,
    people: addMissingBackupIds(value.people),
  });
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
function publicFood(food: StoredFood): Food {
  const { referenceKey: _referenceKey, ...result } = food;
  return result;
}
function foodFingerprint(food: Food): string {
  return JSON.stringify([
    food.name.trim().toLocaleLowerCase(),
    food.brand?.trim().toLocaleLowerCase() ?? null,
    food.sourceUrl ?? null,
    food.category,
    food.source,
    food.caloriesPer100g,
    food.proteinPer100g,
    food.carbsPer100g,
    food.fatPer100g,
    food.fiberPer100g,
    food.fiberKnown,
    food.calciumMgPer100g,
    food.ironMgPer100g,
    food.ingredients ?? [],
  ]);
}
type PlannerImportCounts = {
  foodsImported: number;
  entriesImported: number;
  activitiesImported: number;
  heightRecordsImported: number;
  weightRecordsImported: number;
};
function mergePlannerRecords(
  draft: StoreData,
  incoming: StoreData,
  personIds: Map<number, number>,
): PlannerImportCounts {
  const foodFingerprints = new Map<string, number>();
  for (const food of draft.foods) {
    const fingerprint = foodFingerprint(publicFood(food));
    if (!foodFingerprints.has(fingerprint)) foodFingerprints.set(fingerprint, food.id);
  }
  const importedFoodIds = new Map<number, number>();
  let foodsImported = 0;
  for (const food of incoming.foods) {
    const fingerprint = foodFingerprint(publicFood(food));
    let targetId = foodFingerprints.get(fingerprint);
    if (targetId === undefined) {
      targetId = draft.nextFoodId++;
      draft.foods.push({ ...food, id: targetId });
      foodFingerprints.set(fingerprint, targetId);
      foodsImported += 1;
    }
    importedFoodIds.set(food.id, targetId);
  }

  const dietIds = new Map<string, string>();
  const dietKey = (personId: number, date: string, id: string) => JSON.stringify([personId, date, id]);
  let activitiesImported = 0;
  for (const activity of incoming.activities) {
    const personId = personIds.get(activity.personId);
    if (personId === undefined) fail('Planner file references a missing person.');
    const existing = draft.activities.find(candidate =>
      candidate.personId === personId && candidate.date === activity.date);
    if (!existing) {
      draft.activities.push({ ...activity, personId });
      activitiesImported += 1;
      for (const diet of activity.tennis?.diets ?? []) {
        dietIds.set(dietKey(activity.personId, activity.date, diet.id), diet.id);
      }
      continue;
    }

    let changed = false;
    if (activity.tennis) {
      if (!existing.tennis) {
        existing.tennis = clone(activity.tennis);
        changed = true;
        for (const diet of activity.tennis.diets ?? []) {
          dietIds.set(dietKey(activity.personId, activity.date, diet.id), diet.id);
        }
      } else {
        const targetDiets = existing.tennis.diets ?? [];
        for (const diet of activity.tennis.diets ?? []) {
          const matchingDiet = targetDiets.find(candidate =>
            candidate.id === diet.id && candidate.phase === diet.phase && candidate.time === diet.time) ??
            targetDiets.find(candidate => candidate.phase === diet.phase && candidate.time === diet.time);
          if (matchingDiet) {
            dietIds.set(dietKey(activity.personId, activity.date, diet.id), matchingDiet.id);
            continue;
          }
          const id = targetDiets.some(candidate => candidate.id === diet.id)
            ? createBackupId(new Set(targetDiets.map(candidate => candidate.id)))
            : diet.id;
          targetDiets.push({ ...diet, id });
          existing.tennis.diets = targetDiets;
          dietIds.set(dietKey(activity.personId, activity.date, diet.id), id);
          changed = true;
        }
      }
    }
    if (!existing.mealTimes && activity.mealTimes) {
      existing.mealTimes = clone(activity.mealTimes);
      changed = true;
    }
    if (activity.mealAlerts) {
      if (!existing.mealAlerts) {
        existing.mealAlerts = clone(activity.mealAlerts);
        changed = true;
      } else {
        for (const meal of MEALS) {
          const alerts = activity.mealAlerts[meal];
          if (alerts && !existing.mealAlerts[meal]) {
            existing.mealAlerts[meal] = clone(alerts);
            changed = true;
          }
        }
      }
    }
    if (changed) activitiesImported += 1;
    for (const diet of activity.tennis?.diets ?? []) {
      if (!dietIds.has(dietKey(activity.personId, activity.date, diet.id))) {
        const targetDiet = existing.tennis?.diets?.find(candidate =>
          candidate.id === diet.id && candidate.phase === diet.phase && candidate.time === diet.time) ??
          existing.tennis?.diets?.find(candidate =>
            candidate.phase === diet.phase && candidate.time === diet.time);
        if (targetDiet) dietIds.set(dietKey(activity.personId, activity.date, diet.id), targetDiet.id);
      }
    }
  }

  const entryKeys = new Set(draft.entries.map(entry => JSON.stringify([
    entry.personId, entry.date, entry.meal, entry.foodId, entry.grams, entry.tennisDietId ?? null,
  ])));
  let entriesImported = 0;
  for (const entry of incoming.entries) {
    const personId = personIds.get(entry.personId);
    const foodId = importedFoodIds.get(entry.foodId);
    if (personId === undefined) fail('Planner file references a missing person.');
    if (foodId === undefined) fail('Planner file references a missing food record.');
    const tennisDietId = entry.tennisDietId
      ? dietIds.get(dietKey(entry.personId, entry.date, entry.tennisDietId))
      : undefined;
    if (entry.tennisDietId && !tennisDietId) fail('Planner file references a missing tennis food slot.');
    const key = JSON.stringify([
      personId, entry.date, entry.meal, foodId, entry.grams, tennisDietId ?? null,
    ]);
    if (entryKeys.has(key)) continue;
    draft.entries.push({
      ...entry,
      id: draft.nextEntryId++,
      personId,
      foodId,
      ...(tennisDietId ? { tennisDietId } : {}),
    });
    entryKeys.add(key);
    entriesImported += 1;
  }

  const heightKeys = new Set(draft.heightRecords.map(record => `${record.personId}:${record.date}`));
  let heightRecordsImported = 0;
  for (const record of incoming.heightRecords) {
    const personId = personIds.get(record.personId);
    if (personId === undefined) fail('Planner file references a missing person.');
    const key = `${personId}:${record.date}`;
    if (heightKeys.has(key)) continue;
    draft.heightRecords.push({ ...record, id: draft.nextHeightRecordId++, personId });
    heightKeys.add(key);
    heightRecordsImported += 1;
  }

  const weightKeys = new Set(draft.weightRecords.map(record => `${record.personId}:${record.date}`));
  let weightRecordsImported = 0;
  for (const record of incoming.weightRecords) {
    const personId = personIds.get(record.personId);
    if (personId === undefined) fail('Planner file references a missing person.');
    const key = `${personId}:${record.date}`;
    if (weightKeys.has(key)) continue;
    draft.weightRecords.push({ ...record, id: draft.nextWeightRecordId++, personId });
    weightKeys.add(key);
    weightRecordsImported += 1;
  }

  return {
    foodsImported,
    entriesImported,
    activitiesImported,
    heightRecordsImported,
    weightRecordsImported,
  };
}
function estimateRecordImport(incoming: number, toAdd: number): ImportRecordEstimate {
  return { incoming, toAdd, toSkip: incoming - toAdd };
}
function estimatePersonPlannerRecords(
  current: StoreData,
  incoming: StoreData,
  sourcePersonId: number,
  targetPersonId: number,
): Omit<PersonPlannerRestoreEstimate, 'destination' | 'targetPerson'> {
  const scopedIncoming: StoreData = {
    ...incoming,
    entries: incoming.entries.filter(entry => entry.personId === sourcePersonId),
    activities: incoming.activities.filter(activity => activity.personId === sourcePersonId),
    heightRecords: incoming.heightRecords.filter(record => record.personId === sourcePersonId),
    weightRecords: incoming.weightRecords.filter(record => record.personId === sourcePersonId),
  };
  const counts = mergePlannerRecords(
    clone(current),
    scopedIncoming,
    new Map([[sourcePersonId, targetPersonId]]),
  );
  return {
    entries: estimateRecordImport(scopedIncoming.entries.length, counts.entriesImported),
    activities: estimateRecordImport(scopedIncoming.activities.length, counts.activitiesImported),
    heightRecords: estimateRecordImport(scopedIncoming.heightRecords.length, counts.heightRecordsImported),
    weightRecords: estimateRecordImport(scopedIncoming.weightRecords.length, counts.weightRecordsImported),
  };
}
function validateImportedPerson(source: Person, name: string): Omit<Person, 'id' | 'isDefault' | 'backupIds'> {
  return validatePersonInput({
    name,
    weightKg: source.weightKg,
    targetWeightKg: source.targetWeightKg,
    dateOfBirth: source.dateOfBirth,
    growthReferenceSex: source.growthReferenceSex,
    nutritionGoal: source.nutritionGoal,
    ironGoalMg: source.ironGoalMg,
    ironGoalSource: source.ironGoalSource,
    ironGoalReviewedOn: source.ironGoalReviewedOn,
    fatGoalG: source.fatGoalG,
    fatGoalSource: source.fatGoalSource,
    fatGoalReviewedOn: source.fatGoalReviewedOn,
    activityLevel: source.activityLevel,
    baselineCalories: source.baselineCalories,
  });
}
function suggestUniquePersonName(name: string, people: readonly Pick<Person, 'name'>[]): string {
  const existingNames = new Set(people.map(person => person.name.trim().toLocaleLowerCase()));
  const normalized = name.trim();
  if (!existingNames.has(normalized.toLocaleLowerCase())) return normalized;
  for (let index = 1; index < 10_000; index += 1) {
    const suffix = index === 1 ? ' (Imported)' : ` (Imported ${index})`;
    let base = normalized.slice(0, 80 - suffix.length).trimEnd();
    const lastCodeUnit = base.charCodeAt(base.length - 1);
    if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) base = base.slice(0, -1);
    const candidate = `${base}${suffix}`;
    if (!existingNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return fail('Could not suggest a unique name for the imported person.');
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
function validatePersonInput(input: PersonInput | PersonUpdate, existing?: Person): Omit<Person, 'id' | 'isDefault' | 'backupIds'> {
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
  if (result.targetWeightKg !== null && result.targetWeightKg !== undefined &&
    !isFiniteInRange(result.targetWeightKg, 1, 500)) {
    fail('Target weight must be between 1 and 500 kg, or left blank.');
  }
  if (result.dateOfBirth !== null && result.dateOfBirth !== undefined) {
    if (typeof result.dateOfBirth !== 'string' || !isValidCalendarDate(result.dateOfBirth)) {
      fail('Enter a valid date of birth.');
    }
    if (result.dateOfBirth > todayDate()) fail('Date of birth cannot be in the future.');
  }
  const dateOfBirth = result.dateOfBirth ?? null;
  const ageYears = dateOfBirth === null ? null : getAgeOnDate(dateOfBirth, todayDate());
  if (dateOfBirth !== null && ageYears === null) fail('Enter a valid date of birth that is not in the future.');
  if (result.growthReferenceSex !== null && result.growthReferenceSex !== undefined &&
    result.growthReferenceSex !== 'male' && result.growthReferenceSex !== 'female') {
    fail('Choose a valid growth reference sex.');
  }
  const nutritionGoal = result.nutritionGoal ?? null;
  if (nutritionGoal !== null && !NUTRITION_GOALS.includes(nutritionGoal as NutritionGoalType)) {
    fail('Choose a valid nutrition goal.');
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
    targetWeightKg: normalized.targetWeightKg as number | null ?? null,
    ageYears,
    dateOfBirth,
    growthReferenceSex: normalized.growthReferenceSex as Person['growthReferenceSex'] ?? null,
    nutritionGoal: nutritionGoal as NutritionGoalType | null,
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
  const ingredients = result.ingredients === undefined ? [] : result.ingredients;
  if (!isFoodIngredientList(ingredients)) {
    fail('Ingredient details are invalid. Check each ingredient and try again.');
  }
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
    ...(ingredients.length > 0 ? { ingredients: clone(ingredients) } : {}),
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
      if (isRecord(parsed) && parsed.version === 2) {
        const migrated = migrateVersionTwo(parsed);
        try {
          await storage.setItem(storageKey, JSON.stringify(migrated));
        } catch (error) {
          throw new Error(`Could not migrate local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = migrated;
        return migrated;
      }
      if (isRecord(parsed) && parsed.version === 3) {
        const migrated = migrateVersionThree(parsed);
        try {
          await storage.setItem(storageKey, JSON.stringify(migrated));
        } catch (error) {
          throw new Error(`Could not migrate local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = migrated;
        return migrated;
      }
      if (isRecord(parsed) && parsed.version === 4) {
        const migrated = migrateVersionFour(parsed);
        try {
          await storage.setItem(storageKey, JSON.stringify(migrated));
        } catch (error) {
          throw new Error(`Could not migrate local planner data; the change was not applied: ${error instanceof Error ? error.message : String(error)}`);
        }
        data = migrated;
        return migrated;
      }
      if (isRecord(parsed) && parsed.version === 5) {
        const migrated = migrateVersionFive(parsed);
        try {
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
    async unlinkPersonBackupIdentity(personId: number, backupId: string): Promise<Person> {
      return transact(draft => {
        const person = findPerson(draft, personId);
        if (!isBackupId(backupId)) fail('Choose a valid imported backup identity.');
        if (person.backupIds[0] === backupId) {
          fail('The profile’s original backup identity cannot be removed.');
        }
        const identityIndex = person.backupIds.indexOf(backupId);
        if (identityIndex < 1) fail('This imported backup identity is no longer linked to this profile.');
        person.backupIds.splice(identityIndex, 1);
        return person;
      });
    },
    async reassignPersonBackupIdentity(
      sourcePersonId: number,
      backupId: string,
      targetPersonId: number,
    ): Promise<{ sourcePerson: Person; targetPerson: Person }> {
      return transact(draft => {
        const sourcePerson = findPerson(draft, sourcePersonId);
        const targetPerson = findPerson(draft, targetPersonId);
        if (sourcePerson.id === targetPerson.id) fail('Choose a different profile for this backup identity.');
        if (!isBackupId(backupId)) fail('Choose a valid imported backup identity.');
        if (sourcePerson.backupIds[0] === backupId) {
          fail('The profile’s original backup identity cannot be moved.');
        }
        const identityIndex = sourcePerson.backupIds.indexOf(backupId);
        if (identityIndex < 1) fail('This imported backup identity is no longer linked to this profile.');
        if (targetPerson.backupIds.includes(backupId)) {
          fail('This backup identity is already linked to the selected profile.');
        }
        sourcePerson.backupIds.splice(identityIndex, 1);
        targetPerson.backupIds.push(backupId);
        return { sourcePerson, targetPerson };
      });
    },
    async createPerson(input: PersonInput): Promise<Person> {
      return transact(draft => {
        const fields = validatePersonInput(input);
        if (draft.people.some(person => person.name.toLocaleLowerCase() === fields.name.toLocaleLowerCase())) {
          fail('That person is already in your planner.');
        }
        const existingBackupIds = new Set(draft.people.flatMap(person => person.backupIds));
        const person: Person = {
          id: draft.nextPersonId++,
          backupIds: [createBackupId(existingBackupIds)],
          isDefault: false,
          ...fields,
        };
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
        if (fields.dateOfBirth && draft.weightRecords.some(record =>
          record.personId === id && record.date < fields.dateOfBirth!)) {
          fail('Date of birth cannot be after an existing weight measurement.');
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
        draft.weightRecords = draft.weightRecords.filter(record => record.personId !== id);
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
    async listWeightRecords(params?: ListWeightRecordsParams): Promise<WeightRecord[]> {
      return read(current => {
        if (params?.personId !== undefined) {
          if (!Number.isSafeInteger(params.personId) || params.personId < 1) fail('Choose a valid person.');
          findPerson(current, params.personId);
        }
        return current.weightRecords
          .filter(record => params?.personId === undefined || record.personId === params.personId)
          .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
      });
    },
    async createWeightRecord(input: WeightRecordInput): Promise<WeightRecord> {
      return transact(draft => {
        if (!Number.isSafeInteger(input.personId) || input.personId < 1) fail('Choose a valid person.');
        const person = findPerson(draft, input.personId);
        if (!isValidCalendarDate(input.date)) fail('Enter a valid weight measurement date.');
        if (input.date > todayDate()) fail('Weight measurement date cannot be in the future.');
        if (person.dateOfBirth && input.date < person.dateOfBirth) {
          fail('Weight measurement date cannot be before the person’s date of birth.');
        }
        if (!isFiniteInRange(input.weightKg, 1, 500)) fail('Weight must be between 1 and 500 kg.');
        if (draft.weightRecords.some(record => record.personId === input.personId && record.date === input.date)) {
          fail('A weight record already exists for this person on that date. Edit the existing record instead.');
        }
        const record: StoredWeightRecord = {
          id: draft.nextWeightRecordId++,
          personId: input.personId,
          date: input.date,
          weightKg: input.weightKg,
        };
        draft.weightRecords.push(record);
        return record;
      });
    },
    async updateWeightRecord(id: number, input: WeightRecordUpdate): Promise<WeightRecord> {
      return transact(draft => {
        const record = draft.weightRecords.find(candidate => candidate.id === id);
        if (!record) fail('Weight record not found.');
        const person = findPerson(draft, record.personId);
        const date = input.date === undefined ? record.date : input.date;
        const weightKg = input.weightKg === undefined ? record.weightKg : input.weightKg;
        if (!isValidCalendarDate(date)) fail('Enter a valid weight measurement date.');
        if (date > todayDate()) fail('Weight measurement date cannot be in the future.');
        if (person.dateOfBirth && date < person.dateOfBirth) {
          fail('Weight measurement date cannot be before the person’s date of birth.');
        }
        if (!isFiniteInRange(weightKg, 1, 500)) fail('Weight must be between 1 and 500 kg.');
        if (draft.weightRecords.some(candidate =>
          candidate.id !== id && candidate.personId === record.personId && candidate.date === date)) {
          fail('A weight record already exists for this person on that date. Edit the existing record instead.');
        }
        record.date = date;
        record.weightKg = weightKg;
        return record;
      });
    },
    async deleteWeightRecord(id: number): Promise<void> {
      return transact(draft => {
        if (!draft.weightRecords.some(record => record.id === id)) fail('Weight record not found.');
        draft.weightRecords = draft.weightRecords.filter(record => record.id !== id);
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
        if (!food || food.source === 'reference') fail('Only custom or saved foods can be deleted.');
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
          { weightKg: person.weightKg, dateOfBirth: person.dateOfBirth },
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
    async exportFoodLibrary(): Promise<string> {
      const pending = writeQueue.then(async () => {
        const current = await load();
        const envelope: FoodLibraryEnvelope = {
          format: 'clear-access-food-library',
          version: 1,
          exportedAt: new Date().toISOString(),
          foods: current.foods
            .map(publicFood)
            .sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id),
        };
        const serialized = JSON.stringify(envelope, null, 2);
        parseFoodLibrary(serialized);
        return serialized;
      });
      writeQueue = pending.then(() => undefined, () => undefined);
      return pending;
    },
    async previewFoodLibraryImport(serialized: string): Promise<FoodLibraryImportPreview> {
      const incoming = parseFoodLibrary(serialized);
      await writeQueue;
      const current = await load();
      const fingerprints = new Set(current.foods.map(food => foodFingerprint(publicFood(food))));
      let duplicateCount = 0;
      let newCount = 0;
      for (const food of incoming.foods) {
        const fingerprint = foodFingerprint(food);
        if (fingerprints.has(fingerprint)) {
          duplicateCount += 1;
        } else {
          newCount += 1;
          fingerprints.add(fingerprint);
        }
      }
      return {
        exportedAt: incoming.exportedAt,
        currentCount: current.foods.length,
        incomingCount: incoming.foods.length,
        newCount,
        duplicateCount,
      };
    },
    async importFoodLibrary(serialized: string): Promise<FoodLibraryImportResult> {
      const incoming = parseFoodLibrary(serialized);
      return transact(draft => {
        const fingerprints = new Set(draft.foods.map(food => foodFingerprint(publicFood(food))));
        let imported = 0;
        let skippedDuplicates = 0;
        for (const food of incoming.foods) {
          const fingerprint = foodFingerprint(food);
          if (fingerprints.has(fingerprint)) {
            skippedDuplicates += 1;
            continue;
          }
          draft.foods.push({ ...food, id: draft.nextFoodId++ });
          fingerprints.add(fingerprint);
          imported += 1;
        }
        return {
          incomingCount: incoming.foods.length,
          imported,
          skippedDuplicates,
        };
      });
    },
    async exportPersonPlanner(personId: number): Promise<string> {
      const pending = writeQueue.then(async () => {
        const current = await load();
        const person = findPerson(current, personId);
        const ownEntries = current.entries
          .filter(entry => entry.personId === person.id)
          .sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id);
        const usedFoodIds = new Set(ownEntries.map(entry => entry.foodId));
        const ownFoods = current.foods
          .filter(food => usedFoodIds.has(food.id))
          .sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
        const foodIds = new Map(ownFoods.map((food, index) => [food.id, index + 1]));
        const foods = ownFoods.map((food, index) => ({ ...food, id: index + 1 }));
        const entries: StoredEntry[] = ownEntries.map((entry, index) => {
          const foodId = foodIds.get(entry.foodId);
          if (!foodId) fail('Could not export a meal because its food record is missing.');
          return { ...entry, id: index + 1, personId: 1, foodId };
        });
        const activities = current.activities
          .filter(activity => activity.personId === person.id)
          .sort((left, right) => left.date.localeCompare(right.date))
          .map(activity => ({ ...activity, personId: 1 }));
        const heightRecords = current.heightRecords
          .filter(record => record.personId === person.id)
          .sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id)
          .map((record, index) => ({ ...record, id: index + 1, personId: 1 }));
        const weightRecords = current.weightRecords
          .filter(record => record.personId === person.id)
          .sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id)
          .map((record, index) => ({ ...record, id: index + 1, personId: 1 }));
        const data: StoreData = {
          version: STORE_VERSION,
          people: [{ ...person, id: 1, isDefault: true }],
          foods,
          entries,
          activities,
          heightRecords,
          weightRecords,
          nextPersonId: 2,
          nextFoodId: foods.length + 1,
          nextEntryId: entries.length + 1,
          nextHeightRecordId: heightRecords.length + 1,
          nextWeightRecordId: weightRecords.length + 1,
        };
        const envelope: PersonPlannerEnvelope = {
          format: 'clear-access-person-planner',
          version: 2,
          exportedAt: new Date().toISOString(),
          data,
        };
        const serialized = JSON.stringify(envelope, null, 2);
        parsePersonPlanner(serialized);
        return serialized;
      });
      writeQueue = pending.then(() => undefined, () => undefined);
      return pending;
    },
    async exportAllPeoplePlanner(): Promise<string> {
      const pending = writeQueue.then(async () => {
        const current = await load();
        const sourcePeople = [...current.people].sort((left, right) =>
          Number(right.isDefault) - Number(left.isDefault) || left.id - right.id);
        if (sourcePeople.length === 0) fail('There are no people to export.');
        const personIds = new Map(sourcePeople.map((person, index) => [person.id, index + 1]));
        const ownEntries = current.entries
          .filter(entry => personIds.has(entry.personId))
          .sort((left, right) =>
            left.personId - right.personId ||
            left.date.localeCompare(right.date) ||
            left.id - right.id);
        const usedFoodIds = new Set(ownEntries.map(entry => entry.foodId));
        const ownFoods = current.foods
          .filter(food => usedFoodIds.has(food.id))
          .sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
        const foodIds = new Map(ownFoods.map((food, index) => [food.id, index + 1]));
        const foods = ownFoods.map((food, index) => ({ ...food, id: index + 1 }));
        const entries: StoredEntry[] = ownEntries.map((entry, index) => {
          const personId = personIds.get(entry.personId);
          const foodId = foodIds.get(entry.foodId);
          if (personId === undefined) fail('Could not export a meal because its person record is missing.');
          if (foodId === undefined) fail('Could not export a meal because its food record is missing.');
          return { ...entry, id: index + 1, personId, foodId };
        });
        const activities = current.activities
          .filter(activity => personIds.has(activity.personId))
          .sort((left, right) =>
            left.personId - right.personId || left.date.localeCompare(right.date))
          .map(activity => {
            const personId = personIds.get(activity.personId);
            if (personId === undefined) fail('Could not export an activity because its person record is missing.');
            return { ...activity, personId };
          });
        const heightRecords = current.heightRecords
          .filter(record => personIds.has(record.personId))
          .sort((left, right) =>
            left.personId - right.personId ||
            left.date.localeCompare(right.date) ||
            left.id - right.id)
          .map((record, index) => {
            const personId = personIds.get(record.personId);
            if (personId === undefined) fail('Could not export a height record because its person record is missing.');
            return { ...record, id: index + 1, personId };
          });
        const weightRecords = current.weightRecords
          .filter(record => personIds.has(record.personId))
          .sort((left, right) =>
            left.personId - right.personId ||
            left.date.localeCompare(right.date) ||
            left.id - right.id)
          .map((record, index) => {
            const personId = personIds.get(record.personId);
            if (personId === undefined) fail('Could not export a weigh-in because its person record is missing.');
            return { ...record, id: index + 1, personId };
          });
        const data: StoreData = {
          version: STORE_VERSION,
          people: sourcePeople.map((person, index) => ({
            ...person,
            id: index + 1,
            isDefault: index === 0,
          })),
          foods,
          entries,
          activities,
          heightRecords,
          weightRecords,
          nextPersonId: sourcePeople.length + 1,
          nextFoodId: foods.length + 1,
          nextEntryId: entries.length + 1,
          nextHeightRecordId: heightRecords.length + 1,
          nextWeightRecordId: weightRecords.length + 1,
        };
        const envelope: AllPeoplePlannerEnvelope = {
          format: 'clear-access-all-people-planner',
          version: 2,
          exportedAt: new Date().toISOString(),
          data,
        };
        const serialized = JSON.stringify(envelope, null, 2);
        parseAllPeoplePlanner(serialized);
        return serialized;
      });
      writeQueue = pending.then(() => undefined, () => undefined);
      return pending;
    },
    async previewPersonPlannerImport(
      serialized: string,
      targetPersonId?: number | null,
    ): Promise<PersonPlannerImportPreview> {
      const incoming = parsePersonPlanner(serialized);
      await writeQueue;
      const current = await load();
      const person = incoming.data.people[0];
      const matchedPerson = incoming.envelope.version === 2
        ? findPersonByBackupIds(current.people, person.backupIds)
        : undefined;
      const requestedTargetId = targetPersonId ?? undefined;
      if (matchedPerson && requestedTargetId !== undefined && matchedPerson.id !== requestedTargetId) {
        fail('This backup ID already matches a different person on this device.');
      }
      const target = requestedTargetId === undefined
        ? matchedPerson
        : findPerson(current, requestedTargetId);
      const sameNamePerson = matchedPerson ? undefined : current.people.find(candidate =>
        candidate.name.trim().toLocaleLowerCase() === person.name.trim().toLocaleLowerCase());
      const targetId = target?.id ?? current.nextPersonId;
      const counts = mergePlannerRecords(
        clone(current),
        incoming.data,
        new Map([[person.id, targetId]]),
      );
      return {
        exportedAt: incoming.envelope.exportedAt,
        personName: person.name,
        suggestedName: matchedPerson?.name ?? suggestUniquePersonName(person.name, current.people),
        nameConflict: Boolean(sameNamePerson),
        hasStableIdentity: incoming.envelope.version === 2,
        matchedPerson: matchedPerson ? { id: matchedPerson.id, name: matchedPerson.name } : null,
        sameNamePerson: sameNamePerson ? { id: sameNamePerson.id, name: sameNamePerson.name } : null,
        foods: incoming.data.foods.length,
        entries: incoming.data.entries.length,
        activities: incoming.data.activities.length,
        heightRecords: incoming.data.heightRecords.length,
        weightRecords: incoming.data.weightRecords.length,
        estimate: {
          destination: target ? 'existing' : 'new',
          targetPerson: target ? { id: target.id, name: target.name } : null,
          foods: estimateRecordImport(incoming.data.foods.length, counts.foodsImported),
          entries: estimateRecordImport(incoming.data.entries.length, counts.entriesImported),
          activities: estimateRecordImport(incoming.data.activities.length, counts.activitiesImported),
          heightRecords: estimateRecordImport(incoming.data.heightRecords.length, counts.heightRecordsImported),
          weightRecords: estimateRecordImport(incoming.data.weightRecords.length, counts.weightRecordsImported),
        },
      };
    },
    async previewAllPeoplePlannerImport(
      serialized: string,
      importedNames?: string[],
      targetPersonIds?: Array<number | null>,
    ): Promise<AllPeoplePlannerImportPreview> {
      const incoming = parseAllPeoplePlanner(serialized);
      if (importedNames && importedNames.length !== incoming.data.people.length) {
        fail('Choose a name for every imported person.');
      }
      if (targetPersonIds && targetPersonIds.length !== incoming.data.people.length) {
        fail('Choose a restore destination for every imported person.');
      }
      await writeQueue;
      const current = await load();
      const simulation = clone(current);
      const usedTargetIds = new Set<number>();
      const personIds = new Map<number, number>();
      const people = incoming.data.people.map((person, index) => {
        const matchedPerson = incoming.envelope.version === 2
          ? findPersonByBackupIds(current.people, person.backupIds)
          : undefined;
        const suggestedName = matchedPerson?.name ?? suggestUniquePersonName(person.name, simulation.people);
        const requestedTargetId = targetPersonIds?.[index] ?? undefined;
        if (matchedPerson && requestedTargetId !== undefined && matchedPerson.id !== requestedTargetId) {
          fail('This backup ID already matches a different person on this device.');
        }
        const existingPerson = requestedTargetId === undefined
          ? matchedPerson
          : findPerson(simulation, requestedTargetId);
        let targetPerson: Person;
        let destination: 'new' | 'existing';
        if (existingPerson) {
          if (usedTargetIds.has(existingPerson.id)) {
            fail('Two imported profiles cannot be restored into the same person.');
          }
          usedTargetIds.add(existingPerson.id);
          targetPerson = existingPerson;
          destination = 'existing';
        } else {
          const importedName = importedNames?.[index] ?? suggestedName;
          const personFields = validateImportedPerson(person, importedName);
          if (simulation.people.some(candidate =>
            candidate.name.trim().toLocaleLowerCase() === personFields.name.trim().toLocaleLowerCase())) {
            fail('An imported profile name already exists. Choose that person or use a different name.');
          }
          const existingBackupIds = new Set(simulation.people.flatMap(candidate => candidate.backupIds));
          targetPerson = {
            id: simulation.nextPersonId++,
            backupIds: incoming.envelope.version === 2
              ? [...person.backupIds]
              : [createBackupId(existingBackupIds)],
            isDefault: false,
            ...personFields,
          };
          simulation.people.push(targetPerson);
          destination = 'new';
        }
        personIds.set(person.id, targetPerson.id);
        const sameNamePerson = matchedPerson ? undefined : current.people.find(candidate =>
          candidate.name.trim().toLocaleLowerCase() === person.name.trim().toLocaleLowerCase());
        return {
          personName: person.name,
          suggestedName,
          nameConflict: Boolean(sameNamePerson),
          hasStableIdentity: incoming.envelope.version === 2,
          matchedPerson: matchedPerson ? { id: matchedPerson.id, name: matchedPerson.name } : null,
          sameNamePerson: sameNamePerson ? { id: sameNamePerson.id, name: sameNamePerson.name } : null,
          entries: incoming.data.entries.filter(entry => entry.personId === person.id).length,
          activities: incoming.data.activities.filter(activity => activity.personId === person.id).length,
          heightRecords: incoming.data.heightRecords.filter(record => record.personId === person.id).length,
          weightRecords: incoming.data.weightRecords.filter(record => record.personId === person.id).length,
          estimate: {
            destination,
            targetPerson: destination === 'existing'
              ? { id: targetPerson.id, name: targetPerson.name }
              : null,
            ...estimatePersonPlannerRecords(current, incoming.data, person.id, targetPerson.id),
          },
        };
      });
      const counts = mergePlannerRecords(simulation, incoming.data, personIds);
      return {
        exportedAt: incoming.envelope.exportedAt,
        people,
        foods: incoming.data.foods.length,
        estimate: {
          newProfiles: people.filter(person => person.estimate.destination === 'new').length,
          matchedProfiles: people.filter(person => person.estimate.destination === 'existing').length,
          foods: estimateRecordImport(incoming.data.foods.length, counts.foodsImported),
          entries: estimateRecordImport(incoming.data.entries.length, counts.entriesImported),
          activities: estimateRecordImport(incoming.data.activities.length, counts.activitiesImported),
          heightRecords: estimateRecordImport(incoming.data.heightRecords.length, counts.heightRecordsImported),
          weightRecords: estimateRecordImport(incoming.data.weightRecords.length, counts.weightRecordsImported),
        },
      };
    },
    async importPersonPlanner(
      serialized: string,
      importedName: string,
      targetPersonId?: number,
    ): Promise<PersonPlannerImportResult> {
      const parsed = parsePersonPlanner(serialized);
      const incoming = parsed.data;
      const sourcePerson = incoming.people[0];
      const hasStableIdentity = parsed.envelope.version === 2;
      return transact(draft => {
        const identityMatch = hasStableIdentity
          ? findPersonByBackupIds(draft.people, sourcePerson.backupIds)
          : undefined;
        const existingPerson = targetPersonId === undefined
          ? identityMatch
          : findPerson(draft, targetPersonId);
        if (identityMatch && existingPerson && identityMatch.id !== existingPerson.id) {
          fail('This backup ID already matches a different person on this device.');
        }

        let person: Person;
        if (existingPerson) {
          person = existingPerson;
          if (hasStableIdentity) mergeBackupIds(person, sourcePerson, draft.people);
        } else {
          const personFields = validateImportedPerson(sourcePerson, importedName);
          if (draft.people.some(candidate =>
            candidate.name.trim().toLocaleLowerCase() === personFields.name.trim().toLocaleLowerCase())) {
            fail('A person with this name already exists. Choose that person or use a different name.');
          }
          const existingBackupIds = new Set(draft.people.flatMap(candidate => candidate.backupIds));
          person = {
            id: draft.nextPersonId++,
            backupIds: hasStableIdentity ? [...sourcePerson.backupIds] : [createBackupId(existingBackupIds)],
            isDefault: false,
            ...personFields,
          };
          draft.people.push(person);
        }

        const counts = mergePlannerRecords(
          draft,
          incoming,
          new Map([[sourcePerson.id, person.id]]),
        );
        return {
          person,
          matchedExisting: Boolean(existingPerson),
          ...counts,
        };
      });
    },
    async importAllPeoplePlanner(
      serialized: string,
      importedNames?: string[],
      targetPersonIds?: Array<number | null>,
    ): Promise<AllPeoplePlannerImportResult> {
      const parsed = parseAllPeoplePlanner(serialized);
      const incoming = parsed.data;
      const hasStableIdentity = parsed.envelope.version === 2;
      if (importedNames && importedNames.length !== incoming.people.length) {
        fail('Choose a name for every imported person.');
      }
      if (targetPersonIds && targetPersonIds.length !== incoming.people.length) {
        fail('Choose a restore destination for every imported person.');
      }
      return transact(draft => {
        const importedPeople: Person[] = [];
        const matchedPeople: Person[] = [];
        const personIds = new Map<number, number>();
        const usedTargetIds = new Set<number>();
        for (let index = 0; index < incoming.people.length; index += 1) {
          const sourcePerson = incoming.people[index];
          const identityMatch = hasStableIdentity
            ? findPersonByBackupIds(draft.people, sourcePerson.backupIds)
            : undefined;
          const requestedTargetId = targetPersonIds?.[index] ?? undefined;
          if (identityMatch && requestedTargetId !== undefined && identityMatch.id !== requestedTargetId) {
            fail('This backup ID already matches a different person on this device.');
          }
          const existingPerson = requestedTargetId === undefined
            ? identityMatch
            : findPerson(draft, requestedTargetId);
          let person: Person;
          if (existingPerson) {
            if (usedTargetIds.has(existingPerson.id)) {
              fail('Two imported profiles cannot be restored into the same person.');
            }
            usedTargetIds.add(existingPerson.id);
            if (hasStableIdentity) mergeBackupIds(existingPerson, sourcePerson, draft.people);
            person = existingPerson;
            matchedPeople.push(person);
          } else {
            const importedName = importedNames?.[index] ??
              suggestUniquePersonName(sourcePerson.name, draft.people);
            const personFields = validateImportedPerson(sourcePerson, importedName);
            if (draft.people.some(candidate =>
              candidate.name.trim().toLocaleLowerCase() === personFields.name.trim().toLocaleLowerCase())) {
              fail('An imported profile name already exists. Choose that person or use a different name.');
            }
            const existingBackupIds = new Set(draft.people.flatMap(candidate => candidate.backupIds));
            person = {
              id: draft.nextPersonId++,
              backupIds: hasStableIdentity ? [...sourcePerson.backupIds] : [createBackupId(existingBackupIds)],
              isDefault: false,
              ...personFields,
            };
            draft.people.push(person);
            importedPeople.push(person);
          }
          personIds.set(sourcePerson.id, person.id);
        }

        const counts = mergePlannerRecords(draft, incoming, personIds);
        return {
          people: importedPeople,
          matchedPeople,
          ...counts,
        };
      });
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
        const activityProblem = tennisActivityPlanProblem(input.activityType, found?.tennis);
        if (activityProblem) fail(activityProblem);
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
        let activity = draft.activities.find(item => item.date === input.date && item.personId === input.personId);
        if (input.plan !== null) {
          const problem = tennisPlanProblem(input.plan);
          if (problem) fail(problem);
          const activityProblem = tennisActivityPlanProblem(activity?.activityType ?? 'rest', input.plan);
          if (activityProblem) fail(activityProblem);
        }
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
        const targetEntries = draft.entries.filter(entry => entry.personId === targetPerson.id && entry.date === input.targetDate);
        if (input.expectedTarget !== getTennisFoodDestinationFingerprint(
          target, targetEntries.map(entry => toMealEntry(draft, entry)), targetPerson.name,
        )) fail('The destination changed since review. Nothing was changed; refresh and review again.');
        const destinationDiets = target?.tennis?.diets ?? [];
        const merge = input.mergeExisting === true;
        if (merge && sourcePerson.id === targetPerson.id) fail('Merging is only available when copying to another person. Use the same-person copy flow for another date.');
        if (merge && !destinationDiets.length) fail('The destination timetable changed or no longer has slots. Refresh and review the copy again.');
        if (!merge && destinationDiets.length) fail('The destination already has a tennis food timetable. Choose another date or explicitly review a merge; nothing was overwritten.');
        const importRefs: TennisFoodImportRef[] = source.diets.map(slot => ({
          sourcePersonBackupId: sourcePerson.backupIds[0],
          sourceDate: input.sourceDate,
          sourceDietId: slot.id,
        }));
        const priorImports = new Set((target?.tennisFoodImports ?? []).map(getTennisFoodImportKey));
        if (importRefs.some(ref => priorImports.has(getTennisFoodImportKey(ref)))) {
          fail('This source timetable has already been imported to this day. Nothing was changed.');
        }
        // No replacement or deletion: ordinary meals and all destination preferences survive.
        if (!target) {
          target = { date: input.targetDate, personId: targetPerson.id, activityType: 'rest' };
          draft.activities.push(target);
        }
        const slotMap = merge ? mapTennisFoodSlots(source.diets, destinationDiets) :
          source.diets.map(slot => ({ sourceId: slot.id, targetId: null }));
        const idMap = new Map<string, string>();
        const used = new Set(draft.activities.flatMap(day => day.tennis?.diets?.map(slot => slot.id) ?? []));
        const copyId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        let sequence = 0;
        const addedDiets = source.diets.flatMap(slot => {
          const mappedId = slotMap.find(mapping => mapping.sourceId === slot.id)?.targetId;
          if (mappedId) {
            idMap.set(slot.id, mappedId);
            return [];
          }
          let id: string;
          do { id = `diet-copy-${copyId}-${(sequence++).toString(36)}`; } while (used.has(id));
          used.add(id); idMap.set(slot.id, id);
          return [{ ...slot, id }];
        });
        // Existing practice/match sessions are independent of imported food times.
        const mappedSlots = slotMap.filter(mapping => mapping.targetId !== null).length;
        if (target.tennis) target.tennis = { ...target.tennis, diets: [...(target.tennis.diets ?? []), ...addedDiets] };
        // A food-only container has no sessions. Active modes require sessions,
        // so use Rest without changing the separate destination activity.
        else target.tennis = {
          ...emptyTennisPlan('rest'), diets: addedDiets,
        };
        target.tennisFoodImports = [...(target.tennisFoodImports ?? []), ...importRefs];
        if (!merge && entries.length && !target.mealTimes) target.mealTimes = getMealTimes();
        for (const entry of entries) {
          draft.entries.push({
            id: draft.nextEntryId++, personId: targetPerson.id, date: input.targetDate,
            meal: entry.meal, grams: entry.grams, foodId: entry.foodId,
            tennisDietId: idMap.get(entry.tennisDietId!)!,
          });
        }
        return {
          personId: targetPerson.id, date: input.targetDate, copiedSlots: source.diets.length,
          copiedFoods: entries.length, matchedSlots: mappedSlots, addedSlots: addedDiets.length,
        };
      });
    },
    async exportForTests(): Promise<unknown> {
      return read(current => current);
    },
  };
}

export type BackupPreview = {
  createdAt: string;
  people: Array<{ id: number; name: string; entries: number; activities: number; heightRecords: number; weightRecords: number }>;
  foods: number;
  entries: number;
  activities: number;
  heightRecords: number;
  weightRecords: number;
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
      weightRecords: data.weightRecords.filter(record => record.personId === person.id).length,
    })),
    foods: data.foods.length,
    entries: data.entries.length,
    activities: data.activities.length,
    heightRecords: data.heightRecords.length,
    weightRecords: data.weightRecords.length,
  };
}

function isISODateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function parseFoodLibrary(serialized: string): FoodLibraryEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('Food library file is not valid JSON.');
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ['format', 'version', 'exportedAt', 'foods'])) {
    fail('Food library file has an invalid envelope.');
  }
  if (parsed.format !== 'clear-access-food-library' || parsed.version !== 1) {
    fail(`Unsupported food library format or version (${String(parsed.version)}).`);
  }
  if (!isISODateTime(parsed.exportedAt)) fail('Food library file has an invalid export timestamp.');
  if (!Array.isArray(parsed.foods) || parsed.foods.length > 50_000) {
    fail('Food library file has an invalid food list.');
  }

  const ids = new Set<number>();
  for (const food of parsed.foods) {
    if (!isRecord(food) || !hasExactKeys(food, [
      'id', 'name', 'category', 'source', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g',
      'fatPer100g', 'fiberPer100g', 'fiberKnown', 'calciumMgPer100g', 'ironMgPer100g',
    ], ['brand', 'sourceUrl', 'ingredients']) ||
      !Number.isSafeInteger(food.id) || (food.id as number) < 1 ||
      typeof food.name !== 'string' || !food.name.trim() || food.name.length > 120 ||
      (food.brand !== undefined && (typeof food.brand !== 'string' || food.brand.length > 160)) ||
      (food.sourceUrl !== undefined && (typeof food.sourceUrl !== 'string' || food.sourceUrl.length > 2048)) ||
      !CATEGORIES.includes(food.category as Food['category']) ||
      !['reference', 'custom', 'open_food_facts'].includes(String(food.source)) ||
      (food.ingredients !== undefined && (food.source !== 'custom' || !isFoodIngredientList(food.ingredients))) ||
      !isFiniteNumber(food.caloriesPer100g) ||
      !isFiniteNumber(food.proteinPer100g) ||
      !isFiniteNumber(food.carbsPer100g) ||
      !isFiniteNumber(food.fatPer100g) ||
      !isFiniteNumber(food.fiberPer100g) ||
      typeof food.fiberKnown !== 'boolean' ||
      !(food.calciumMgPer100g === null || isFiniteNumber(food.calciumMgPer100g)) ||
      !(food.ironMgPer100g === null || isFiniteNumber(food.ironMgPer100g)) ||
      ids.has(food.id as number)) {
      fail('Food library file contains an invalid food record.');
    }
    ids.add(food.id as number);
  }
  return parsed as unknown as FoodLibraryEnvelope;
}

function parsePersonPlanner(serialized: string): { envelope: PersonPlannerEnvelope; data: StoreData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('Person planner file is not valid JSON.');
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ['format', 'version', 'exportedAt', 'data'])) {
    fail('Person planner file has an invalid envelope.');
  }
  if (parsed.format !== 'clear-access-person-planner' || (parsed.version !== 1 && parsed.version !== 2)) {
    fail(`Unsupported person planner format or version (${String(parsed.version)}).`);
  }
  if (!isISODateTime(parsed.exportedAt)) fail('Person planner file has an invalid export timestamp.');
  const data = validateBackupData(parsed.data);
  if (data.people.length !== 1) fail('Person planner file must contain exactly one person.');
  return { envelope: parsed as unknown as PersonPlannerEnvelope, data };
}

function parseAllPeoplePlanner(serialized: string): { envelope: AllPeoplePlannerEnvelope; data: StoreData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('All-people planner file is not valid JSON.');
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ['format', 'version', 'exportedAt', 'data'])) {
    fail('All-people planner file has an invalid envelope.');
  }
  if (parsed.format !== 'clear-access-all-people-planner' || (parsed.version !== 1 && parsed.version !== 2)) {
    fail(`Unsupported all-people planner format or version (${String(parsed.version)}).`);
  }
  if (!isISODateTime(parsed.exportedAt)) fail('All-people planner file has an invalid export timestamp.');
  const data = validateBackupData(parsed.data);
  if (data.people.length === 0) fail('All-people planner file must contain at least one person.');
  return { envelope: parsed as unknown as AllPeoplePlannerEnvelope, data };
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
