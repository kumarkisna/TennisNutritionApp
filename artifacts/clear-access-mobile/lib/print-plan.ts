import type { DayActivityType, HydrationLog, Meal, MealEntry, MealTimes, SleepLog, TennisDiet, TennisPlan } from './local-models';
import { sportsActivities } from './planning-targets';
import { dietPhaseLabels } from './tennis-planning';
import { calculateTotalSleepMinutes, formatSleepDuration, intervalDurationMinutes, sleepDurationMinutes } from './sleep-tracking';

export type PlannedDietItem = {
  entryId: number;
  time: string;
  meal: Meal;
  phase: TennisDiet['phase'] | null;
  foodName: string;
  grams: number;
};

const mealOrder: Record<Meal, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

const tennisModeLabels: Record<TennisPlan['mode'], string> = {
  training: 'Training',
  tournament: 'Tournament',
  rest: 'Rest',
};

const sessionKindLabels: Record<TennisPlan['sessions'][number]['kind'], string> = {
  practice: 'Practice',
  gym: 'Gym',
  match: 'Match',
};

const intensityLabels: Record<TennisPlan['sessions'][number]['intensity'], string> = {
  light: 'Light',
  moderate: 'Moderate',
  hard: 'Hard',
};

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [
    hours ? `${hours} h` : '',
    remainingMinutes ? `${remainingMinutes} min` : '',
  ].filter(Boolean).join(' ') || '0 min';
}

export function sortPlannedDiet(
  entries: MealEntry[],
  mealTimes: MealTimes,
  tennisDiets: TennisDiet[] = [],
): PlannedDietItem[] {
  const slotById = new Map(tennisDiets.map(slot => [slot.id, slot]));
  return entries.map(entry => {
    const slot = entry.tennisDietId ? slotById.get(entry.tennisDietId) : undefined;
    if (entry.tennisDietId && !slot) {
      throw new Error('A planned food has a missing tennis time slot. Refresh the day before printing.');
    }
    return {
      entryId: entry.id,
      time: slot?.time ?? mealTimes[entry.meal],
      meal: entry.meal,
      phase: slot?.phase ?? null,
      foodName: entry.food.name,
      grams: entry.grams,
    };
  }).sort((a, b) =>
    a.time.localeCompare(b.time) ||
    mealOrder[a.meal] - mealOrder[b.meal] ||
    a.foodName.localeCompare(b.foodName) ||
    a.entryId - b.entryId,
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildPlannedDietHtml({
  personName,
  date,
  activityType,
  tennisPlan,
  entries,
  mealTimes,
  tennisDiets = [],
  sleepLog,
  hydration,
}: {
  personName: string;
  date: string;
  activityType: DayActivityType;
  tennisPlan?: TennisPlan;
  entries: MealEntry[];
  mealTimes: MealTimes;
  tennisDiets?: TennisDiet[];
  sleepLog?: SleepLog;
  hydration?: HydrationLog;
}): string {
  const items = sortPlannedDiet(entries, mealTimes, tennisDiets);
  const sessionRows = tennisPlan?.sessions
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(session => `<li>
      <strong>${escapeHtml(session.startTime)}</strong>
      · ${escapeHtml(sessionKindLabels[session.kind])}
      · ${escapeHtml(durationLabel(session.durationMinutes))}
      · ${escapeHtml(intensityLabels[session.intensity])}
    </li>`)
    .join('');
  const rows = items.map(item => {
    const section = item.phase ? `${dietPhaseLabels[item.phase]} · ` : '';
    const portion = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(item.grams);
    return `<tr>
      <td class="time">${escapeHtml(item.time)}</td>
      <td>${escapeHtml(section + titleCase(item.meal))}</td>
      <td>${escapeHtml(item.foodName)}</td>
      <td class="portion">${escapeHtml(portion)} g</td>
    </tr>`;
  }).join('');
  const sleepMinutes = sleepLog ? sleepDurationMinutes(sleepLog.bedtime, sleepLog.wakeTime) : null;
  const totalSleepMinutes = sleepLog ? calculateTotalSleepMinutes(sleepLog) : null;
  const napRows = sleepLog?.naps?.map(nap => {
    const minutes = intervalDurationMinutes(nap);
    return minutes === null ? '' : `<li>${escapeHtml(nap.startTime)}–${escapeHtml(nap.endTime)} · ${escapeHtml(formatSleepDuration(minutes))}</li>`;
  }).join('') ?? '';
  const wakeUpRows = sleepLog?.wakeUps?.map(wakeUp => {
    const minutes = intervalDurationMinutes(wakeUp);
    return minutes === null ? '' : `<li>${escapeHtml(wakeUp.startTime)}–${escapeHtml(wakeUp.endTime)} · awake ${escapeHtml(formatSleepDuration(minutes))}</li>`;
  }).join('') ?? '';
  const sleepSection = sleepLog && sleepMinutes !== null && totalSleepMinutes !== null
    ? `<p><strong>Bedtime:</strong> ${escapeHtml(sleepLog.bedtime)} &nbsp; <strong>Wake time:</strong> ${escapeHtml(sleepLog.wakeTime)}</p>
       <p><strong>Overnight interval:</strong> ${escapeHtml(formatSleepDuration(sleepMinutes))} &nbsp; <strong>Total logged sleep:</strong> ${escapeHtml(formatSleepDuration(totalSleepMinutes))} &nbsp; <strong>Quality:</strong> ${sleepLog.quality}/5</p>
       ${napRows ? `<p><strong>Naps</strong></p><ul>${napRows}</ul>` : ''}
       ${wakeUpRows ? `<p><strong>Overnight wake-ups</strong></p><ul>${wakeUpRows}</ul>` : ''}
       ${sleepLog.note ? `<p><strong>Notes:</strong> ${escapeHtml(sleepLog.note)}</p>` : ''}`
    : '<p class="empty">No sleep record saved for this date.</p>';
  const hydrationSection = hydration?.entries.length || hydration?.sessions.length
    ? `<ul>${hydration.entries.map(e => `<li>${escapeHtml(e.time)} · planned ${e.plannedMl} mL · actual ${e.actualMl === null ? 'not logged' : `${e.actualMl} mL`}${e.alertEnabled && e.actualMl === null ? ' · alert on' : ''}</li>`).join('')}</ul>
      ${hydration.sessions.map(s => `<p>${escapeHtml(s.activity)} · estimated sweat rate ${(Math.max(0, s.preWeightKg - s.postWeightKg + (s.fluidMl - s.urineMl) / 1000) / (s.durationMinutes / 60)).toFixed(2)} L/hour</p>`).join('')}`
    : '<p class="empty">No hydration plan saved for this date.</p>';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Planned diet — ${escapeHtml(personName)} — ${escapeHtml(date)}</title>
    <style>
      @page { size: portrait; margin: 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #183542; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; }
      h1 { margin: 0 0 20px; font-size: 24pt; }
      .details { display: flex; flex-wrap: wrap; gap: 16px 36px; margin-bottom: 24px; }
      .detail { display: grid; gap: 4px; }
      .label { color: #52635f; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; }
      .value { font-size: 13pt; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      th { background: #eef3ef; color: #183542; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .6px; }
      th, td { border-bottom: 1px solid #d8e0dc; padding: 10px 8px; vertical-align: top; }
      tr { break-inside: avoid; }
      .time, .portion { white-space: nowrap; font-weight: 700; }
      .empty { margin: 0; border: 1px solid #d8e0dc; border-radius: 8px; padding: 16px; color: #52635f; }
      .note { margin-top: 24px; color: #52635f; font-size: 9pt; }
      h2 { margin: 24px 0 8px; font-size: 14pt; }
      .sessions { margin: 0; padding-left: 20px; }
      .sessions li { margin: 4px 0; }
    </style>
  </head>
  <body>
    <h1>Planned diet</h1>
    <section class="details">
      <div class="detail"><span class="label">Person</span><span class="value">${escapeHtml(personName)}</span></div>
      <div class="detail"><span class="label">Date</span><span class="value">${escapeHtml(date)}</span></div>
      <div class="detail"><span class="label">Activity type</span><span class="value">${escapeHtml(sportsActivities[activityType].label)}</span></div>
      <div class="detail"><span class="label">Tennis plan type</span><span class="value">${tennisPlan ? escapeHtml(tennisModeLabels[tennisPlan.mode]) : 'Not set'}</span></div>
      <div class="detail"><span class="label">Plan experience</span><span class="value">${tennisPlan?.experienceRating === undefined ? 'Not rated' : `${tennisPlan.experienceRating}/10`}</span></div>
    </section>
    <section>
      <h2>Sleep log</h2>
      ${sleepSection}
    </section>
    <section><h2>Hydration</h2>${hydrationSection}</section>
    <section>
      <h2>Tennis sessions</h2>
      ${tennisPlan
        ? sessionRows
          ? `<ul class="sessions">${sessionRows}</ul>`
          : '<p class="empty">No sessions scheduled.</p>'
        : '<p class="empty">No tennis plan saved.</p>'}
    </section>
    ${items.length
      ? `<table>
          <thead><tr><th>Time</th><th>Meal / food slot</th><th>Planned food</th><th>Portion</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="empty">No foods planned for this date.</p>'}
    <p class="note">Times and portions reflect the plan saved for this person and date.</p>
  </body>
</html>`;
}