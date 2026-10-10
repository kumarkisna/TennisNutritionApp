// @ts-ignore Node test modules belong to the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules belong to the direct regression runner.
import test from 'node:test';
import type { MealEntry, TennisPlan } from './local-models';
import { printHtmlInBrowserWindow } from './print-browser';
import { buildPlannedDietHtml, sortPlannedDiet } from './print-plan';

const mealTimes = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00' };

function entry(id: number, meal: MealEntry['meal'], foodName: string, tennisDietId?: string): MealEntry {
  return {
    id, date: '2026-10-05', personId: 1, meal, grams: 125,
    ...(tennisDietId ? { tennisDietId } : {}),
    food: {
      id, name: foodName, category: 'fruit', source: 'custom',
      caloriesPer100g: 90, proteinPer100g: 1, carbsPer100g: 20, fatPer100g: 0,
      fiberPer100g: 2, fiberKnown: true, calciumMgPer100g: null, ironMgPer100g: null,
    },
    nutrition: { calories: 112.5, protein: 1.3, carbs: 25, fat: 0, fiber: 2.5, calciumMg: null, ironMg: null },
  };
}

test('planned foods sort by saved tennis-slot or meal time', () => {
  const items = sortPlannedDiet([
    entry(1, 'dinner', 'Dinner food'),
    entry(2, 'breakfast', 'Before-play food', 'diet-before'),
    entry(3, 'lunch', 'Lunch food'),
  ], mealTimes, [{ id: 'diet-before', phase: 'before', time: '07:15' }]);

  assert.deepEqual(items.map(item => [item.time, item.foodName, item.phase]), [
    ['07:15', 'Before-play food', 'before'],
    ['13:00', 'Lunch food', null],
    ['19:00', 'Dinner food', null],
  ]);
});

test('print HTML includes the person, date, portions, and safely escaped names', () => {
  const html = buildPlannedDietHtml({
    personName: 'A & <B>',
    date: '2026-10-05',
    activityType: 'training_120',
    entries: [entry(1, 'breakfast', 'Oats <fresh>')],
    mealTimes,
  });

  assert.match(html, /A &amp; &lt;B&gt;/);
  assert.match(html, /2026-10-05/);
  assert.match(html, /Oats &lt;fresh&gt;/);
  assert.match(html, /125 g/);
  assert.match(html, /08:00/);
  assert.match(html, /Training 60–120 minutes/);
  assert.match(html, /Tennis plan type<\/span><span class="value">Not set/);
  assert.match(html, /Plan experience<\/span><span class="value">Not rated/);
});

test('hydration appears as timed entries in the printed food timetable', () => {
  const html = buildPlannedDietHtml({
    personName: 'Me',
    date: '2026-10-05',
    activityType: 'rest',
    entries: [entry(1, 'breakfast', 'Oats')],
    mealTimes,
    hydration: {
      entries: [{ id: 'water-1', time: '10:30', plannedMl: 300, actualMl: 200, alertEnabled: true }],
      sessions: [],
    },
  });
  assert.ok(html.indexOf('08:00</td><td>Breakfast') < html.indexOf('10:30</td><td>Hydration'));
  assert.match(html, /300 mL planned · 200 mL recorded/);
});

test('print HTML includes saved sleep times, calculated duration, rating, and escaped notes', () => {
  const html = buildPlannedDietHtml({
    personName: 'Me',
    date: '2026-10-05',
    activityType: 'rest',
    entries: [],
    mealTimes,
    sleepLog: { bedtime: '22:30', wakeTime: '06:45', quality: 4, note: 'Quiet & <cool>' },
  });
  assert.match(html, /Sleep log/);
  assert.match(html, /Bedtime:<\/strong> 22:30/);
  assert.match(html, /Wake time:<\/strong> 06:45/);
  assert.match(html, /Total logged sleep:<\/strong> 8 hr 15 min/);
  assert.match(html, /Quality:<\/strong> 4\/5/);
  assert.match(html, /Quiet &amp; &lt;cool&gt;/);
});

test('printed sleep log includes naps, wake-ups, and overlap-aware total sleep', () => {
  const html = buildPlannedDietHtml({
    personName: 'Me',
    date: '2026-10-05',
    activityType: 'rest',
    entries: [],
    mealTimes,
    sleepLog: {
      bedtime: '22:00',
      wakeTime: '06:00',
      quality: 4,
      note: '',
      naps: [{ startTime: '13:00', endTime: '14:00' }, { startTime: '13:30', endTime: '14:30' }],
      wakeUps: [{ startTime: '02:00', endTime: '02:30' }],
    },
  });
  assert.match(html, /Overnight interval:<\/strong> 8 hr/);
  assert.match(html, /Total logged sleep:<\/strong> 9 hr/);
  assert.match(html, /Naps/);
  assert.match(html, /13:00–14:00/);
  assert.match(html, /Overnight wake-ups/);
  assert.match(html, /awake 30 min/);
});

test('print HTML includes tennis plan type, sorted sessions, intensity, and rating', () => {
  const tennisPlan: TennisPlan = {
    mode: 'training',
    sessions: [
      { kind: 'gym', startTime: '15:00', durationMinutes: 45, intensity: 'light' },
      { kind: 'practice', startTime: '09:00', durationMinutes: 90, intensity: 'hard' },
    ],
    fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    experienceRating: 8,
  };
  const html = buildPlannedDietHtml({
    personName: 'Me',
    date: '2026-10-05',
    activityType: 'training_60',
    tennisPlan,
    entries: [],
    mealTimes,
  });

  assert.match(html, /Tennis plan type<\/span><span class="value">Training/);
  assert.match(html, /Plan experience<\/span><span class="value">8\/10/);
  assert.ok(html.indexOf('09:00') < html.indexOf('15:00'));
  assert.match(html, /Practice[\s\S]*1 h 30 min[\s\S]*Hard/);
  assert.match(html, /Gym[\s\S]*45 min[\s\S]*Light/);
});

test('web printing opens and prints the supplied document, then closes it', () => {
  const html = '<html><body>Saved day plan</body></html>';
  let writtenHtml = '';
  let printCalled = false;
  let focused = false;
  let closed = false;
  let afterPrint: (() => void) | undefined;
  const printWindow = {
    document: {
      open() {},
      write(markup: string) { writtenHtml = markup; },
      close() {},
    },
    addEventListener(_type: 'afterprint', listener: () => void) { afterPrint = listener; },
    focus() { focused = true; },
    print() { printCalled = true; },
    close() { closed = true; },
  };

  printHtmlInBrowserWindow(html, () => printWindow);

  assert.equal(writtenHtml, html);
  assert.equal(focused, true);
  assert.equal(printCalled, true);
  afterPrint?.();
  assert.equal(closed, true);
});

test('web printing explains when the browser blocks the print window', () => {
  assert.throws(
    () => printHtmlInBrowserWindow('<html></html>', () => null),
    /print window was blocked/i,
  );
});

test('empty plans print a clear empty state and missing linked slots fail explicitly', () => {
  const emptyHtml = buildPlannedDietHtml({
    personName: 'Me', date: '2026-10-05', activityType: 'rest', entries: [], mealTimes,
  });
  assert.match(emptyHtml, /No foods planned for this date/);
  assert.throws(
    () => sortPlannedDiet([entry(1, 'snack', 'Fuel', 'diet-missing')], mealTimes),
    /missing tennis time slot/i,
  );
});