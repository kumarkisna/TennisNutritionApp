export const ActivityLevel = {
  sedentary: 'sedentary',
  light: 'light',
  moderate: 'moderate',
  very_active: 'very_active',
} as const;
export type ActivityLevel = typeof ActivityLevel[keyof typeof ActivityLevel];

export const NutritionGoal = {
  weight_loss: 'weight_loss',
} as const;
export type NutritionGoal = typeof NutritionGoal[keyof typeof NutritionGoal];

export const FoodCategory = {
  grains: 'grains',
  protein: 'protein',
  vegetables: 'vegetables',
  fruit: 'fruit',
  dairy: 'dairy',
  other: 'other',
} as const;
export type FoodCategory = typeof FoodCategory[keyof typeof FoodCategory];

export const Meal = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
} as const;
export type Meal = typeof Meal[keyof typeof Meal];
export type MealType = Meal;

export const DayActivityType = {
  rest: 'rest',
  low_intensity: 'low_intensity',
  training_60: 'training_60',
  training_120: 'training_120',
  endurance: 'endurance',
  extreme: 'extreme',
  strength: 'strength',
  adolescent_athletes: 'adolescent_athletes',
} as const;
export type DayActivityType = typeof DayActivityType[keyof typeof DayActivityType];

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calciumMg: number | null;
  ironMg: number | null;
};

export type Person = {
  id: number;
  name: string;
  isDefault: boolean;
  weightKg: number | null;
  ageYears: number | null;
  dateOfBirth: string | null;
  growthReferenceSex: 'male' | 'female' | null;
  nutritionGoal: NutritionGoal | null;
  ironGoalMg: number | null;
  ironGoalSource: string | null;
  ironGoalReviewedOn: string | null;
  fatGoalG: number | null;
  fatGoalSource: string | null;
  fatGoalReviewedOn: string | null;
  activityLevel: ActivityLevel;
  baselineCalories: number;
  activityMultiplier: number;
  targetCalories: number;
};

export type PersonInput = {
  name: string;
  weightKg?: number | null;
  ageYears?: number | null;
  dateOfBirth?: string | null;
  growthReferenceSex?: 'male' | 'female' | null;
  nutritionGoal?: NutritionGoal | null;
  ironGoalMg?: number | null;
  ironGoalSource?: string | null;
  ironGoalReviewedOn?: string | null;
  fatGoalG?: number | null;
  fatGoalSource?: string | null;
  fatGoalReviewedOn?: string | null;
  activityLevel: ActivityLevel;
  baselineCalories: number;
};

export type PersonUpdate = Partial<PersonInput>;

export type HeightRecord = {
  id: number;
  personId: number;
  date: string;
  heightCm: number;
};
export type HeightRecordInput = {
  personId: number;
  date: string;
  heightCm: number;
};
export type HeightRecordUpdate = { date?: string; heightCm?: number };

export type Food = {
  id: number;
  name: string;
  brand?: string;
  sourceUrl?: string;
  category: FoodCategory;
  source: FoodSource;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  fiberKnown: boolean;
  calciumMgPer100g: number | null;
  ironMgPer100g: number | null;
};
export type FoodSource = 'reference' | 'custom' | 'open_food_facts';

export type FoodInput = {
  name: string;
  category: FoodCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  calciumMgPer100g?: number | null;
  ironMgPer100g?: number | null;
};
export type FoodUpdate = Partial<FoodInput>;

export type MealEntry = {
  id: number;
  date: string;
  personId: number;
  meal: Meal;
  grams: number;
  food: Food;
  nutrition: Nutrition;
  tennisDietId?: string;
};

export type MealEntryInput = {
  date: string;
  personId: number;
  meal: Meal;
  foodId: number;
  grams: number;
  tennisDietId?: string | null;
};
export type MealEntryUpdate = { meal?: Meal; grams?: number; tennisDietId?: string | null };

export type TennisSession = {
  kind: 'practice' | 'gym' | 'match';
  startTime: string;
  durationMinutes: number;
  intensity: 'light' | 'moderate' | 'hard';
};
export type TennisPlan = {
  mode: 'training' | 'tournament' | 'rest';
  sessions: TennisSession[];
  fuel: { before: string; during: string; between: string; after: string; hydration: string };
  diets?: TennisDiet[];
  experienceRating?: number;
};
export type TennisDiet = { id: string; phase: 'before' | 'during' | 'between' | 'after'; time: string };
export type TennisDietInput = { date: string; personId: number; id?: string; phase: TennisDiet['phase']; time: string };
export type TennisDietDeleteInput = { date: string; personId: number; id: string };
export type CopyTennisFoodPlanInput = {
  sourcePersonId: number; sourceDate: string;
  targetPersonId: number; targetDate: string;
  expectedSource: string; expectedTargetName: string;
};
export type CopyTennisFoodPlanResult = { personId: number; date: string; copiedSlots: number; copiedFoods: number };
export type TennisFoodPlanDate = { date: string; slots: number; foods: number };
export type TennisPlanInput = { date: string; personId: number; plan: TennisPlan | null };
export type TennisPlanRatingInput = { date: string; personId: number; rating: number | null };
export type TennisPlanHistoryItem = {
  date: string;
  rating: number | null;
  tennisDayType: TennisPlan['mode'];
  activityType: DayActivityType;
  sessions: number;
  slots: number;
  foods: number;
};
export type MealTimes = Record<Meal, string>;
export type MealTimeInput = { date: string; personId: number; meal: Meal; time: string };
export type MealAlert = { id: string; minutesBefore: number; enabled: boolean };
export type MealAlertInput = { date: string; personId: number; meal: Meal; alerts: MealAlert[] };
export type DayActivity = { date: string; personId: number; activityType: DayActivityType; tennis?: TennisPlan; mealTimes?: MealTimes; mealAlerts?: Partial<Record<Meal, MealAlert[]>> };
export type DayActivityInput = Omit<DayActivity, 'tennis' | 'mealTimes' | 'mealAlerts'>;

export type MealSummary = { meal: Meal; count: number; nutrition: Nutrition };
export type DailySummary = {
  date: string;
  personId: number;
  targetCalories: number | null;
  totals: Nutrition;
  entryCount: number;
  meals: MealSummary[];
};

export type Preferences = {
  activityLevel: ActivityLevel;
  baselineCalories: number;
  activityMultiplier: number;
  targetCalories: number;
};

export type ListFoodsParams = { search?: string };
export type ListHeightRecordsParams = { personId?: number };
export type DiscoverFoodsParams = { search: string };
export type ListMealEntriesParams = { date: string; personId: number };
export type GetDailySummaryParams = ListMealEntriesParams;
export type GetDayActivityParams = ListMealEntriesParams;
export type ImportFoodInput = { code: string };
export type PreferencesInput = { activityLevel: ActivityLevel; baselineCalories: number };
export type DiscoveredFood = {
  code: string;
  name: string;
  brand?: string;
  sourceUrl: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  fiberKnown: boolean;
  calciumMgPer100g: number | null;
  ironMgPer100g: number | null;
};