import type { DayActivity, DayActivityType, MealEntry, TennisDiet, TennisFoodImportRef, TennisPlan, TennisPlanHistoryItem } from './local-models';

export type TennisPlanHistoryFilter = {
  before: string;
  rating: 'any' | 'unrated' | number;
  tennisDayType: 'any' | TennisPlan['mode'];
  activityType: 'any' | DayActivityType;
};

export function followingCalendarDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function filterTennisPlanHistory(
  items: TennisPlanHistoryItem[],
  filter: TennisPlanHistoryFilter,
): TennisPlanHistoryItem[] {
  return items.filter(item =>
    item.date < filter.before &&
    (filter.rating === 'any' ||
      (filter.rating === 'unrated' ? item.rating === null : item.rating === filter.rating)) &&
    (filter.tennisDayType === 'any' || item.tennisDayType === filter.tennisDayType) &&
    (filter.activityType === 'any' || item.activityType === filter.activityType),
  );
}

/** Both the preview and atomic copy use the same canonical, device-local snapshot. */
export function getTennisFoodPlanFingerprint(plan: TennisPlan, entries: MealEntry[], personName: string): string {
  const ids = new Set(plan.diets?.map(diet => diet.id));
  const foods = entries.filter(entry => entry.tennisDietId && ids.has(entry.tennisDietId))
    .sort((a, b) => a.id - b.id)
    .map(entry => ({
      id: entry.id, slot: entry.tennisDietId, meal: entry.meal, grams: entry.grams,
      food: entry.food,
    }));
  return JSON.stringify({ personName, plan, foods });
}

export function getTennisFoodImportKey(ref: TennisFoodImportRef): string {
  return JSON.stringify([ref.sourcePersonBackupId, ref.sourceDate, ref.sourceDietId]);
}

export function mapTennisFoodSlots(source: TennisDiet[], destination: TennisDiet[]): Array<{
  sourceId: string; targetId: string | null;
}> {
  return source.map(slot => ({
    sourceId: slot.id,
    targetId: destination.find(candidate => candidate.phase === slot.phase && candidate.time === slot.time)?.id ?? null,
  }));
}

export function getTennisFoodDestinationFingerprint(
  activity: DayActivity | undefined, entries: MealEntry[], personName: string,
): string {
  // getDayActivity materializes an unpersisted blank day as an empty Rest day.
  // Treat that representation like no activity so previews fingerprint the same
  // state that the atomic store sees before the first save.
  const emptyRest = activity?.activityType === 'rest' && !activity.tennis &&
    !activity.mealTimes && !activity.mealAlerts && !activity.tennisFoodImports;
  return JSON.stringify({
    personName,
    activity: emptyRest ? null : activity ?? null,
    entries: [...entries].sort((a, b) => a.id - b.id).map(entry => ({
      id: entry.id, meal: entry.meal, grams: entry.grams, tennisDietId: entry.tennisDietId ?? null, food: entry.food,
    })),
  });
}