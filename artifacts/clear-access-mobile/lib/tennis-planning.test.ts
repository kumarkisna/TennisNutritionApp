// @ts-ignore Node test modules belong to the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules belong to the direct regression runner.
import test from 'node:test';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { clockLabel, emptyTennisPlan, isTennisPlan, tennisActivityPlanProblem, tennisDietChoiceFromFuelWindow, tennisFuelWindows, tennisPlanProblem } from './tennis-planning';
import type { TennisPlan } from './local-models';

class MemoryStorage {
  values = new Map<string, string>();
  fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.fail) throw new Error('injected failure');
    this.values.set(key, value);
  }
}
const date = '2026-10-04';
const training = (): TennisPlan => ({
  ...emptyTennisPlan(),
  sessions: [{ kind: 'practice', startTime: '09:00', durationMinutes: 90, intensity: 'moderate' }],
});
const tournament = (): TennisPlan => ({
  ...emptyTennisPlan('tournament'),
  sessions: [
    { kind: 'match', startTime: '09:00', durationMinutes: 90, intensity: 'hard' },
    { kind: 'match', startTime: '12:00', durationMinutes: 120, intensity: 'hard' },
  ],
});

test('training, tournament and rest plans have valid strict shapes', () => {
  for (const plan of [training(), tournament(), emptyTennisPlan('rest')]) assert.equal(tennisPlanProblem(plan), null);
  for (const plan of [null, [], {}, { ...training(), mode: { toString: null } },
    { ...training(), extra: true }, { ...training(), fuel: { ...training().fuel, extra: true } },
    emptyTennisPlan(), { ...training(), mode: 'rest' }]) assert.equal(isTennisPlan(plan), false);
});

test('invalid times, durations, overlaps, session kinds and note limits are rejected', () => {
  for (const time of ['9:00', '24:00', '09:60', 'abc']) {
    const plan = training(); plan.sessions[0].startTime = time;
    assert.match(tennisPlanProblem(plan)!, /HH:MM/);
  }
  for (const minutes of [0, 481, 1.5, NaN, Infinity]) {
    const plan = training(); plan.sessions[0].durationMinutes = minutes;
    assert.match(tennisPlanProblem(plan)!, /whole minutes/);
  }
  const late = training(); late.sessions[0].startTime = '23:00';
  assert.match(tennisPlanProblem(late)!, /midnight/);
  const overlap = tournament(); overlap.sessions[1].startTime = '10:00';
  assert.match(tennisPlanProblem(overlap)!, /overlap/);
  const wrongKind = tournament(); wrongKind.sessions[0].kind = 'practice';
  assert.match(tennisPlanProblem(wrongKind)!, /matches/);
  const tooMany = training(); tooMany.sessions = Array.from({ length: 13 }, () => ({ ...tooMany.sessions[0] }));
  assert.match(tennisPlanProblem(tooMany)!, /12/);
  const notes = training(); notes.fuel.before = 'x'.repeat(601);
  assert.match(tennisPlanProblem(notes)!, /600/);
});

test('fuel windows follow expected time order and include between-match guidance without modifying sessions', () => {
  const plan = tournament(); plan.sessions.reverse();
  const original = JSON.stringify(plan);
  const windows = tennisFuelWindows(plan);
  assert.equal(windows[0].time, '06:00');
  assert.ok(windows.some(window => window.phase === 'between' && window.title.includes('90 min')));
  const betweenIndex = windows.findIndex(window => window.phase === 'between');
  assert.equal(windows[betweenIndex + 1].time, '11:30');
  assert.equal(windows.at(-2)?.time, '14:15');
  assert.equal(windows.at(-1)?.time, '15:00');
  assert.equal(JSON.stringify(plan), original);
  assert.equal(tennisFuelWindows(emptyTennisPlan('rest')).length, 1);
  assert.equal(clockLabel(-150), 'Previous day 21:30');
  assert.equal(clockLabel(1470), 'Next day 00:30');
  assert.throws(() => tennisFuelWindows(emptyTennisPlan()), /Add at least/);
});

test('proposed tennis windows can prefill editable food-slot phase and time without inventing cross-day times', () => {
  const windows = tennisFuelWindows(tournament());
  const prePlay = windows.find(window => window.title.startsWith('Pre-play meal'));
  const match = windows.find(window => window.title.startsWith('Match 1'));
  if (!prePlay || !match) throw new Error('Expected proposed pre-play and match windows.');
  assert.deepEqual(tennisDietChoiceFromFuelWindow(prePlay), { phase: 'before', time: '06:00' });
  assert.deepEqual(tennisDietChoiceFromFuelWindow(match), { phase: 'during', time: '09:00' });
  assert.equal(tennisDietChoiceFromFuelWindow({ time: 'Previous day 21:30', title: 'Early start', detail: '', phase: 'before' }), null);
  assert.equal(tennisDietChoiceFromFuelWindow({ time: 'Through the day', title: 'Rest & recovery', detail: '', phase: 'after' }), null);
});

test('tennis plans survive reload and backup restore, independently of people, dates and target references', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  const other = await store.createPerson({ name: 'Test player', activityLevel: 'sedentary', baselineCalories: 2000 });
  await store.saveDayActivity({ date, personId: 1, activityType: 'adolescent_athletes' });
  const before = await store.getDailySummary({ date, personId: 1 });
  const plan = tournament(); plan.fuel.between = 'Packed banana and yogurt; adjust to tolerance.';
  await store.saveTennisPlan({ date, personId: 1, plan });
  assert.deepEqual(await store.getDailySummary({ date, personId: 1 }), before);
  assert.equal((await store.getDayActivity({ date, personId: other.id })).tennis, undefined);
  assert.equal((await store.getDayActivity({ date: '2026-10-05', personId: 1 })).tennis, undefined);
  const reloaded = createLocalStore(storage);
  assert.deepEqual((await reloaded.getDayActivity({ date, personId: 1 })).tennis, plan);
  const serialized = await reloaded.exportBackup();
  assert.equal(reloaded.previewBackup(serialized).activities, 1);
  const restored = createLocalStore(new MemoryStorage());
  await restored.restoreBackup(serialized);
  assert.deepEqual(await restored.getDayActivity({ date, personId: 1 }), await store.getDayActivity({ date, personId: 1 }));
  await store.saveDayActivity({ date, personId: 1, activityType: 'training_120' });
  assert.deepEqual((await store.getDayActivity({ date, personId: 1 })).tennis, plan);
});

test('clearing tennis removes only its metadata and existing legacy backups remain accepted', async () => {
  const store = createLocalStore(new MemoryStorage());
  await store.saveDayActivity({ date, personId: 1, activityType: 'strength' });
  const before = await store.exportBackup();
  await store.saveTennisPlan({ date, personId: 1, plan: training() });
  await store.saveTennisPlan({ date, personId: 1, plan: null });
  assert.deepEqual(await store.getDayActivity({ date, personId: 1 }), { date, personId: 1, activityType: 'strength' });
  await store.restoreBackup(before);
  assert.equal((await store.getDayActivity({ date, personId: 1 })).tennis, undefined);
});

test('rest or ordinary day cannot be saved with tennis sessions, and activity cannot be switched to rest afterward', async () => {
  const store = createLocalStore(new MemoryStorage());
  const restPlan = emptyTennisPlan('rest');
  assert.match(tennisActivityPlanProblem('rest', training()), /Rest or ordinary day/);
  assert.equal(tennisActivityPlanProblem('training_120', training()), null);
  assert.equal(tennisActivityPlanProblem('rest', restPlan), null);
  assert.equal(tennisActivityPlanProblem('rest', null), null);

  await assert.rejects(store.saveTennisPlan({ date, personId: 1, plan: training() }), /Rest or ordinary day/);
  assert.equal((await store.getDayActivity({ date, personId: 1 })).tennis, undefined);
  assert.equal((await store.getDayActivity({ date, personId: 1 })).activityType, 'rest');

  await store.saveDayActivity({ date, personId: 1, activityType: 'training_120' });
  await store.saveTennisPlan({ date, personId: 1, plan: training() });
  await assert.rejects(store.saveDayActivity({ date, personId: 1, activityType: 'rest' }), /Rest or ordinary day/);
  assert.equal((await store.getDayActivity({ date, personId: 1 })).activityType, 'training_120');

  await store.saveTennisPlan({ date, personId: 1, plan: restPlan });
  await store.saveDayActivity({ date, personId: 1, activityType: 'rest' });
  assert.equal((await store.getDayActivity({ date, personId: 1 })).activityType, 'rest');
  assert.equal((await store.getDayActivity({ date, personId: 1 })).tennis?.mode, 'rest');
});

test('failed writes and malformed backup tennis metadata preserve durable planner bytes', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await store.saveDayActivity({ date, personId: 1, activityType: 'training_120' });
  await store.saveTennisPlan({ date, personId: 1, plan: training() });
  const bytes = storage.values.get(LOCAL_STORAGE_KEY);
  storage.fail = true;
  await assert.rejects(store.saveTennisPlan({ date, personId: 1, plan: tournament() }), /not applied/);
  await assert.rejects(store.saveTennisPlan({ date, personId: 1, plan: null }), /not applied/);
  assert.deepEqual((await store.getDayActivity({ date, personId: 1 })).tennis, training());
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  storage.fail = false;
  const backup = JSON.parse(await store.exportBackup());
  backup.data.activities[0].tennis.sessions[0].durationMinutes = -1;
  const malformed = JSON.stringify(backup);
  assert.throws(() => store.previewBackup(malformed), /day activity/);
  await assert.rejects(store.restoreBackup(malformed), /day activity/);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
});

test('deleted people cannot leave tennis plans behind and invalid owners/dates never save', async () => {
  const store = createLocalStore(new MemoryStorage());
  const player = await store.createPerson({ name: 'Test player', activityLevel: 'light', baselineCalories: 2000 });
  await store.saveDayActivity({ date, personId: player.id, activityType: 'training_120' });
  await store.saveTennisPlan({ date, personId: player.id, plan: training() });
  await store.deletePerson(player.id);
  const state = await store.exportForTests() as { activities: { personId: number }[] };
  assert.equal(state.activities.some(item => item.personId === player.id), false);
  await assert.rejects(store.saveTennisPlan({ date, personId: player.id, plan: training() }), /person/i);
  await assert.rejects(store.saveTennisPlan({ date: '2026-02-30', personId: 1, plan: training() }), /date/);
});