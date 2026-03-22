// Push notification utilities for GUNS UP PWA

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Schedule a local notification (uses service worker for reliability)
export async function sendLocalNotification(title: string, body: string, tag?: string): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'guns-up-notification',
      data: { url: '/' },
    } as NotificationOptions);
  } else {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

// Notification types
export function notifyStreakWarning(callsign: string, streak: number): void {
  sendLocalNotification(
    `STREAK ALERT, ${callsign}!`,
    `Your ${streak}-day streak is on the line. Get a workout in today or lose it.`,
    'streak-warning'
  );
}

export function notifyWorkoutReminder(callsign: string): void {
  sendLocalNotification(
    `TIME TO TRAIN, ${callsign}`,
    'Your workout is waiting. No excuses.',
    'workout-reminder'
  );
}

export function notifyPRAlert(callsign: string, exercise: string, weight: number): void {
  sendLocalNotification(
    `NEW PR! ${exercise}`,
    `${callsign} just hit ${weight} lbs. Keep pushing.`,
    'pr-alert'
  );
}

export function notifyGunnyCheckIn(callsign: string, message: string): void {
  sendLocalNotification(
    `GUNNY CHECK-IN`,
    `${callsign}, ${message}`,
    'gunny-checkin'
  );
}

// Notification preferences interface
export interface NotificationPreferences {
  workoutReminders: boolean;
  streakWarnings: boolean;
  prAlerts: boolean;
  gunnyCheckIns: boolean;
  reminderTime: string; // HH:MM format
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  workoutReminders: true,
  streakWarnings: true,
  prAlerts: true,
  gunnyCheckIns: true,
  reminderTime: '08:00',
};

// Save/load notification preferences
export function saveNotificationPrefs(operatorId: string, prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(`guns-up-notif-${operatorId}`, JSON.stringify(prefs));
  } catch { /* localStorage may not be available */ }
}

export function loadNotificationPrefs(operatorId: string): NotificationPreferences {
  try {
    const stored = localStorage.getItem(`guns-up-notif-${operatorId}`);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_NOTIFICATION_PREFS;
}

// Check and send streak warning if needed
export function checkStreakWarning(callsign: string, workouts: Record<string, { completed?: boolean }>): void {
  const today = new Date().toISOString().split('T')[0];
  const hasWorkoutToday = workouts[today]?.completed;

  if (!hasWorkoutToday) {
    // Check if they had a streak going
    let streak = 0;
    const now = new Date();
    for (let i = 1; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (workouts[key]?.completed) streak++;
      else break;
    }

    if (streak >= 3) {
      notifyStreakWarning(callsign, streak);
    }
  }
}
