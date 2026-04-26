'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Operator } from '@/lib/types';
import { OPERATORS, getAccessibleOperators } from '@/data/operators';
import AppShell from '@/components/AppShell';
import ClientOnboarding from '@/components/ClientOnboarding';
// Marketing landing page is the public face of `/`. Members log in via
// `/login` (which the landing's MEMBER LOGIN button links to). LoginScreen
// is no longer rendered here — it lives at /login.
import LandingPage from '@/app/landing/page';
import { initAnalytics, identifyUser, resetAnalytics, trackEvent, EVENTS } from '@/lib/analytics';
import { getAuthToken } from '@/lib/authClient';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>(OPERATORS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Debounce timer for save operations
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load operators from database on mount
  useEffect(() => {
    // Initialize PostHog analytics
    initAnalytics();

    // ─── Stripe checkout return handling ─────────────────────────────
    // Stripe's success_url + cancel_url drop the user back at /?checkout=
    // success&session_id=… or /?checkout=cancelled. We don't actually
    // act on those params yet (Stripe webhook updates the operator
    // record server-side), but the leftover URL state was confusing
    // bfcache restoration on iOS — combined with SW updates this could
    // produce the "stuck loading" symptom on browser-back from Stripe.
    // Strip the query string immediately so the URL goes back to clean
    // `/` and downstream logic doesn't see weird state.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('checkout') || params.has('session_id')) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    }

    // ─── bfcache restore handler ─────────────────────────────────────
    // iOS Safari aggressively caches the page when you navigate away
    // (e.g. to Stripe). When you come back via browser-back the page is
    // restored from cache — pageshow fires with persisted=true. The
    // cached React tree is fine, but we want to make sure isLoaded is
    // true (in case the original load was mid-flight when we navigated
    // away) so the user doesn't get stuck on "INITIALIZING SYSTEMS…".
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsLoaded(true);
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // Register service worker for PWA support with auto-update.
    // SINGLE reload trigger only — the previous setup had two listeners
    // (updatefound→statechange AND postMessage) that both fired on the
    // same activation, racing each other and causing double reloads /
    // bfcache confusion when returning from Stripe checkout. We now
    // rely solely on `controllerchange` which is the canonical "a new
    // SW just took control" signal, and we guard against firing more
    // than once per page life.
    let swReloadFired = false;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates every 60 seconds
          setInterval(() => registration.update(), 60000);
        })
        .catch(() => {
          // Service Worker registration failed — non-fatal, app still works
        });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (swReloadFired) return;
        swReloadFired = true;
        window.location.reload();
      });
    }

    const loadFromDB = async () => {
      // Check for stored JWT token FIRST — needed for authenticated API calls
      const token = getAuthToken();
      const authHeaders: Record<string, string> = token
        ? { 'Authorization': `Bearer ${token}` }
        : {};

      // Auto-login if token exists
      if (token) {
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentUser(meData.operator);
            identifyUser(meData.operator.id, {
              role: meData.operator.role,
              tier: meData.operator.tier,
              callsign: meData.operator.callsign
            });
          } else {
            // Token invalid, clear it
            console.warn('[page.tsx:loadFromDB] Auth /me returned non-ok:', meRes.status);
            localStorage.removeItem('authToken');
          }
        } catch (err) {
          console.error('[page.tsx:loadFromDB] Auth /me network error:', err);
          localStorage.removeItem('authToken');
        }
      }

      // Now fetch operators with auth header (so we get DB data, not static fallback)
      try {
        const res = await fetch('/api/operators', { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (data.operators && data.operators.length > 0) {
            setOperators(data.operators as Operator[]);
            setDbReady(true);
          } else {
            // Database is empty — seed it
            const seedRes = await fetch('/api/seed', { method: 'POST', headers: authHeaders });
            if (seedRes.ok) {
              // Re-fetch after seed
              const reRes = await fetch('/api/operators', { headers: authHeaders });
              if (reRes.ok) {
                const reData = await reRes.json();
                if (reData.operators?.length > 0) {
                  setOperators(reData.operators as Operator[]);
                }
              }
            }
            setDbReady(true);
          }
        } else {
          // API error — fall back to static data
          setDbReady(false);
        }
      } catch (err) {
        // Network/DB not available — fall back to static data
        setDbReady(false);
      }

      setIsLoaded(true);
    };

    loadFromDB();
  }, []);

  // Persist operator updates to database
  const persistOperator = useCallback(async (updated: Operator) => {
    // Always save intake completion to localStorage as bulletproof backup
    if (updated.intake?.completed) {
      try {
        localStorage.setItem(`guns-up-intake-done-${updated.id}`, 'true');
      } catch { /* localStorage unavailable */ }
    }

    // Targeted dual-PATCH strategy: workouts save in parallel with profile save,
    // so two concurrent tabs editing different fields no longer overwrite each other.
    const token = getAuthToken();
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const workoutsBody = {
      workouts: updated.workouts ?? {},
      prs: updated.prs ?? [],
      dayTags: updated.dayTags ?? {},
      injuries: updated.injuries ?? [],
    };
    const profileBody = {
      name: updated.name,
      callsign: updated.callsign,
      intake: updated.intake ?? {},
      profile: updated.profile ?? {},
      nutrition: updated.nutrition ?? {},
      preferences: updated.preferences ?? {},
      sitrep: updated.sitrep ?? {},
      dailyBrief: updated.dailyBrief ?? {},
      trainerNotes: updated.trainerNotes ?? null,
      // Junior Operator fields — only meaningful when the operator
      // (or its target via parent dashboard) is a junior. The server
      // whitelists per actor (self/trainer/admin write the kid-owned
      // fields; parents are restricted to juniorConsent + juniorSafety).
      // Without these on the body, JuniorIntakeForm.onComplete loses
      // sportProfile + consent on save and ParentDashboard updates
      // (mark resolved, emergency contact) silently fail.
      sportProfile: updated.sportProfile,
      juniorConsent: updated.juniorConsent,
      juniorSafety: updated.juniorSafety,
      juniorAge: updated.juniorAge,
      // Admin-only fields (ignored by server if not admin)
      tier: updated.tier,
      role: updated.role,
      coupleWith: updated.coupleWith ?? null,
      trainerId: updated.trainerId ?? null,
      clientIds: updated.clientIds ?? [],
      betaUser: updated.betaUser ?? false,
      betaFeedback: updated.betaFeedback ?? [],
      betaStartDate: updated.betaStartDate ?? null,
      betaEndDate: updated.betaEndDate ?? null,
      isVanguard: updated.isVanguard ?? false,
      tierLocked: updated.tierLocked ?? false,
      promoActive: updated.promoActive ?? false,
      promoType: updated.promoType ?? null,
      promoExpiry: updated.promoExpiry ?? null,
      // Admin-only junior identity (toggle isJunior on, set parents)
      isJunior: updated.isJunior,
      parentIds: updated.parentIds,
    };

    try {
      const [wRes, pRes] = await Promise.allSettled([
        fetch(`/api/operators/${updated.id}/workouts`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify(workoutsBody),
        }),
        fetch(`/api/operators/${updated.id}/profile`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify(profileBody),
        }),
      ]);

      const checks: Array<[string, PromiseSettledResult<Response>]> = [
        ['workouts', wRes],
        ['profile', pRes],
      ];
      let anyOk = false;
      for (const [label, result] of checks) {
        if (result.status === 'rejected') {
          console.error(`[page.tsx:persistOperator] ${label} PATCH rejected:`, result.reason);
          continue;
        }
        const res = result.value;
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[page.tsx:persistOperator] ${label} PATCH failed:`, res.status, errText);
        } else {
          anyOk = true;
        }
      }
      if (anyOk && !dbReady) setDbReady(true);
    } catch (err) {
      console.error('[page.tsx:persistOperator] Network error:', err);
    }
  }, [dbReady]);

  // Note: the old handleLogin handler that was wired into LoginScreen here is
  // gone — login now happens at /login, which fires its own LOGIN trackEvent
  // and hard-navigates to `/`. The mount-time loadFromDB effect above picks
  // up the freshly-stored authToken, calls /api/auth/me + identifyUser, and
  // pulls operators from the DB. Same end state, cleaner separation.

  const handleLogout = () => {
    trackEvent(EVENTS.LOGOUT);
    resetAnalytics();
    localStorage.removeItem('authToken');
    setCurrentUser(null);
  };

  const handleUpdateOperator = useCallback((updated: Operator, immediate?: boolean) => {
    setOperators(prev => prev.map(op => op.id === updated.id ? updated : op));

    // Also update currentUser if it's the same operator
    setCurrentUser(prev => prev?.id === updated.id ? updated : prev);

    // Intake completion and sitrep acceptance are critical saves — persist immediately
    const isCritical = immediate || updated.intake?.completed === true;

    if (isCritical) {
      // Cancel any pending debounced save and persist NOW
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistOperator(updated);
    } else {
      // Debounced persist to database (300ms) for routine updates
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistOperator(updated);
      }, 300);
    }
  }, [persistOperator]);

  if (!isLoaded) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#030303',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ff41',
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        letterSpacing: '2px',
      }}>
        INITIALIZING SYSTEMS...
      </div>
    );
  }

  if (!currentUser) {
    // Logged-out visitors see the marketing landing page instead of the PIN
    // keypad. Login + signup flows live at /login. The current implementation
    // doesn't pass operators or onLogin to the landing — it's a static-ish
    // marketing page that just links to /login for auth.
    return <LandingPage />;
  }

  // Check if client needs onboarding (no trainer assigned, is a client)
  const needsOnboarding = currentUser.role === 'client' && !currentUser.trainerId;

  if (needsOnboarding) {
    return (
      <ClientOnboarding
        operator={currentUser}
        allOperators={operators}
        onUpdateOperator={handleUpdateOperator}
      />
    );
  }

  const accessibleUsers = getAccessibleOperators(currentUser.id, operators);

  return (
    <AppShell
      currentUser={currentUser}
      accessibleUsers={accessibleUsers}
      operators={operators}
      onUpdateOperator={handleUpdateOperator}
      onLogout={handleLogout}
    />
  );
}
