import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import type { NotificationsAdapter } from './notifications.types';

const CHANNEL = 'daily-reminder';
const DATA_TARGET = 'today';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** iOS / Android: local, on-device daily notification. No server involved. */
export const notifications: NotificationsAdapter = {
  support: () => ({ scheduled: true }),

  async enable({ hour, minute, title, body }) {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain !== false) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: title, importance: AndroidImportance.DEFAULT });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      // the text is generic on purpose: it never names the country or the mystery answer
      content: { title, body, data: { target: DATA_TARGET } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
    return 'granted';
  },

  async disable() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  onOpenToday(handler) {
    const isOurs = (r: Notifications.NotificationResponse | null | undefined) => r?.notification.request.content.data?.target === DATA_TARGET;
    Notifications.getLastNotificationResponseAsync().then((r) => { if (isOurs(r)) handler(); }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { if (isOurs(r)) handler(); });
    return () => sub.remove();
  },
};
