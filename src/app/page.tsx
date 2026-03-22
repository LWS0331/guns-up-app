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
          console.log('Service Worker registered:', registration);
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
          console.log('Service Worker registration failed:', error);
        });
      // Listen for SW update messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          console.log('App updated to version:', event.data.version);
          window.location.reload();
        }
      });
    }

    const loadFromDB = async () => {
      try {
        const res = await fetch('/api/operators');
        if (res.ok) {
          const data = await res.json();
          if (data.operators && data.operators.length > 0) {
            setOperators(data.operators as Operator[]);
            setDbReady(true);
            console.log(`Loaded ${data.operators.length} operators from database`);
          } else {
            // Database is empty — seed it
            console.log('Database empty, seeding...');
            const seedRes = await fetch('/api/seed', { method: 'POST' });
            if (seedRes.ok) {
              const seedData = await seedRes.json();
              console.log(`Seeded ${seedData.created} operators`);
              // Re-fetch after seed
              const reRes = await fetch('/api/operators');
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
          console.warn('DB fetch failed, using static data');
          setDbReady(false);
        }
      } catch (err) {
        // Network/DB not available — fall back to static data
        console.warn('Database not available, using static data:', err);
        setDbReady(false);
      }

      // Check for stored JWT token and auto-login
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentUser(meData.operator);
            identifyUser(meData.operator.id, {
              role: meData.operator.role,
              tier: meData.operator.tier,
              callsign: meData.operator.callsign
            });
            console.log('Auto-logged in from stored token');
          } else {
            // Token invalid, clear it
            localStorage.removeItem('authToken');
          }
        } catch (err) {
          console.warn('Failed to verify token:', err);
          localStorage.removeItem('authToken');
        }
      }

      setIsLoaded(true);
    };

    loadFromDB();
  }, []);

  // Persist operator updates to database
  const persistOperator = useCallback(async (updated: Operator) => {
    if (!dbReady) return;
    try {
      await fetch(`/api/operators/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.warn('Failed to persist operator to DB:', err);
    }
  }, [dbReady]);

  const handleLogin = (operator: Operator) => {
    // Get the latest version of this operator from state
    const latest = operators.find(op => op.id === operator.id) || operator;
    setCurrentUser(latest);
    identifyUser(latest.id, {
      role: latest.role,
      tier: latest.tier,
      callsign: latest.callsign
    });
    trackEvent(EVENTS.LOGIN, { role: latest.role, tier: latest.tier });
  };

  const handleLogout = () => {
    trackEvent(EVENTS.LOGOUT);
    resetAnalytics();
    localStorage.removeItem('authToken');
    setCurrentUser(null);
  };

  const handleUpdateOperator = useCallback((updated: Operator) => {
    setOperators(prev => prev.map(op => op.id === updated.id ? updated : op));

    // Also update currentUser if it's the same operator
    setCurrentUser(prev => prev?.id === updated.id ? updated : prev);

    // Debounced persist to database (300ms)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistOperator(updated);
    }, 300);
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
