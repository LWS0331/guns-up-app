'use client';

// CalendarConnect — operator-facing UI for the Phase 1 calendar
// integration. Mirrors the WearableConnect shape but for a single
// provider (Google Calendar, read-only) and direct OAuth instead of
// the Vital/Junction wrapper.
//
// Three states:
//   1. Tier-locked: viewer < Commander → UpgradeCard.
//   2. Feature-flag off (503 from /api/calendars/connect/google) →
//      "Coming Soon" banner.
//   3. Connected / not-connected toggle: shows CONNECT button when
//      no row exists, or {provider account · last sync · upcoming
//      event count + SYNC NOW + DISCONNECT} when one does.
//
// Surface placement: alongside WearableConnect in IntelCenter so
// operators discover both integrations together. Both unlock Daily
// Ops personalization signals; pairing them in one panel reflects
// that they're peer features.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Operator } from '@/lib/types';
import { hasCommanderAccess } from '@/lib/tierGates';
import { getAuthToken } from '@/lib/authClient';
import UpgradeCard from '@/components/UpgradeCard';

interface CalendarConnection {
  id: string;
  provider: string;
  providerAccountId?: string | null;
  externalCalId: string;
  connectedAt: string;
  lastSyncAt: string | null;
  scopes: string;
  eventCount: number;
  windowStart: string | null;
  windowEnd: string | null;
}

interface CalendarConnectProps {
  operator: Operator;
  // Viewer drives the tier gate — admins/trainers viewing a client
  // can always see the connection state, even if the client is on
  // RECON. Defaults to operator for self-view.
  currentUser?: Operator;
  onOpenBilling?: () => void;
}

const CalendarConnect: React.FC<CalendarConnectProps> = ({ operator, currentUser, onOpenBilling }) => {
  const viewer = currentUser ?? operator;
  const canAccess = hasCommanderAccess(viewer);

  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const lastFetchRef = useRef(0);
  // One-shot guard so we don't loop a re-sync if loadConnections fires
  // multiple times (initial mount + query-param effect). Only auto-syncs
  // when the row exists but has never synced — i.e. the operator just
  // connected and the cache is empty.
  const autoSyncedRef = useRef(false);

  const loadConnections = useCallback(async () => {
    const myReq = ++lastFetchRef.current;
    try {
      const res = await fetch(`/api/calendars?operatorId=${operator.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (lastFetchRef.current !== myReq) return;
      if (res.ok) {
        const data = await res.json();
        if (lastFetchRef.current !== myReq) return;
        setConnections(data.connections || []);
      }
    } catch (err) {
      if (lastFetchRef.current !== myReq) return;
      console.warn('[CalendarConnect:load] /api/calendars fetch failed:', err);
    }
    if (lastFetchRef.current === myReq) setLoading(false);
  }, [operator.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Detect calendar_connected / calendar_error query params dropped
  // by the OAuth callback so the user gets immediate feedback after
  // returning from Google. Strip the params from the URL after
  // reading so a refresh doesn't re-fire the toast.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const errParam = params.get('calendar_error');
    if (connected) {
      // Trigger a refresh so the connected row appears.
      loadConnections();
    }
    if (errParam) {
      setError(`Calendar connect failed: ${errParam}`);
    }
    if (connected || errParam) {
      params.delete('calendar_connected');
      params.delete('calendar_error');
      const search = params.toString();
      const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    }
  }, [loadConnections]);

  const handleConnect = () => {
    setError(null);
    // Direct top-level navigation to Google so cookies (auth) travel
    // with the redirect. No popup — popup blockers + iOS PWA storage
    // isolation make a single-tab redirect more reliable.
    const next = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/');
    window.location.href = `/api/calendars/connect/google?next=${next}`;
  };

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/calendars/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.status === 503) {
        setConfigured(false);
        return;
      }
      if (res.status === 401) {
        // Token died — connection auto-marked inactive server-side.
        setError('Calendar token expired. Reconnect Google Calendar.');
        await loadConnections();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Sync failed (HTTP ${res.status}).`);
        return;
      }
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSyncing(false);
    }
  }, [loadConnections]);

  // Auto-sync the first time we see a connection with no lastSyncAt.
  // The OAuth callback creates the row but doesn't pull events — that's
  // an explicit Phase 1 boundary so the callback returns fast. We close
  // the gap here so the operator sees their events without having to
  // tap SYNC NOW. One-shot via autoSyncedRef.
  useEffect(() => {
    if (autoSyncedRef.current) return;
    const conn = connections.find((c) => c.provider === 'google');
    if (conn && !conn.lastSyncAt) {
      autoSyncedRef.current = true;
      void handleSync();
    }
  }, [connections, handleSync]);

  const handleDisconnect = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Disconnect Google Calendar? Daily Ops will stop reshaping around external events.')) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/calendars', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ operatorId: operator.id, provider: 'google' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Disconnect failed (HTTP ${res.status}).`);
        return;
      }
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!canAccess) {
    return (
      <div style={{ padding: 20 }}>
        <UpgradeCard
          feature="Calendar Integration"
          requiredTier="opus"
          description="Connect your Google Calendar so Daily Ops reshapes workout, meal, and recovery blocks around real meetings. Upgrade to COMMANDER to unlock the full scheduling surface."
          onUpgrade={onOpenBilling}
        />
      </div>
    );
  }

  if (!configured) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          background: 'rgba(255,184,0,0.05)',
          border: '1px solid rgba(255,184,0,0.15)',
          padding: '16px 20px',
        }}>
          <div style={{ color: '#ffb800', fontFamily: '"Orbitron", sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
            CALENDAR INTEGRATION — COMING SOON
          </div>
          <div style={{ color: '#888', fontFamily: '"Chakra Petch", sans-serif', fontSize: 14, lineHeight: 1.6 }}>
            Google Calendar sync is queued. When it lights up you&apos;ll be able to connect your calendar and have Daily Ops reshape blocks around real meetings — strength training will avoid the 9am standup automatically.
          </div>
        </div>
      </div>
    );
  }

  const googleConn = connections.find((c) => c.provider === 'google');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#00ff41', fontFamily: '"Orbitron", sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>
          EXTERNAL CALENDAR
        </div>
        <div style={{ color: '#888', fontFamily: '"Chakra Petch", sans-serif', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          Connect Google Calendar so Daily Ops reshapes blocks around your real meetings. Read-only — Gunny never writes to your calendar.
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.06)',
          border: '1px solid rgba(255,68,68,0.25)',
          padding: '8px 12px',
          marginBottom: 12,
          color: '#ff8888',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#666', fontFamily: '"Share Tech Mono", monospace', fontSize: 12 }}>
          LOADING…
        </div>
      ) : googleConn ? (
        <div style={{
          background: 'rgba(0,255,65,0.04)',
          border: '1px solid rgba(0,255,65,0.20)',
          padding: '12px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#00ff41', fontFamily: '"Orbitron", sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>
              GOOGLE CALENDAR · CONNECTED
            </div>
            <div style={{ color: '#bbb', fontFamily: '"Share Tech Mono", monospace', fontSize: 11, marginTop: 4 }}>
              {googleConn.providerAccountId ? `as ${googleConn.providerAccountId}` : 'account: (unverified)'}
            </div>
            <div style={{ color: '#888', fontFamily: '"Share Tech Mono", monospace', fontSize: 11, marginTop: 2 }}>
              Last sync: {googleConn.lastSyncAt ? new Date(googleConn.lastSyncAt).toLocaleString() : 'never'} · {googleConn.eventCount} upcoming event{googleConn.eventCount === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || disconnecting}
              style={{
                padding: '6px 12px', fontSize: 11, fontFamily: '"Share Tech Mono", monospace',
                color: '#00ff41', background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.25)',
                cursor: syncing || disconnecting ? 'not-allowed' : 'pointer',
                letterSpacing: 1.2,
              }}
            >
              {syncing ? 'SYNCING…' : 'SYNC NOW'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={syncing || disconnecting}
              style={{
                padding: '6px 12px', fontSize: 11, fontFamily: '"Share Tech Mono", monospace',
                color: '#ff8888', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.25)',
                cursor: syncing || disconnecting ? 'not-allowed' : 'pointer',
                letterSpacing: 1.2,
              }}
            >
              {disconnecting ? '…' : 'DISCONNECT'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 18px',
            background: '#fff',
            color: '#1f1f1f',
            border: 'none',
            borderRadius: 4,
            fontFamily: '"Orbitron", sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 0 0 1px rgba(0,255,65,0.35), 0 0 14px rgba(0,255,65,0.15)',
          }}
        >
          {/* Google "G" mark inline so we don't pull a brand asset. */}
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span>CONNECT GOOGLE CALENDAR</span>
        </button>
      )}
    </div>
  );
};

export default CalendarConnect;
