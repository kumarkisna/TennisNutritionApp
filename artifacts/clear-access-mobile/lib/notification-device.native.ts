import { Platform } from 'react-native';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import type { ReminderDevice } from './meal-reminders';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});
export const notificationDevice: ReminderDevice = {
  supported: true,
  async permission(request = false) {
    if (Platform.OS === 'android') await setNotificationChannelAsync('meal-reminders', {
      name: 'Meal reminders', importance: AndroidImportance.DEFAULT, sound: 'default',
    });
    const current = request ? await requestPermissionsAsync() : await getPermissionsAsync();
    return current.granted || current.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  },
  async pending() {
    return (await getAllScheduledNotificationsAsync()).map(item => ({
      id: item.identifier,
      signature: typeof item.content.data?.mealReminderSignature === 'string' ? item.content.data.mealReminderSignature : undefined,
    }));
  },
  async cancel(id) { await cancelScheduledNotificationAsync(id); },
  async schedule(job) {
    try { await scheduleNotificationAsync({
      identifier: job.id,
      content: { title: job.title, body: job.body, sound: 'default', data: { mealReminderSignature: job.signature } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(job.at), channelId: 'meal-reminders' },
    }); } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(Platform.OS === 'android'
        ? `Could not schedule a meal alert. Check notification permission and Alarms & reminders access in device settings, then retry syncing. ${detail}`
        : `Could not schedule a meal alert. Check device notification settings and retry syncing. ${detail}`);
    }
  },
};