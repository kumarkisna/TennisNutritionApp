import type { ReminderDevice } from './meal-reminders';
// Web cannot deliver this app's offline, background local notifications.
export const notificationDevice: ReminderDevice = {
  supported: false,
  async permission() { return false; },
  async pending() { return []; },
  async cancel() {},
  async schedule() { throw new Error('Meal notification delivery requires the iPhone or Android app.'); },
};