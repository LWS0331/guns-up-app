'use client';

import { useEffect, useRef, useCallback } from 'react';

// ═══ SHAKE-TO-TALK ═══
// Uses DeviceMotion API to detect deliberate shake gesture.
// Works on iOS/Android regardless of what app controls audio.
//
// Detection: 2 sharp shakes within 800ms window.
// Threshold tuned to avoid false triggers from lifting (which is
// smooth/slow acceleration) vs. a deliberate phone shake (sharp jerk).
//
// iOS 13+ requires explicit permission request via DeviceMotionEvent.requestPermission()
//
// NOTE: Shake disabled on iPad — tablet form factor makes shaking impractical.
// iPad users use tap-to-talk instead.

function isIPad(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ reports as Mac in user agent, so check for touch + Mac combo
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return true;
  // Modern iPadOS: "Macintosh" UA + touch support = iPad
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

interface UseShakeToTalkOptions {
  enabled: boolean;
  onShake: () => void;
  threshold?: number;    // Acceleration threshold (default: 25 — higher = harder shake needed)
  shakeWindow?: number;  // ms window for double-shake detection (default: 800)
  cooldown?: number;     // ms cooldown between triggers (default: 2000)
}

// Standalone permission request — call from any user gesture (e.g. START button)
// iOS 13+ requires explicit DeviceMotion permission from a user-initiated event
export async function requestDeviceMotionPermission(): Promise<boolean> {
  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DME.requestPermission === 'function') {
    try {
      const result = await DME.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  // Android / older iOS — no permission needed
  return true;
}

export function useShakeToTalk({
  enabled,
  onShake,
  threshold = 25,
  shakeWindow = 800,
  cooldown = 2000,
}: UseShakeToTalkOptions) {
  const lastShakeRef = useRef<number>(0);
  const shakeCountRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);
  const onShakeRef = useRef(onShake);
  const permissionGrantedRef = useRef(false);
  onShakeRef.current = onShake;

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (cooldownRef.current) return;

    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate total acceleration magnitude minus gravity (~9.8)
    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    // Subtract gravity baseline — a sharp shake produces magnitude > 25
    const shakeForce = Math.abs(magnitude - 9.81);

    if (shakeForce > threshold) {
      const now = Date.now();

      if (now - lastShakeRef.current < shakeWindow) {
        shakeCountRef.current++;
      } else {
        shakeCountRef.current = 1;
      }
      lastShakeRef.current = now;

      // Double-shake detected — trigger!
      if (shakeCountRef.current >= 2) {
        shakeCountRef.current = 0;
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, cooldown);
        onShakeRef.current();
      }
    }
  }, [threshold, shakeWindow, cooldown]);

  // Request iOS permission on first enable
  const requestPermission = useCallback(async () => {
    if (permissionGrantedRef.current) return true;

    // iOS 13+ requires explicit permission
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DME.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission();
        if (result === 'granted') {
          permissionGrantedRef.current = true;
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    // Android / older iOS — no permission needed
    permissionGrantedRef.current = true;
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Skip shake on iPad — tablet form factor, use tap-to-talk instead
    if (isIPad()) return;

    // Check if DeviceMotion is available
    if (!('DeviceMotionEvent' in window)) return;

    const setup = async () => {
      const granted = await requestPermission();
      if (!granted) return;

      window.addEventListener('devicemotion', handleMotion, { passive: true });
    };

    setup();

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, handleMotion, requestPermission]);

  return { requestPermission };
}
