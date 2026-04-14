'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Operator } from '@/lib/types';
import { OPERATORS, getAccessibleOperators } from '@/data/operators';
import LoginScreen from '@/components/LoginScreen';
import AppShell from '@/components/AppShell';
import ClientOnboarding from '@/components/ClientOnboarding';
import { initAnalytics, identifyUser, resetAnalytics, trackEvent, EVENTS } from '@/lib/analytics';

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

    // Register service worker for PWA support with auto-update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates every 60 seconds
          setInterval(() => registration.update(), 60000);
          // When a new SW is waiting, activate it
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  // New version available — reload to get fresh assets
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          // Service Worker registration failed
        });
      // Listen for SW update messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });
    }

    const loadFromDB = async () => {
      // Check for stored JWT token FIRST — needed for authenticated API calls
      const token = localStorage.getItem('authToken');
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
    const token = localStorage.getItem('authToken') || '';
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

  const handleLogin = async (operator: Operator) => {
    // Get the latest version of this operator from state
    const latest = operators.find(op => op.id === operator.id) || operator;
    setCurrentUser(latest);
    identifyUser(latest.id, {
      role: latest.role,
      tier: latest.tier,
      callsign: latest.callsign
    });
    trackEvent(EVENTS.LOGIN, { role: latest.role, tier: latest.tier });

    // Re-fetch operators from DB now that we have an auth token
    // This ensures we load persisted data (not static fallback) after fresh login
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const res = await fetch('/api/operators', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.operators?.length > 0) {
            setOperators(data.operators as Operator[]);
            // Update currentUser with DB version
            const dbUser = data.operators.find((op: Operator) => op.id === operator.id);
            if (dbUser) setCurrentUser(dbUser);
            setDbReady(true);
          }
        }
      } catch { /* DB unavailable — keep static data */ }
    }
  };

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
    return <LoginScreen onLogin={handleLogin} operators={operators} />;
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
