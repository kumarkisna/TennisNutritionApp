import type { DayActivity, Meal, MealAlert } from './local-models';
import { getMealTimes } from './meal-scheduling';

export const REMINDER_PREFIX = 'clear-access-meal:';
export const MAX_MEAL_ALERTS = 8;
export const getMealAlerts = (alerts?: MealAlert[]): MealAlert[] =>
  alerts ? alerts.map(alert => ({ ...alert })) : [{ id: 'alert-default', minutesBefore: 0, enabled: false }];
export function isMealAlerts(value: unknown): value is NonNullable<DayActivity['mealAlerts']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const map = value as Record<string, unknown>;
  return Object.keys(map).every(meal => ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal) &&
    Array.isArray(map[meal]) && map[meal].length <= MAX_MEAL_ALERTS &&
    map[meal].every((a: unknown) => {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      const alert = a as Record<string, unknown>;
      return Object.keys(alert).length === 3 &&
        typeof alert.id === 'string' && /^alert-[a-z0-9-]{1,80}$/.test(alert.id) &&
        typeof alert.enabled === 'boolean' && Number.isInteger(alert.minutesBefore) &&
        (alert.minutesBefore as number) >= 0 && (alert.minutesBefore as number) <= 180;
    }) && new Set((map[meal] as MealAlert[]).map(a => a.id)).size === map[meal].length);
}
export type ReminderSource = {
  enabled: boolean;
  people: { id: number; name: string }[];
  days: Pick<DayActivity, 'date' | 'personId' | 'mealTimes' | 'mealAlerts'>[];
};
export type ReminderJob = { id: string; at: number; title: string; body: string; signature: string };
export function buildReminders(source: ReminderSource, now: number) {
  if (!source.enabled) return { jobs: [] as ReminderJob[], overflow: 0 };
  const jobs: ReminderJob[] = [];
  for (const day of source.days) {
    const person = source.people.find(p => p.id === day.personId);
    if (!person) continue;
    const times = getMealTimes(day.mealTimes);
    for (const meal of Object.keys(times) as Meal[]) {
      const [year, month, date] = day.date.split('-').map(Number);
      const [hour, minute] = times[meal].split(':').map(Number);
      const mealAt = new Date(year, month - 1, date, hour, minute).getTime();
      for (const alert of day.mealAlerts?.[meal] ?? []) {
        const at = mealAt - alert.minutesBefore * 60_000;
        if (!alert.enabled || at <= now) continue;
        const id = `${REMINDER_PREFIX}${day.personId}:${day.date}:${meal}:${alert.id}`;
        const title = `${meal[0].toUpperCase()}${meal.slice(1)} · ${person.name}`;
        const body = alert.minutesBefore === 0 ? `Time for your planned ${meal}.` :
          `Your planned ${meal} is in ${alert.minutesBefore} minutes (${times[meal]}).`;
        jobs.push({ id, at, title, body, signature: JSON.stringify([at, title, body]) });
      }
    }
  }
  jobs.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  // Leave room below iOS's pending-local-notification limit.
  return { jobs: jobs.slice(0, 60), overflow: Math.max(0, jobs.length - 60) };
}
export type ReminderDevice = {
  supported: boolean;
  permission(request?: boolean): Promise<boolean>;
  pending(): Promise<{ id: string; signature?: string }[]>;
  cancel(id: string): Promise<void>;
  schedule(job: ReminderJob): Promise<void>;
};
export async function reconcileReminders(device: ReminderDevice, jobs: ReminderJob[]) {
  const pending = (await device.pending()).filter(p => p.id.startsWith(REMINDER_PREFIX));
  const wanted = new Map(jobs.map(job => [job.id, job]));
  for (const item of pending) {
    const job = wanted.get(item.id);
    if (!job || job.signature !== item.signature) await device.cancel(item.id);
  }
  for (const job of jobs) {
    if (!pending.some(item => item.id === job.id && item.signature === job.signature)) await device.schedule(job);
  }
}