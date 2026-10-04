import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { localStore, useMealReminderSource } from '@/lib/local-api';
import { buildReminders, reconcileReminders } from '@/lib/meal-reminders';
import { notificationDevice } from '@/lib/notification-device';

type Context = {
  enabled: boolean; busy: boolean; ready: boolean; supported: boolean;
  allowed: boolean; upcoming: number; overflow: number; error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>; refresh: () => Promise<void>;
};
const ReminderContext = createContext<Context | null>(null);
export function useMealReminders() {
  const value = useContext(ReminderContext);
  if (!value) throw new Error('Meal reminders provider is unavailable.');
  return value;
}
export function MealReminderProvider({ children }: { children: ReactNode }) {
  const source = useMealReminderSource();
  const client = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ allowed: false, upcoming: 0, overflow: 0, error: null as string | null });
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const run = queue.current.catch(() => undefined).then(operation);
    queue.current = run;
    return run;
  }, []);
  const sync = useCallback(async () => {
    const current = await localStore.getMealReminderSource();
    const plan = buildReminders(current, Date.now());
    if (!notificationDevice.supported) {
      setStatus({ allowed: false, upcoming: plan.jobs.length, overflow: plan.overflow, error: null });
      return;
    }
    const allowed = await notificationDevice.permission();
    setStatus({ allowed, upcoming: 0, overflow: plan.overflow, error: null });
    await reconcileReminders(notificationDevice, allowed && current.enabled ? plan.jobs : []);
    setStatus({ allowed, upcoming: allowed ? plan.jobs.length : 0, overflow: plan.overflow, error: null });
  }, []);
  const refresh = useCallback(async () => {
    try { await enqueue(sync); }
    catch (error) { setStatus(s => ({ ...s, error: error instanceof Error ? error.message : 'Device alerts could not be updated. Retry syncing.' })); }
  }, [enqueue, sync]);
  useEffect(() => { if (source.data) void refresh(); }, [source.data, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void source.refetch(); void refresh(); }
    });
    return () => subscription.remove();
  }, [source.refetch, refresh]);
  const setEnabled = useCallback(async (enabled: boolean) => {
    setBusy(true);
    try {
      await enqueue(async () => {
        if (enabled && notificationDevice.supported && !(await notificationDevice.permission(true))) {
          throw new Error('Notification permission was not granted. Alerts remain off. Allow notifications in device settings, then try again.');
        }
        // Cancel OS jobs before acknowledging master-off. Saved per-meal options survive.
        if (!enabled && notificationDevice.supported) await reconcileReminders(notificationDevice, []);
        await localStore.setMealAlertsEnabled(enabled);
        // Publish the committed local snapshot immediately. Merely invalidating this
        // long-lived provider query can leave mounted consumers displaying old flags.
        client.setQueryData(['getMealReminderSource'], await localStore.getMealReminderSource());
        await sync();
      });
    } catch (error) {
      // OS cancellation and device storage cannot share a transaction. If persistence
      // failed after cancellation, restore the schedule from the committed setting.
      try { await enqueue(sync); } catch { /* Retain the original explicit failure below. */ }
      setStatus(s => ({ ...s, error: error instanceof Error ? error.message : 'Could not change the master alert setting.' }));
      throw error;
    } finally { setBusy(false); }
  }, [client, enqueue, sync]);
  return <ReminderContext.Provider value={{
    enabled: source.data?.enabled ?? false, busy, ready: !!source.data && !source.isError,
    supported: notificationDevice.supported, ...status,
    error: source.isError ? String(source.error) : status.error, setEnabled, refresh,
  }}>{children}</ReminderContext.Provider>;
}