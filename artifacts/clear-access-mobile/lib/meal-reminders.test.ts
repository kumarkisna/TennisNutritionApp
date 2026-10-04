// @ts-ignore Standalone Node test runner.
import assert from 'node:assert/strict';
// @ts-ignore Standalone Node test runner.
import test from 'node:test';
import { buildReminders, getMealAlerts, isMealAlerts, reconcileReminders, REMINDER_PREFIX, type ReminderDevice, type ReminderJob, type ReminderSource } from './meal-reminders';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { notificationDevice } from './notification-device';

const date = '2026-10-04', personId = 1;
const alerts = [{ id: 'alert-default', minutesBefore: 0, enabled: true }, { id: 'alert-early', minutesBefore: 10, enabled: true }];
const source = (): ReminderSource => ({
  enabled: true, people: [{ id: personId, name: 'Test player' }],
  days: [{ date, personId, mealAlerts: { breakfast: alerts.map(alert => ({ ...alert })) } }],
});
const now = new Date(2026, 9, 4, 7).getTime();
class Storage {
  values = new Map<string, string>(); fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { if (this.fail) throw new Error('injected failure'); this.values.set(key, value); }
}
class Device implements ReminderDevice {
  supported = true; fail = false;
  jobs = new Map<string, { id: string; signature?: string }>();
  writes: string[] = [];
  async permission() { return true; }
  async pending() { return [...this.jobs.values()]; }
  async cancel(id: string) { this.writes.push(`cancel:${id}`); this.jobs.delete(id); }
  async schedule(job: ReminderJob) {
    if (this.fail) throw new Error('device scheduling failed');
    this.writes.push(`schedule:${job.id}`); this.jobs.set(job.id, { id: job.id, signature: job.signature });
  }
}
test('one default optional alert per meal, strict bounds and unique IDs', () => {
  assert.deepEqual(getMealAlerts(), [{ id: 'alert-default', minutesBefore: 0, enabled: false }]);
  assert.equal(isMealAlerts({ breakfast: alerts }), true);
  for (const value of [null, [], { invalid: alerts }, { breakfast: [...alerts, alerts[0]] },
    { breakfast: [{ ...alerts[0], enabled: 1 }] }, { breakfast: [{ ...alerts[0], minutesBefore: 181 }] },
    { breakfast: [{ ...alerts[0], minutesBefore: -1 }] }, { breakfast: [{ ...alerts[0], minutesBefore: 1.5 }] },
    { breakfast: [{ ...alerts[0], extra: true }] }]) assert.equal(isMealAlerts(value), false);
});
test('local date times and earlier alerts follow edited meal clocks, never replay past alerts', () => {
  const current = source();
  const plan = buildReminders(current, now);
  assert.equal(plan.jobs.length, 2);
  assert.equal(plan.jobs[0].at, new Date(2026, 9, 4, 7, 50).getTime());
  assert.equal(plan.jobs[1].at, new Date(2026, 9, 4, 8).getTime());
  current.days[0].mealTimes = { breakfast: '09:00', lunch: '13:00', dinner: '19:00', snack: '16:00' };
  const updated = buildReminders(current, now);
  assert.equal(updated.jobs[0].at, new Date(2026, 9, 4, 8, 50).getTime());
  assert.equal(updated.jobs[0].id, plan.jobs[0].id);
  assert.notEqual(updated.jobs[0].signature, plan.jobs[0].signature);
  assert.equal(buildReminders(current, new Date(2026, 9, 4, 10).getTime()).jobs.length, 0);
  current.days[0].mealTimes.breakfast = '00:05';
  assert.equal(buildReminders(current, new Date(2026, 9, 3, 22).getTime()).jobs[0].at, new Date(2026, 9, 3, 23, 55).getTime());
});
test('master off overrides every enabled meal without changing alert settings', () => {
  const current = source(), before = JSON.stringify(current.days);
  current.enabled = false;
  assert.deepEqual(buildReminders(current, now), { jobs: [], overflow: 0 });
  assert.equal(JSON.stringify(current.days), before);
  current.enabled = true; current.days[0].mealAlerts!.breakfast![1].enabled = false;
  assert.equal(buildReminders(current, now).jobs.length, 1);
});
test('native reconciliation is idempotent, retimes jobs, removes stale alerts and leaves unrelated jobs alone', async () => {
  const device = new Device(), current = source(), first = buildReminders(current, now).jobs;
  device.jobs.set('other-feature', { id: 'other-feature' });
  await reconcileReminders(device, first);
  assert.equal(device.jobs.size, 3); const writes = device.writes.length;
  await reconcileReminders(device, first);
  assert.equal(device.writes.length, writes);
  current.days[0].mealTimes = { breakfast: '09:00', lunch: '13:00', dinner: '19:00', snack: '16:00' };
  await reconcileReminders(device, buildReminders(current, now).jobs);
  assert.equal(device.writes.length, writes + 4);
  device.jobs.set(`${REMINDER_PREFIX}old-no-signature`, { id: `${REMINDER_PREFIX}old-no-signature` });
  await reconcileReminders(device, []);
  assert.deepEqual([...device.jobs.keys()], ['other-feature']);
  device.fail = true;
  await assert.rejects(reconcileReminders(device, first), /device scheduling failed/);
});
test('pending limit is explicit and identifiers isolate people and dates', () => {
  const current = source();
  current.days = Array.from({ length: 80 }, (_, index) => {
    const d = new Date(2026, 9, index + 4);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date, personId, mealAlerts: { breakfast: [alerts[0]] } };
  });
  const plan = buildReminders(current, now);
  assert.equal(plan.jobs.length, 60); assert.equal(plan.overflow, 20);
  assert.equal(new Set(plan.jobs.map(job => job.id)).size, 60);
  assert.ok(plan.jobs.every((job, i) => !i || job.at >= plan.jobs[i - 1].at));
  current.people.push({ id: 2, name: 'Another player' });
  current.days.push({ ...current.days[0], personId: 2 });
  assert.equal(buildReminders(current, now).jobs.filter(job => job.at === plan.jobs[0].at).length, 2);
});
test('alert settings and master flag survive reload/backup, removal keeps food, old backups default off', async () => {
  const storage = new Storage(), store = createLocalStore(storage);
  const food = (await store.listFoods())[0];
  await store.createMealEntry({ date, personId, meal: 'breakfast', foodId: food.id, grams: 100 });
  const totals = await store.getDailySummary({ date, personId });
  await store.saveMealAlerts({ date, personId, meal: 'breakfast', alerts });
  await store.setMealAlertsEnabled(true);
  const backup = await store.exportBackup(), restored = createLocalStore(new Storage());
  await restored.restoreBackup(backup);
  assert.deepEqual(await restored.getMealReminderSource(), await store.getMealReminderSource());
  assert.deepEqual(await createLocalStore(storage).getMealReminderSource(), await store.getMealReminderSource());
  await store.setMealAlertsEnabled(false);
  assert.deepEqual((await store.getDayActivity({ date, personId })).mealAlerts?.breakfast, alerts);
  await store.saveMealAlerts({ date, personId, meal: 'breakfast', alerts: [] });
  assert.deepEqual(await store.getDailySummary({ date, personId }), totals);
  const legacy = JSON.parse(backup); delete legacy.data.mealAlertsEnabled; delete legacy.data.activities[0].mealAlerts;
  await restored.restoreBackup(JSON.stringify(legacy));
  assert.equal((await restored.getMealReminderSource()).enabled, false);
});
test('alerts are person/date scoped and activity/meal/tennis mutations retain them', async () => {
  const store = createLocalStore(new Storage());
  const other = await store.createPerson({ name: 'Another player', activityLevel: 'light', baselineCalories: 2000 });
  await store.saveMealAlerts({ date, personId, meal: 'breakfast', alerts });
  await store.saveMealTime({ date, personId, meal: 'breakfast', time: '09:00' });
  await store.saveDayActivity({ date, personId, activityType: 'adolescent_athletes' });
  await store.saveTennisPlan({ date, personId, plan: null });
  assert.deepEqual((await store.getDayActivity({ date, personId })).mealAlerts?.breakfast, alerts);
  assert.equal((await store.getDayActivity({ date, personId: other.id })).mealAlerts, undefined);
  assert.equal((await store.getDayActivity({ date: '2026-10-05', personId })).mealAlerts, undefined);
});
test('bad backups, bad owner/date, and failed writes leave committed reminder settings untouched', async () => {
  const storage = new Storage(), store = createLocalStore(storage);
  await store.saveMealAlerts({ date, personId, meal: 'breakfast', alerts });
  const backup = await store.exportBackup(), before = await store.exportForTests(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  for (const mutate of [
    (b: any) => { b.data.mealAlertsEnabled = 'on'; },
    (b: any) => { b.data.activities[0].mealAlerts.breakfast[0].minutesBefore = 999; },
    (b: any) => { b.data.activities[0].mealAlerts = null; },
  ]) {
    const envelope = JSON.parse(backup); mutate(envelope);
    await assert.rejects(store.restoreBackup(JSON.stringify(envelope)), /backup/i);
    assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  }
  await assert.rejects(store.saveMealAlerts({ date, personId: 999, meal: 'breakfast', alerts }), /Person/);
  await assert.rejects(store.saveMealAlerts({ date: '2026-02-30', personId, meal: 'breakfast', alerts }), /date/);
  storage.fail = true;
  await assert.rejects(store.saveMealAlerts({ date, personId, meal: 'breakfast', alerts: [] }), /not applied/);
  await assert.rejects(store.setMealAlertsEnabled(true), /not applied/);
  assert.deepEqual(await store.exportForTests(), before);
});
test('web has no pretend scheduled delivery', async () => {
  assert.equal(notificationDevice.supported, false);
  assert.equal(await notificationDevice.permission(true), false);
  await assert.rejects(notificationDevice.schedule(buildReminders(source(), now).jobs[0]), /iPhone or Android/);
});