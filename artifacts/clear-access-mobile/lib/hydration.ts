import { getAgeOnDate } from './planning-targets';
import type { DayActivityType, HydrationEntry, HydrationLog, HydrationSession, TennisPlan } from './local-models';

export const HYDRATION_REMINDER_PREFIX = 'clear-access-hydration:';
export const MAX_HYDRATION_ENTRIES = 20;
export const MAX_HYDRATION_SESSIONS = 10;

export function estimateSessionSweatRate(session: Pick<HydrationSession, 'durationMinutes' | 'preWeightKg' | 'postWeightKg' | 'fluidMl' | 'urineMl'>) {
  if (session.durationMinutes <= 0) return null;
  const liters = session.preWeightKg - session.postWeightKg + (session.fluidMl - session.urineMl) / 1000;
  return liters / (session.durationMinutes / 60);
}

export function hydrationReference(dateOfBirth: string | null, sex: 'male' | 'female' | null, date: string) {
  if (!dateOfBirth) return null;
  const age = getAgeOnDate(dateOfBirth, date);
  if (age === null || age < 1) return null;
  const values: [number, number, number, number] | null =
    age <= 3 ? [1.3, 0.9, 1.3, 0.9] :
    age <= 8 ? [1.7, 1.2, 1.7, 1.2] :
    age <= 13 ? [2.1, 1.6, 2.4, 1.8] :
    age <= 18 ? [2.3, 1.8, 3.3, 2.6] :
    age <= 50 ? [2.7, 2.2, 3.7, 3.0] :
    age <= 70 ? [2.7, 2.2, 3.7, 3.0] : [2.7, 2.2, 3.7, 3.0];
  const [femaleTotal, femaleDrink, maleTotal, maleDrink] = values;
  return sex === 'female'
    ? { age, totalLiters: [femaleTotal, femaleTotal] as [number, number], beverageLiters: [femaleDrink, femaleDrink] as [number, number] }
    : sex === 'male'
      ? { age, totalLiters: [maleTotal, maleTotal] as [number, number], beverageLiters: [maleDrink, maleDrink] as [number, number] }
      : { age, totalLiters: [femaleTotal, maleTotal] as [number, number], beverageLiters: [femaleDrink, maleDrink] as [number, number] };
}

export function hydrationTotals(log?: HydrationLog) {
  return (log?.entries ?? []).reduce((total, entry) => ({
    plannedMl: total.plannedMl + entry.plannedMl,
    actualMl: total.actualMl + (entry.actualMl ?? 0),
  }), { plannedMl: 0, actualMl: 0 });
}

export function summarizeHydrationRecords(records: readonly { date: string; hydration: HydrationLog | undefined }[], throughDate: string) {
  const elapsed = records.filter(record => record.date <= throughDate);
  const entries = elapsed.flatMap(record => record.hydration?.entries ?? []);
  const recordedEntries = entries.filter(entry => entry.actualMl !== null);
  const plannedDays = elapsed.filter(record => (record.hydration?.entries.length ?? 0) > 0).length;
  const actualDays = elapsed.filter(record => (record.hydration?.entries.some(entry => entry.actualMl !== null) ?? false)).length;
  return {
    elapsedDays: elapsed.length,
    plannedDays,
    noEntryDays: elapsed.length - plannedDays,
    actualDays,
    plannedEntryCount: entries.length,
    recordedEntryCount: recordedEntries.length,
    plannedMl: entries.reduce((sum, entry) => sum + entry.plannedMl, 0),
    plannedForRecordedMl: recordedEntries.reduce((sum, entry) => sum + entry.plannedMl, 0),
    actualMl: recordedEntries.length ? recordedEntries.reduce((sum, entry) => sum + entry.actualMl!, 0) : null,
  };
}

export function summarizeHydrationByDate(records: readonly { date: string; hydration: HydrationLog | undefined }[], throughDate: string) {
  return records
    .filter(record => record.date <= throughDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(record => {
      const entries = record.hydration?.entries ?? [];
      const recordedEntries = entries.filter(entry => entry.actualMl !== null);
      return {
        date: record.date,
        plannedEntryCount: entries.length,
        recordedEntryCount: recordedEntries.length,
        plannedMl: entries.reduce((sum, entry) => sum + entry.plannedMl, 0),
        actualMl: recordedEntries.length
          ? recordedEntries.reduce((sum, entry) => sum + entry.actualMl!, 0)
          : null,
      };
    });
}

export function compareHydrationSummaries(
  current: ReturnType<typeof summarizeHydrationRecords>,
  comparison: ReturnType<typeof summarizeHydrationRecords>,
) {
  const perDay = (total: number | null, days: number) => total === null || days === 0 ? null : total / days;
  const attainment = (actual: number | null, planned: number) =>
    actual === null || planned <= 0 ? null : actual / planned * 100;
  const currentPlannedPerDay = perDay(current.plannedMl, current.plannedDays);
  const comparisonPlannedPerDay = perDay(comparison.plannedMl, comparison.plannedDays);
  const currentRecordedPerDay = perDay(current.actualMl, current.actualDays);
  const comparisonRecordedPerDay = perDay(comparison.actualMl, comparison.actualDays);
  return {
    plannedPerPlannedDayChangeMl: currentPlannedPerDay === null || comparisonPlannedPerDay === null
      ? null : currentPlannedPerDay - comparisonPlannedPerDay,
    recordedPerRecordedDayChangeMl: currentRecordedPerDay === null || comparisonRecordedPerDay === null
      ? null : currentRecordedPerDay - comparisonRecordedPerDay,
    currentRecordedVsPlannedPercent: attainment(current.actualMl, current.plannedForRecordedMl),
    comparisonRecordedVsPlannedPercent: attainment(comparison.actualMl, comparison.plannedForRecordedMl),
  };
}

export function summarizeHydrationByWeekday(
  records: readonly { date: string; hydration: HydrationLog | undefined }[],
  throughDate: string,
) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ...summarizeHydrationRecords(records.filter(record =>
      record.date <= throughDate && new Date(`${record.date}T00:00:00Z`).getUTCDay() === weekday,
    ), throughDate),
  }));
}

export type HydrationActivityGroup = 'active' | 'rest';
export type HydrationActivityRecord = { date: string; activityType: DayActivityType; tennis?: TennisPlan; hydration: HydrationLog | undefined };

export function hydrationActivityRecords(records: readonly HydrationActivityRecord[], group: HydrationActivityGroup, throughDate: string) {
  return records.filter(record => record.date <= throughDate && (
    group === 'active'
      ? record.tennis?.sessions.some(session => session.kind === 'practice' || session.kind === 'match') === true
      : record.activityType === 'rest' || record.tennis?.mode === 'rest'
  ));
}

export function summarizeHydrationByActivity(records: readonly HydrationActivityRecord[], throughDate: string) {
  return (['active', 'rest'] as const).map(group => {
    const groupedRecords = hydrationActivityRecords(records, group, throughDate);
    return {
      group,
      ...summarizeHydrationRecords(groupedRecords, throughDate),
    };
  });
}

export function mergeHydrationSchedule(current: HydrationEntry[], source: HydrationEntry[], createId: (index: number) => string) {
  const merged = [...current];
  source.forEach((entry, index) => {
    const existingIndex = merged.findIndex(existing => existing.time === entry.time);
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], plannedMl: entry.plannedMl, alertEnabled: entry.alertEnabled };
    } else {
      merged.push({
        id: createId(index), time: entry.time, plannedMl: entry.plannedMl,
        actualMl: null, alertEnabled: entry.alertEnabled,
      });
    }
  });
  return merged;
}
