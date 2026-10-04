import type { TennisPlan, TennisDiet } from './local-models';

export const TENNIS_SOURCE_URL = 'https://www.usta.com/en/home/improve/tips-and-instruction/national/nutrition-for-tennis--eat-to-win-.html';
export const fuelLabels = { before: 'Before play', during: 'During play', between: 'Between sessions / matches', after: 'Recovery', hydration: 'Hydration / conditions' } as const;
export const emptyTennisPlan = (mode: TennisPlan['mode'] = 'training'): TennisPlan => ({
  mode, sessions: [], fuel: { before: '', during: '', between: '', after: '', hydration: '' },
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[], optional: string[] = []) =>
  Object.keys(value).every(key => keys.includes(key) || optional.includes(key)) && keys.every(key => Object.hasOwn(value, key));
export const dietPhaseLabels = { before: 'Before play', during: 'During play', between: 'Between matches', after: 'Recovery' } as const;
export const isClockTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function isTennisDiet(value: unknown): value is TennisDiet {
  return record(value) && exact(value, ['id', 'phase', 'time']) &&
    typeof value.id === 'string' && /^diet-[a-z0-9-]{1,80}$/.test(value.id) &&
    typeof value.phase === 'string' && Object.hasOwn(dietPhaseLabels, value.phase) && isClockTime(value.time);
}
export const timeMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function tennisPlanProblem(value: unknown): string | null {
  if (!record(value) || !exact(value, ['mode', 'sessions', 'fuel'], ['diets']) ||
      typeof value.mode !== 'string' || !['training', 'tournament', 'rest'].includes(value.mode)) return 'Choose training, tournament, or rest.';
  if (!Array.isArray(value.sessions) || value.sessions.length > 12) return 'Plan at most 12 sessions in one day.';
  if (value.mode === 'rest' && value.sessions.length) return 'A rest day cannot contain tennis sessions.';
  if (value.mode !== 'rest' && !value.sessions.length) return 'Add at least one practice, gym session, or match.';
  if (Object.hasOwn(value, 'diets') && (!Array.isArray(value.diets) || value.diets.length > 24 ||
      !value.diets.every(isTennisDiet) || new Set(value.diets.map(diet => diet.id)).size !== value.diets.length)) {
    return 'Use at most 24 valid timed diets, each with a unique ID, stage and 24-hour HH:MM time.';
  }
  if (!record(value.fuel) || !exact(value.fuel, Object.keys(fuelLabels)) ||
      Object.keys(fuelLabels).some(key => typeof (value.fuel as Record<string, unknown>)[key] !== 'string' ||
        ((value.fuel as Record<string, string>)[key]).length > 600)) return 'Each food or hydration note must be text, up to 600 characters.';
  const intervals: { start: number; end: number }[] = [];
  for (const session of value.sessions) {
    if (!record(session) || !exact(session, ['kind', 'startTime', 'durationMinutes', 'intensity']) ||
        typeof session.kind !== 'string' || !['practice', 'gym', 'match'].includes(session.kind) ||
        typeof session.intensity !== 'string' || !['light', 'moderate', 'hard'].includes(session.intensity)) return 'Choose a valid session type and intensity.';
    if ((value.mode === 'tournament') !== (session.kind === 'match')) return 'Use matches for tournaments, and practice or gym sessions for training.';
    if (typeof session.startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session.startTime)) return 'Enter each start time in 24-hour HH:MM format.';
    if (typeof session.durationMinutes !== 'number' || !Number.isInteger(session.durationMinutes) ||
        session.durationMinutes < 1 || session.durationMinutes > 480) return 'Each expected duration must be 1–480 whole minutes.';
    const start = timeMinutes(session.startTime), end = start + session.durationMinutes;
    if (end > 1440) return 'Sessions must finish by midnight. Plan the next day separately.';
    intervals.push({ start, end });
  }
  intervals.sort((a, b) => a.start - b.start);
  if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) return 'Session times overlap. Adjust their start times or expected durations.';
  return null;
}
export const isTennisPlan = (value: unknown): value is TennisPlan => tennisPlanProblem(value) === null;

export function clockLabel(minutes: number): string {
  const day = Math.floor(minutes / 1440);
  const clock = ((minutes % 1440) + 1440) % 1440;
  return `${day < 0 ? 'Previous day ' : day > 0 ? 'Next day ' : ''}${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
}
export type TennisFuelWindow = { time: string; title: string; detail: string; phase: keyof TennisPlan['fuel'] };

// General planning examples based on USTA's timing guidance, not prescribed intakes.
// Deliberately no calories, carbohydrate quantities, supplements, or fluid-volume targets.
export function tennisFuelWindows(plan: TennisPlan): TennisFuelWindow[] {
  if (!isTennisPlan(plan)) throw new Error(tennisPlanProblem(plan)!);
  if (plan.mode === 'rest') return [{
    time: 'Through the day', title: 'Rest & recovery', phase: 'after',
    detail: 'Keep regular balanced meals with carbohydrate foods, protein, fruit and vegetables. Recovery continues on rest days; do not automatically restrict food.',
  }];
  const sessions = [...plan.sessions].sort((a, b) => timeMinutes(a.startTime) - timeMinutes(b.startTime));
  const windows: TennisFuelWindow[] = [{
    time: clockLabel(timeMinutes(sessions[0].startTime) - 180), title: 'Pre-play meal · example time', phase: 'before',
    detail: 'Allow roughly 3–4 hours for a familiar meal with carbohydrate and some protein. For early starts, adapt this to waking time and tolerance rather than skipping needed food.',
  }];
  sessions.forEach((session, index) => {
    const start = timeMinutes(session.startTime), end = start + session.durationMinutes;
    const previous = sessions[index - 1];
    const previousEnd = previous ? timeMinutes(previous.startTime) + previous.durationMinutes : null;
    if (previousEnd !== null) {
      const gap = start - previousEnd;
      windows.push({
        time: `${clockLabel(previousEnd)}–${clockLabel(start)}`, title: `Between ${plan.mode === 'tournament' ? 'matches' : 'sessions'} · ${gap} min`, phase: 'between',
        detail: gap < 60 ? 'Short turnaround: use the break for fluids and familiar, easily tolerated fuel. Avoid forcing a large meal just before play.'
          : gap < 120 ? 'A small familiar carbohydrate snack, such as fruit or toast, may fit this break. Adjust to appetite and tolerance.'
          : 'There is more time for a larger snack or meal with carbohydrate and protein, such as a sandwich or yogurt with fruit, allowing time to digest.',
      });
    }
    if (previousEnd === null || start - 30 >= previousEnd) windows.push({
      time: clockLabel(start - 30), title: `Before ${session.kind} ${index + 1} · optional snack`, phase: 'before',
      detail: 'If needed, choose a familiar, easy-to-digest carbohydrate snack, such as banana or toast. Avoid experimenting with new foods on match day.',
    });
    windows.push({
      time: `${clockLabel(start)}–${clockLabel(end)}`, title: `${session.kind === 'match' ? 'Match' : session.kind === 'gym' ? 'Gym' : 'Practice'} ${index + 1} · ${session.intensity}`, phase: 'during',
      detail: 'Have fluids available at breaks. Longer or harder play may need carbohydrate fuel; individual amounts depend on age, workload, conditions and tolerance.',
    });
  });
  const last = sessions[sessions.length - 1];
  const end = timeMinutes(last.startTime) + last.durationMinutes;
  windows.push({
    time: clockLabel(end + 15), title: 'Recovery snack · example time', phase: 'after',
    detail: 'After the final session, a carbohydrate-plus-protein snack can support recovery, for example yogurt and fruit or milk with a sandwich. Respect allergies and food preferences.',
  }, {
    time: clockLabel(end + 60), title: 'Recovery meal · example time', phase: 'after',
    detail: 'Plan a balanced meal within about two hours, including carbohydrate foods, protein and vegetables, with fluids as needed.',
  });
  return windows;
}