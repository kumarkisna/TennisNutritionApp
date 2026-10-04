import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ReminderDevice } from './meal-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});
export const notificationDevice: ReminderDevice = {
  supported: true,
  async permission(request = false) {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
    });
    const current = request ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
    return current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  },
  async pending() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map(item => ({
      id: item.identifier,
      signature: typeof item.content.data?.mealReminderSignature === 'string' ? item.content.data.mealReminderSignature : undefined,
    }));
  },
  async cancel(id) { await Notifications.cancelScheduledNotificationAsync(id); },
  async schedule(job) {
    try { await Notifications.scheduleNotificationAsync({
      identifier: job.id,
      content: { title: job.title, body: job.body, sound: 'default', data: { mealReminderSignature: job.signature } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(job.at), channelId: 'meal-reminders' },
    }); } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(Platform.OS === 'android'
        ? `Could not schedule a meal alert. Check notification permission and Alarms & reminders access in device settings, then retry syncing. ${detail}`
        : `Could not schedule a meal alert. Check device notification settings and retry syncing. ${detail}`);
    }
  },
};