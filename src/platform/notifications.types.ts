export interface ReminderRequest {
  hour: number;
  minute: number;
  title: string;
  body: string;
}

export interface NotificationsAdapter {
  /** Whether this platform can deliver a scheduled daily reminder while the app is closed. */
  support(): { scheduled: boolean };
  enable(req: ReminderRequest): Promise<'granted' | 'denied'>;
  disable(): Promise<void>;
  /** Calls `handler` when the user opens the app from the reminder. Returns an unsubscribe function. */
  onOpenToday(handler: () => void): () => void;
}
