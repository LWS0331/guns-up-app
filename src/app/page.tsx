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
            localStorage.removeItem('authToken');
          }
        } catch (err) {
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
            const seedRes = await fetch('/api/seed', { method: 'POST' });
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

    // Attempt DB save even if dbReady is false — the DB may have come back online
    try {
      const res = await fetch(`/api/operators/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
      } else if (!dbReady) {
        // DB recovered — mark as ready
        setDbReady(true);
      }
    } catch (err) {
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
