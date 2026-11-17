import type { NotificationsAdapter } from './notifications.types';

/**
 * Web: browsers cannot fire a notification at a set time while the page is closed. That needs
 * Web Push (a service worker `push` handler, VAPID keys and a server-side scheduler), which this
 * project does not ship. Until that exists the reminder is reported as unsupported instead of
 * pretending to work.
 */
export const notifications: NotificationsAdapter = {
  support: () => ({ scheduled: false }),
  enable: async () => 'denied',
  disable: async () => {},
  onOpenToday: () => () => {},
};
