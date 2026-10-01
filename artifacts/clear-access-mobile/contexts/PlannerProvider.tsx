import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import {
  getGetDailySummaryQueryKey, getListFoodsQueryKey, getListMealEntriesQueryKey, getListPeopleQueryKey,
  useListPeople, type Person,
} from '@/lib/local-api';
import { isIsoDate, today } from '@/lib/format';
import { Btn, EmptyState, ErrorBox, LoadingBlock, Screen } from '@/components/ui';

const STORAGE_KEY = 'clear-access-mobile:planner-selection:v1';
type Store = { personId: number | null; date: string; hydrated: boolean; storageError: string | null };
let store: Store = { personId: null, date: today(), hydrated: false, storageError: null };
let persistQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function setStore(patch: Partial<Store>) {
  store = { ...store, ...patch };
  listeners.forEach(listener => listener());
}

function persistSelection() {
  const snapshot = { personId: store.personId, date: store.date };
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)))
    .then(() => {
      if (store.storageError) setStore({ storageError: null });
    })
    .catch(error => {
      const detail = error instanceof Error ? error.message : String(error);
      setStore({ storageError: `Your selection could not be saved on this device. ${detail}` });
    });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => store;

type Ctx = {
  person: Person;
  people: Person[];
  date: string;
  setDate: (date: string) => void;
  selectPerson: (id: number) => void;
  refreshEntries: () => void;
  refreshFoods: () => void;
  refreshPeople: () => void;
};

const PlannerContext = createContext<Ctx | null>(null);

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within PlannerProvider');
  return context;
}

export function useOptionalPlanner() {
  return useContext(PlannerContext);
}

export function PlannerProvider({ children, tabs = false, title = 'Clear Access' }: { children: ReactNode; tabs?: boolean; title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const client = useQueryClient();
  const [hydrateAttempt, setHydrateAttempt] = useState(0);

  useEffect(() => {
    if (store.hydrated) return;
    let current = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!current) return;
      let selection: { personId?: unknown; date?: unknown } = {};
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') selection = parsed as { personId?: unknown; date?: unknown };
        } catch {
          throw new Error('Saved planner selection is unreadable. Retry to load it again.');
        }
      }
      const id = typeof selection.personId === 'number' && Number.isInteger(selection.personId) && selection.personId > 0
        ? selection.personId
        : null;
      const date = typeof selection.date === 'string' && isIsoDate(selection.date) ? selection.date : today();
      setStore({ personId: id, date, hydrated: true, storageError: null });
    }).catch(error => {
      if (!current) return;
      const detail = error instanceof Error ? error.message : String(error);
      setStore({ storageError: `Couldn't load your saved planner selection. ${detail}` });
    });
    return () => { current = false; };
  }, [hydrateAttempt]);

  const peopleQuery = useListPeople({ query: { enabled: snap.hydrated, queryKey: getListPeopleQueryKey() } });
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);
  const person = people.find(candidate => candidate.id === snap.personId) || people.find(candidate => candidate.isDefault) || people[0];

  useEffect(() => {
    if (peopleQuery.isSuccess && person && snap.personId !== person.id) {
      setStore({ personId: person.id });
      persistSelection();
    }
  }, [peopleQuery.isSuccess, person, snap.personId]);

  const selectPerson = useCallback((id: number) => {
    setStore({ personId: id });
    persistSelection();
  }, []);
  const setDate = useCallback((date: string) => {
    if (!isIsoDate(date)) return;
    setStore({ date });
    persistSelection();
  }, []);
  const refreshEntries = useCallback(() => {
    client.invalidateQueries({ queryKey: getListMealEntriesQueryKey().slice(0, 1) });
    client.invalidateQueries({ queryKey: getGetDailySummaryQueryKey().slice(0, 1) });
  }, [client]);
  const refreshFoods = useCallback(() => {
    client.invalidateQueries({ queryKey: getListFoodsQueryKey().slice(0, 1) });
    refreshEntries();
  }, [client, refreshEntries]);
  const refreshPeople = useCallback(() => {
    client.invalidateQueries({ queryKey: getListPeopleQueryKey() });
    refreshEntries();
  }, [client, refreshEntries]);
  const retryStorage = useCallback(() => {
    if (!snap.hydrated) {
      setStore({ storageError: null });
      setHydrateAttempt(attempt => attempt + 1);
    } else {
      setStore({ storageError: null });
      persistSelection();
    }
  }, [snap.hydrated]);
  const useDefaultSelection = useCallback(() => {
    AsyncStorage.removeItem(STORAGE_KEY).then(() => {
      setStore({ personId: null, date: today(), hydrated: true, storageError: null });
    }).catch(error => {
      const detail = error instanceof Error ? error.message : String(error);
      setStore({ personId: null, date: today(), hydrated: true, storageError: `The saved selection could not be reset. ${detail}` });
    });
  }, []);

  const value = useMemo<Ctx | null>(() => person ? {
    person, people, date: snap.date, setDate, selectPerson, refreshEntries, refreshFoods, refreshPeople,
  } : null, [person, people, snap.date, setDate, selectPerson, refreshEntries, refreshFoods, refreshPeople]);

  if (snap.storageError && !snap.hydrated) {
    return <Screen tabs={tabs} title={title}>
      <ErrorBox error={new Error(snap.storageError)} onRetry={retryStorage} />
      <Btn variant="ghost" label="Use default selection (keep my plans)" onPress={useDefaultSelection} testID="button-reset-local-selection" />
    </Screen>;
  }
  if (!snap.hydrated) return <Screen tabs={tabs} title={title}><LoadingBlock rows={3} /></Screen>;
  if (snap.storageError) return <Screen tabs={tabs} title={title}><ErrorBox error={new Error(snap.storageError)} onRetry={retryStorage} /></Screen>;
  if (peopleQuery.isLoading) return <Screen tabs={tabs} title={title}><LoadingBlock rows={3} /></Screen>;
  if (peopleQuery.isError) return <Screen tabs={tabs} title={title}><ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} /></Screen>;
  if (!value && pathname === '/person-form') return <>{children}</>;
  if (!value) return <Screen tabs={tabs} title={title}>
    <EmptyState icon="users" title="Create your first person" description="People, plans and foods are stored locally on this device. Add a person to start planning." actionLabel="Add person" onAction={() => router.push('/person-form')} />
  </Screen>;
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}