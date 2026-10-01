import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { createLocalStore } from './local-store';
import type {
  DailySummary,
  DayActivity,
  DayActivityInput,
  DiscoverFoodsParams,
  DiscoveredFood,
  Food,
  FoodInput,
  FoodSource,
  FoodUpdate,
  HeightRecord,
  HeightRecordInput,
  HeightRecordUpdate,
  GetDayActivityParams,
  GetDailySummaryParams,
  ListFoodsParams,
  ListHeightRecordsParams,
  ListMealEntriesParams,
  MealEntry,
  MealEntryInput,
  MealEntryUpdate,
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
  DayActivityType as DayActivityKind,
  DiscoverFoodsParams,
  DiscoveredFood,
  Food,
  FoodCategory as FoodCategoryType,
  FoodInput,
  FoodSource,
  FoodUpdate,
  HeightRecord,
  HeightRecordInput,
  HeightRecordUpdate,
  GetDayActivityParams,
  GetDailySummaryParams,
  ListFoodsParams,
  ListHeightRecordsParams,
  ListMealEntriesParams,
  MealEntry,
  MealEntryInput,
  MealEntryUpdate,
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
export { createLocalStore, LOCAL_STORAGE_KEY, isValidCalendarDate } from './local-store';

const localStore = createLocalStore(AsyncStorage);

export const exportLocalBackup = () => localStore.exportBackup();
export const getListPeopleQueryKey = () => ['listPeople'] as const;
export const getListFoodsQueryKey = (params?: ListFoodsParams) => ['listFoods', params] as const;
export const getListHeightRecordsQueryKey = (params?: ListHeightRecordsParams) => ['listHeightRecords', params] as const;
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
    },
  });
}

const PEOPLE_REFRESH = [
  getListPeopleQueryKey(),
  ['listHeightRecords'],
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
export function useSaveDayActivity() {
  return useLocalMutation(({ data }: { data: DayActivityInput }) =>
    localStore.saveDayActivity(data), [['getDayActivity'], ['getDailySummary']]);
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
  'listPeople', 'listFoods', 'listHeightRecords', 'listMealEntries', 'getDailySummary', 'getDayActivity',
] as const;

export const previewLocalBackup = (serialized: string) => localStore.previewBackup(serialized);

export const restoreLocalBackup = (serialized: string) => localStore.restoreBackup(serialized);

export const getLocalPeople = () => localStore.listPeople();
export const getLocalBackupSummary = () => localStore.getBackupSummary();
