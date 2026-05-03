// Client-side Web Push helpers. Phase 2C.
//
// Three entry points:
//   ensurePushSubscription({ defaultOn })  — request permission (if
//     defaultOn is true and the user hasn't decided), subscribe via
//     the active service worker, and POST the subscription to
//     /api/push/subscribe. Idempotent; safe to call on every Daily
//     Ops mount.
//   getPushPermissionState()  — synchronous read of the current
//     Notification.permission state ('default' | 'granted' | 'denied'
//     | 'unsupported').
//   unsubscribePush()  — drops the local subscription AND tells the
//     server to delete the row.
//
// All errors swallow with console.warn — never throw into a UI
// effect. A push miss must never break the surface.

const SUB_REQUESTED_KEY = 'daily-ops:push-prompt-requested';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function getPushPermissionState(): PushPermission {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window)) return 'unsupported';
  return Notification.permission as PushPermission;
}

export function pushIsSupported(): boolean {
  return getPushPermissionState() !== 'unsupported';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

function detectPlatform(): 'ios-pwa' | 'desktop' | 'android' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  // iOS PWA: standalone display mode
  const standalone =
    typeof window !== 'undefined' &&
    'matchMedia' in window &&
    window.matchMedia('(display-mode: standalone)').matches;
  if (/iphone|ipad|ipod/.test(ua) && standalone) return 'ios-pwa';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|windows|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

interface EnsureArgs {
  /**
   * If true and the operator hasn't yet been prompted in this browser,
   * trigger the OS permission dialog. After the first prompt we
   * remember the decision in localStorage and never auto-prompt
   * again — the operator can re-enable from settings if they decline.
   */
  defaultOn?: boolean;
}

interface EnsureResult {
  state: PushPermission;
  /** True iff a fresh subscribe round-trip just succeeded. */
  subscribed: boolean;
  message?: string;
}

export async function ensurePushSubscription(
  args: EnsureArgs = {},
): Promise<EnsureResult> {
  const supportState = getPushPermissionState();
  if (supportState === 'unsupported') {
    return { state: 'unsupported', subscribed: false, message: 'Push not supported in this browser' };
  }

  // If user previously denied, don't re-prompt — that's spammy and
  // some browsers throttle re-prompts anyway.
  if (supportState === 'denied') {
    return { state: 'denied', subscribed: false };
  }

  let permission: PushPermission = supportState;
  if (permission === 'default' && args.defaultOn) {
    // First-time prompt. Stamp the flag BEFORE the await so a fast
    // re-render doesn't double-prompt.
    if (typeof window !== 'undefined') {
      const already = window.localStorage.getItem(SUB_REQUESTED_KEY);
      if (already === '1') {
        return { state: 'default', subscribed: false };
      }
      window.localStorage.setItem(SUB_REQUESTED_KEY, '1');
    }
    try {
      permission = (await Notification.requestPermission()) as PushPermission;
    } catch (err) {
      console.warn('[push] requestPermission failed', err);
      return { state: 'default', subscribed: false };
    }
  }

  if (permission !== 'granted') {
    return { state: permission, subscribed: false };
  }

  // We have permission. Subscribe via service worker.
  let registration: ServiceWorkerRegistration | null = null;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn('[push] service worker not ready', err);
    return { state: 'granted', subscribed: false, message: 'Service worker unavailable' };
  }
  if (!registration) {
    return { state: 'granted', subscribed: false, message: 'No service worker registration' };
  }

  // Reuse an existing subscription if present.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    // Fetch the VAPID public key from the server (allows rotation
    // without rebuilding the static bundle).
    let publicKey = '';
    try {
      const res = await fetch('/api/push/public-key', { credentials: 'include' });
      if (!res.ok) {
        return {
          state: 'granted',
          subscribed: false,
          message: `VAPID key fetch failed (${res.status})`,
        };
      }
      const data = await res.json();
      publicKey = data?.publicKey ?? '';
    } catch (err) {
      console.warn('[push] vapid key fetch failed', err);
      return { state: 'granted', subscribed: false, message: 'VAPID key fetch failed' };
    }
    if (!publicKey) {
      return { state: 'granted', subscribed: false, message: 'VAPID key not configured' };
    }

    try {
      // BufferSource cast — TS 5.x narrowed Uint8Array to require
      // ArrayBuffer (vs ArrayBufferLike) which conflicts with the
      // standard pushManager signature. The runtime is identical.
      const appServerKey = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    } catch (err) {
      console.warn('[push] subscribe failed', err);
      return {
        state: 'granted',
        subscribed: false,
        message: (err as Error).message ?? 'subscribe failed',
      };
    }
  }

  // POST to /api/push/subscribe. The endpoint upserts so a re-call is
  // free.
  try {
    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { state: 'granted', subscribed: false, message: 'Subscription missing keys' };
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        platform: detectPlatform(),
      }),
    });
    if (!res.ok) {
      return {
        state: 'granted',
        subscribed: false,
        message: `Server subscribe failed (${res.status})`,
      };
    }
  } catch (err) {
    console.warn('[push] server subscribe failed', err);
    return {
      state: 'granted',
      subscribed: false,
      message: (err as Error).message ?? 'server subscribe failed',
    };
  }

  return { state: 'granted', subscribed: true };
}

export async function unsubscribePush(opts?: { allDevices?: boolean }): Promise<boolean> {
  if (getPushPermissionState() === 'unsupported') return false;
  let registration: ServiceWorkerRegistration | null = null;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return false;
  }
  const sub = registration ? await registration.pushManager.getSubscription() : null;
  let endpoint: string | null = null;
  if (sub) {
    endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        opts?.allDevices ? { allForOperator: true } : { endpoint },
      ),
    });
  } catch {
    /* ignore */
  }
  return true;
}
