import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { createLocalStore } from './local-store';
import { createSleepMonthPreferences } from './sleep-month-preferences';
import { createSleepRoutinePreferences } from './sleep-routine-preferences';
import type {
  DailySummary,
  DayActivity,
  DayActivityInput,
  MealTimeInput,
  MealAlertInput,
  SleepLogInput,
  HydrationLogInput,
  TennisPlanInput,
  TennisPlanRatingInput,
  TennisPlanHistoryItem,
  TennisDietInput,
  TennisDietDeleteInput,
  CopyTennisFoodPlanInput,
  DiscoverFoodsParams,
  DiscoveredFood,
  Food,
  FoodIngredient,
  FoodInput,
  FoodSource,
  FoodUpdate,
  HeightRecord,
  HeightRecordInput,
  HeightRecordUpdate,
  WeightRecord,
  WeightRecordInput,
  WeightRecordUpdate,
  GetDayActivityParams,
  GetDailySummaryParams,
  ListFoodsParams,
  ListHeightRecordsParams,
  ListWeightRecordsParams,
  ListMealEntriesParams,
  MealEntry,
  MealEntryInput,
  MealEntryUpdate,
  MealPlanReview,
  MealPlanReviewInput,
  CopyMealsToDateInput,
  MealReuseUndoInput,
  ImportFoodInput,
  Person,
  PersonInput,
  PersonUpdate,
  PreferencesInput,
} from './local-models';

export {
  ActivityLevel,
  DayActivityType,
  FoodCategory,
  Meal,
} from './local-models';
export type {
  ActivityLevel as ActivityLevelType,
  DailySummary,
  DayActivity,
  DayActivityInput,
  MealTimes,
  MealTimeInput,
  MealAlert,
  SleepLog,
  MealAlertInput,
  TennisPlan,
  TennisSession,
  TennisPlanInput,
  TennisPlanRatingInput,
  TennisPlanHistoryItem,
  TennisDiet,
  TennisDietInput,
  TennisDietDeleteInput,
  CopyTennisFoodPlanInput,
  CopyTennisFoodPlanResult,
  TennisFoodPlanDate,
  DayActivityType as DayActivityKind,
  DiscoverFoodsParams,
  DiscoveredFood,
  Food,
  FoodIngredient,
  FoodCategory as FoodCategoryType,
  FoodInput,
  FoodSource,
  FoodUpdate,
  HeightRecord,
  HeightRecordInput,
  HeightRecordUpdate,
  WeightRecord,
  WeightRecordInput,
  WeightRecordUpdate,
  GetDayActivityParams,
  GetDailySummaryParams,
  ListFoodsParams,
  ListHeightRecordsParams,
  ListWeightRecordsParams,
  ListMealEntriesParams,
  MealEntry,
  MealEntryInput,
  MealEntryUpdate,
  MealPlanReview,
  MealPlanReviewInput,
  CopyMealsToDateInput,
  MealReuseUndoReceipt,
  MealSummary,
  MealType,
  Nutrition,
  Person,
  PersonInput,
  PersonUpdate,
  Preferences,
  PreferencesInput,
  ImportFoodInput,
} from './local-models';
export { createLocalStore, LOCAL_STORAGE_KEY, WEIGHT_RECORD_UNDO_WINDOW_MS, isValidCalendarDate } from './local-store';
export type {
  FoodLibraryImportPreview,
  FoodLibraryImportResult,
  AllPeoplePlannerImportPreview,
  AllPeoplePlannerImportResult,
  PersonPlannerImportPreview,
  PersonPlannerImportResult,
  DeletedWeightRecord,
} from './local-store';

export const localStore = createLocalStore(AsyncStorage);
export const sleepMonthPreferences = createSleepMonthPreferences(AsyncStorage);
export const sleepRoutinePreferences = createSleepRoutinePreferences(AsyncStorage);

export const exportLocalBackup = () => localStore.exportBackup();
export const exportLocalFoodLibrary = () => localStore.exportFoodLibrary();
export const previewLocalFoodImport = (serialized: string) => localStore.previewFoodLibraryImport(serialized);
export const importLocalFoodLibrary = (serialized: string) => localStore.importFoodLibrary(serialized);
export const exportLocalPersonPlanner = (personId: number) => localStore.exportPersonPlanner(personId);
export const previewLocalPersonPlannerImport = (
  serialized: string,
  targetPersonId?: number | null,
) => localStore.previewPersonPlannerImport(serialized, targetPersonId);
export const importLocalPersonPlanner = (serialized: string, name: string, targetPersonId?: number) =>
  localStore.importPersonPlanner(serialized, name, targetPersonId);
export const exportLocalAllPeoplePlanner = () => localStore.exportAllPeoplePlanner();
export const previewLocalAllPeoplePlannerImport = (
  serialized: string,
  importedNames?: string[],
  targetPersonIds?: Array<number | null>,
) => localStore.previewAllPeoplePlannerImport(serialized, importedNames, targetPersonIds);
export const importLocalAllPeoplePlanner = (
  serialized: string,
  names?: string[],
  targetPersonIds?: Array<number | null>,
) => localStore.importAllPeoplePlanner(serialized, names, targetPersonIds);
export const getListPeopleQueryKey = () => ['listPeople'] as const;
export const getListFoodsQueryKey = (params?: ListFoodsParams) => ['listFoods', params] as const;
export const getListHeightRecordsQueryKey = (params?: ListHeightRecordsParams) => ['listHeightRecords', params] as const;
export const getListWeightRecordsQueryKey = (params?: ListWeightRecordsParams) => ['listWeightRecords', params] as const;
export const getListMealEntriesQueryKey = (params?: ListMealEntriesParams) => ['listMealEntries', params] as const;
export const getGetDailySummaryQueryKey = (params?: GetDailySummaryParams) => ['getDailySummary', params] as const;
export const getGetDayActivityQueryKey = (params?: GetDayActivityParams) => ['getDayActivity', params] as const;
export const getDiscoverFoodsQueryKey = (params?: { search: string }) => ['discoverFoods', params] as const;

type LocalQueryOptions<T> = {
  query?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'> & { queryKey?: QueryKey };
};

function useLocalQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>, options?: LocalQueryOptions<T>) {
  const queryOptions = options?.query;
  return useQuery<T, Error, T, QueryKey>({
    ...queryOptions,
    // These queries read the device, not a server. Never pause them offline.
    networkMode: 'always',
    queryKey: queryOptions?.queryKey ?? queryKey,
    queryFn,
  });
}

function useLocalMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidatePrefixes: QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    networkMode: 'always',
    mutationFn,
    onSuccess: async () => {
      await Promise.all(invalidatePrefixes.map(queryKey =>
        queryClient.invalidateQueries({ queryKey }),
      ));
      await queryClient.invalidateQueries({ queryKey: ['getMealReminderSource'] });
      await queryClient.invalidateQueries({ queryKey: ['listTennisFoodPlanDates'] });
      await queryClient.invalidateQueries({ queryKey: ['listTennisPlanHistory'] });
    },
  });
}

const PEOPLE_REFRESH = [
  getListPeopleQueryKey(),
  ['listHeightRecords'],
  ['listWeightRecords'],
  ['listMealEntries'],
  ['getDailySummary'],
  ['getDayActivity'],
];
const FOODS_REFRESH = [
  ['listFoods'],
  ['listMealEntries'],
  ['getDailySummary'],
];
const ENTRIES_REFRESH = [['listMealEntries'], ['getDailySummary']];
const HEIGHT_RECORDS_REFRESH = [['listHeightRecords']];
const WEIGHT_RECORDS_REFRESH = [['listWeightRecords']];

export function useListPeople(options?: LocalQueryOptions<Person[]>) {
  return useLocalQuery(getListPeopleQueryKey(), () => localStore.listPeople(), options);
}
export function useCreatePerson() {
  return useLocalMutation(({ data }: { data: PersonInput }) => localStore.createPerson(data), PEOPLE_REFRESH);
}
export function useUpdatePerson() {
  return useLocalMutation(({ id, data }: { id: number; data: PersonUpdate }) => localStore.updatePerson(id, data), PEOPLE_REFRESH);
}
export function useDeletePerson() {
  return useLocalMutation(({ id }: { id: number }) => localStore.deletePerson(id), PEOPLE_REFRESH);
}
export function useUnlinkPersonBackupIdentity() {
  return useLocalMutation(
    ({ personId, backupId }: { personId: number; backupId: string }) =>
      localStore.unlinkPersonBackupIdentity(personId, backupId),
    PEOPLE_REFRESH,
  );
}
export function useReassignPersonBackupIdentity() {
  return useLocalMutation(
    ({ sourcePersonId, backupId, targetPersonId }: {
      sourcePersonId: number;
      backupId: string;
      targetPersonId: number;
    }) => localStore.reassignPersonBackupIdentity(sourcePersonId, backupId, targetPersonId),
    PEOPLE_REFRESH,
  );
}

export function useListHeightRecords(params: ListHeightRecordsParams & { personId: number }, options?: LocalQueryOptions<HeightRecord[]>) {
  return useLocalQuery(getListHeightRecordsQueryKey(params), () => localStore.listHeightRecords(params), options);
}
export function useCreateHeightRecord() {
  return useLocalMutation(({ data }: { data: HeightRecordInput }) => localStore.createHeightRecord(data), HEIGHT_RECORDS_REFRESH);
}
export function useUpdateHeightRecord() {
  return useLocalMutation(({ id, data }: { id: number; data: HeightRecordUpdate }) =>
    localStore.updateHeightRecord(id, data), HEIGHT_RECORDS_REFRESH);
}
export function useDeleteHeightRecord() {
  return useLocalMutation(({ id }: { id: number }) => localStore.deleteHeightRecord(id), HEIGHT_RECORDS_REFRESH);
}

export function useListWeightRecords(params: ListWeightRecordsParams & { personId: number }, options?: LocalQueryOptions<WeightRecord[]>) {
  return useLocalQuery(getListWeightRecordsQueryKey(params), () => localStore.listWeightRecords(params), options);
}
export function useCreateWeightRecord() {
  return useLocalMutation(({ data }: { data: WeightRecordInput }) => localStore.createWeightRecord(data), WEIGHT_RECORDS_REFRESH);
}
export function useUpdateWeightRecord() {
  return useLocalMutation(({ id, data }: { id: number; data: WeightRecordUpdate }) =>
    localStore.updateWeightRecord(id, data), WEIGHT_RECORDS_REFRESH);
}
export function useDeleteWeightRecord() {
  return useLocalMutation(({ id, personId }: { id: number; personId: number }) =>
    localStore.deleteWeightRecord(id, personId), WEIGHT_RECORDS_REFRESH);
}
export function useUndoDeleteWeightRecord() {
  return useLocalMutation(({ token, personId }: { token: string; personId: number }) =>
    localStore.undoDeleteWeightRecord(token, personId), WEIGHT_RECORDS_REFRESH);
}

export function useListFoods(params?: ListFoodsParams, options?: LocalQueryOptions<Food[]>) {
  return useLocalQuery(getListFoodsQueryKey(params), () => localStore.listFoods(params), options);
}
export function useCreateFood() {
  return useLocalMutation(({ data }: { data: FoodInput }) => localStore.createFood(data), FOODS_REFRESH);
}
export function useUpdateFood() {
  return useLocalMutation(({ id, data }: { id: number; data: FoodUpdate }) => localStore.updateFood(id, data), FOODS_REFRESH);
}
export function useDeleteFood() {
  return useLocalMutation(({ id }: { id: number }) => localStore.deleteFood(id), FOODS_REFRESH);
}

export function useListMealEntries(params: ListMealEntriesParams, options?: LocalQueryOptions<MealEntry[]>) {
  return useLocalQuery(getListMealEntriesQueryKey(params), () => localStore.listMealEntries(params), options);
}
export function useCreateMealEntry() {
  return useLocalMutation(({ data }: { data: MealEntryInput }) => localStore.createMealEntry(data), ENTRIES_REFRESH);
}
export function useUpdateMealEntry() {
  return useLocalMutation(({ id, data }: { id: number; data: MealEntryUpdate }) => localStore.updateMealEntry(id, data), ENTRIES_REFRESH);
}
export function useDeleteMealEntry() {
  return useLocalMutation(({ id }: { id: number }) => localStore.deleteMealEntry(id), ENTRIES_REFRESH);
}

export function useGetDailySummary(params: GetDailySummaryParams, options?: LocalQueryOptions<DailySummary>) {
  return useLocalQuery(getGetDailySummaryQueryKey(params), () => localStore.getDailySummary(params), options);
}
export function useGetDayActivity(params: GetDayActivityParams, options?: LocalQueryOptions<DayActivity>) {
  return useLocalQuery(getGetDayActivityQueryKey(params), () => localStore.getDayActivity(params), options);
}
export function useSleepRecordsForDateRange(personId: number, startDate: string, endDate: string, enabled = true) {
  return useLocalQuery(
    ['listSleepRecordsForDateRange', personId, startDate, endDate],
    () => localStore.listSleepRecordsForDateRange(personId, startDate, endDate),
    { query: { enabled } },
  );
}
export function useHydrationActivityRecordsForDateRange(personId: number, startDate: string, endDate: string, enabled = true) {
  return useLocalQuery(
    ['listHydrationActivityForDateRange', personId, startDate, endDate],
    () => localStore.listHydrationActivityForDateRange(personId, startDate, endDate),
    { query: { enabled } },
  );
}
export function useSearchSleepNotes(personId: number, searchTerm: string, qualityRatings: number[] = []) {
  const normalized = searchTerm.trim();
  const qualities = [...new Set(qualityRatings.filter(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5))].sort((a, b) => a - b);
  return useLocalQuery(
    ['searchSleepNotes', personId, normalized.toLowerCase(), qualities.join(',')],
    () => localStore.searchSleepNotes(personId, normalized, qualities),
    { query: { enabled: normalized.length > 0 || qualities.length > 0 } },
  );
}
export function useDayActivitiesForDates(personId: number, dates: string[]) {
  return useQueries({
    queries: dates.map(date => ({
      queryKey: getGetDayActivityQueryKey({ personId, date }),
      queryFn: () => localStore.getDayActivity({ personId, date }),
      networkMode: 'always' as const,
    })),
  });
}
export function useSaveDayActivity() {
  return useLocalMutation(({ data }: { data: DayActivityInput }) =>
    localStore.saveDayActivity(data), [['getDayActivity'], ['getDailySummary'], ['listHydrationActivityForDateRange']]);
}
export function useSaveMealTime() {
  return useLocalMutation(({ data }: { data: MealTimeInput }) =>
    localStore.saveMealTime(data), [['getDayActivity']]);
}
export function useMealReminderSource() {
  return useLocalQuery(['getMealReminderSource'], () => localStore.getMealReminderSource());
}
export function useSaveMealAlerts() {
  return useLocalMutation(({ data }: { data: MealAlertInput }) =>
    localStore.saveMealAlerts(data), [['getDayActivity']]);
}
export function useSaveSleepRecord() {
  return useLocalMutation(({ data }: { data: SleepLogInput }) =>
    localStore.saveSleepRecord(data), [['getDayActivity'], ['searchSleepNotes'], ['listSleepRecordsForDateRange']]);
}
export function useSaveHydrationLog() {
  return useLocalMutation(({ data }: { data: HydrationLogInput }) =>
    localStore.saveHydrationLog(data), [['getDayActivity'], ['getMealReminderSource'], ['listHydrationActivityForDateRange']]);
}
export function useSaveTennisPlan() {
  return useLocalMutation(({ data }: { data: TennisPlanInput }) =>
    localStore.saveTennisPlan(data), [['getDayActivity'], ['listHydrationActivityForDateRange'], ...ENTRIES_REFRESH]);
}
export function useSaveTennisPlanRating() {
  return useLocalMutation(({ data }: { data: TennisPlanRatingInput }) =>
    localStore.saveTennisPlanRating(data), [['getDayActivity'], ['listTennisPlanHistory']]);
}
export function useSaveTennisDiet() {
  return useLocalMutation(({ data }: { data: TennisDietInput }) =>
    localStore.saveTennisDiet(data), [['getDayActivity'], ...ENTRIES_REFRESH]);
}
export function useDeleteTennisDiet() {
  return useLocalMutation(({ data }: { data: TennisDietDeleteInput }) =>
    localStore.deleteTennisDiet(data), [['getDayActivity'], ...ENTRIES_REFRESH]);
}
export function useTennisFoodPlanDates(personId: number, options?: LocalQueryOptions<import('./local-models').TennisFoodPlanDate[]>) {
  return useLocalQuery(['listTennisFoodPlanDates', personId], () => localStore.listTennisFoodPlanDates(personId), options);
}
export function useTennisPlanHistory(personId: number, options?: LocalQueryOptions<TennisPlanHistoryItem[]>) {
  return useLocalQuery(['listTennisPlanHistory', personId], () => localStore.listTennisPlanHistory(personId), options);
}
export function useCopyTennisFoodPlan() {
  return useLocalMutation(({ data }: { data: CopyTennisFoodPlanInput }) =>
    localStore.copyTennisFoodPlan(data), [['getDayActivity'], ['listHydrationActivityForDateRange'], ...ENTRIES_REFRESH]);
}
export function useMealPlanReviews(personId: number) {
  return useLocalQuery(['listMealPlanReviews', personId], () => localStore.listMealPlanReviews(personId));
}
export function useSaveMealPlanReview() {
  return useLocalMutation(({ data }: { data: MealPlanReviewInput }) =>
    localStore.saveMealPlanReview(data), [['listMealPlanReviews']]);
}
export function useCopyMealsToDate() {
  return useLocalMutation(({ data }: { data: CopyMealsToDateInput }) =>
    localStore.copyMealsToDate(data), [['getDayActivity'], ...ENTRIES_REFRESH]);
}
export function useUndoMealReuse() {
  return useLocalMutation(({ data }: { data: MealReuseUndoInput }) =>
    localStore.undoMealReuse(data), [['getDayActivity'], ...ENTRIES_REFRESH]);
}

// Retained only as a safe transition bridge for screens removing online discovery.
// It intentionally performs no search, import, or network operation.
export function useDiscoverFoods(params: { search: string }, options?: LocalQueryOptions<DiscoveredFood[]>) {
  return useLocalQuery(getDiscoverFoodsQueryKey(params), async () => [], options);
}
export function useImportFood() {
  return useMutation<Food, Error, { data: { code: string } }>({
    mutationFn: async () => {
      throw new Error('Food discovery and remote imports are unavailable in local-only mode.');
    },
  });
}

export const LOCAL_PLANNER_QUERY_PREFIXES = [
  'listPeople', 'listFoods', 'listHeightRecords', 'listWeightRecords', 'listMealEntries', 'getDailySummary', 'getDayActivity',
  'listTennisFoodPlanDates', 'getMealReminderSource', 'searchSleepNotes', 'listHydrationActivityForDateRange',
] as const;

export const previewLocalBackup = (serialized: string) => localStore.previewBackup(serialized);

export const restoreLocalBackup = (serialized: string) => localStore.restoreBackup(serialized);
export const canUndoLocalRestore = () => localStore.hasUndoableRestore();
export const undoLocalRestore = () => localStore.undoLastRestore();

export const getLocalPeople = () => localStore.listPeople();
export const getLocalBackupSummary = () => localStore.getBackupSummary();
