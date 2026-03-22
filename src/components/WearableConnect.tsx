'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Operator } from '@/lib/types';

interface WearableConnection {
  id: string;
  operatorId: string;
  vitalUserId: string;
  provider: string;
  providerName: string;
  connectedAt: string;
  lastSyncAt: string | null;
  syncData: SyncData;
  active: boolean;
}

interface SyncData {
  lastSync?: string;
  sleep?: {
    date: string;
    duration: number;
    deep: number;
    light: number;
    rem: number;
    awake: number;
    efficiency: number | null;
    hrAverage: number | null;
    provider: string;
  };
  activity?: {
    date: string;
    steps: number;
    caloriesTotal: number;
    caloriesActive: number;
    distance: number;
    heartRate: { avg_bpm?: number; resting_bpm?: number } | null;
    provider: string;
  };
  body?: {
    date: string;
    weight: number | null;
    bodyFat: number | null;
    provider: string;
  };
  computedReadiness?: number;
}

const PROVIDERS = [
  { slug: 'whoop_v2', name: 'WHOOP', color: '#00ff41' },
  { slug: 'garmin', name: 'Garmin', color: '#00bcd4' },
  { slug: 'fitbit', name: 'Fitbit', color: '#ffb800' },
  { slug: 'oura', name: 'Oura Ring', color: '#ff4444' },
  { slug: 'polar', name: 'Polar', color: '#ff00ff' },
  { slug: 'withings', name: 'Withings', color: '#888' },
  { slug: 'peloton', name: 'Peloton', color: '#ff4444' },
];

interface WearableConnectProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
}

const WearableConnect: React.FC<WearableConnectProps> = ({ operator, onUpdateOperator }) => {
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  // Load existing connections
  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/wearables?operatorId=${operator.id}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
      // Silently fail — wearables are optional
    }
    setLoading(false);
  }, [operator.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Connect a new provider
  const handleConnect = async (providerSlug: string) => {
    setConnecting(providerSlug);
    setError(null);

    try {
      const res = await fetch('/api/wearables/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: operator.id, provider: providerSlug }),
      });

      if (res.status === 503) {
        setConfigured(false);
        setConnecting(null);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Connection failed');
      }

      const data = await res.json();

      // Open Junction connect widget in new tab
      if (data.linkUrl) {
        window.open(data.linkUrl, '_blank', 'width=500,height=700');
      }

      // Poll for connection status after a delay
      setTimeout(() => {
        loadConnections();
        setConnecting(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnecting(null);
    }
  };

  // Sync latest data
  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const res = await fetch('/api/wearables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: operator.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sync failed');
      }

      const data = await res.json();

      // Update local operator with synced data
      if (data.updatedFields) {
        const updated = { ...operator };
        if (data.updatedFields.readiness) updated.profile = { ...updated.profile, readiness: data.updatedFields.readiness };
        if (data.updatedFields.sleep) updated.profile = { ...updated.profile, sleep: data.updatedFields.sleep };
        if (data.updatedFields.weight) updated.profile = { ...updated.profile, weight: data.updatedFields.weight };
        if (data.updatedFields.bodyFat) updated.profile = { ...updated.profile, bodyFat: data.updatedFields.bodyFat };
        onUpdateOperator(updated);
      }

      // Refresh connections to get updated sync data
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }

    setSyncing(false);
  };

  const connectedSlugs = new Set(connections.map(c => c.provider));
  const latestSync = connections.find(c => c.syncData?.lastSync)?.syncData;

  if (!configured) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{
          background: 'rgba(255,184,0,0.05)',
          border: '1px solid rgba(255,184,0,0.15)',
          padding: '16px 20px',
          marginBottom: '16px',
        }}>
          <div style={{ color: '#ffb800', fontFamily: '"Orbitron", sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px' }}>
            WEARABLE INTEGRATION — COMING SOON
          </div>
          <div style={{ color: '#888', fontFamily: '"Chakra Petch", sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
            Connect your Apple Watch, WHOOP, Garmin, Fitbit, or Oura Ring to automatically sync sleep, recovery, heart rate, and body metrics directly into your INTEL profile. Gunny will use this data to customize your programming in real-time.
          </div>
          <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', marginTop: '12px', letterSpacing: '1px' }}>
            POWERED BY JUNCTION HEALTH DATA API
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '20px',
      }}>
        <div>
          <div style={{ color: '#00ff41', fontFamily: '"Orbitron", sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px' }}>
            WEARABLE DEVICES
          </div>
          <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', letterSpacing: '1px', marginTop: '4px' }}>
            CONNECT DEVICES TO AUTO-SYNC HEALTH METRICS
          </div>
        </div>

        {connections.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 16px',
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: syncing ? '#555' : '#00ff41',
              background: syncing ? 'rgba(0,255,65,0.02)' : 'rgba(0,255,65,0.05)',
              border: `1px solid ${syncing ? 'rgba(85,85,85,0.3)' : 'rgba(0,255,65,0.15)'}`,
              cursor: syncing ? 'default' : 'pointer',
            }}
          >
            {syncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.08)',
          border: '1px solid rgba(255,68,68,0.2)',
          padding: '10px 16px', marginBottom: '16px',
          color: '#ff4444', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Connected Devices */}
      {connections.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#888', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', letterSpacing: '1.5px', marginBottom: '12px' }}>
            CONNECTED
          </div>
          {connections.map(conn => {
            const providerConfig = PROVIDERS.find(p => p.slug === conn.provider);
            const sync = conn.syncData as SyncData;
            return (
              <div key={conn.id} style={{
                background: 'rgba(0,255,65,0.03)',
                border: '1px solid rgba(0,255,65,0.1)',
                padding: '16px', marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: providerConfig?.color || '#00ff41',
                      boxShadow: `0 0 8px ${providerConfig?.color || '#00ff41'}40`,
                    }} />
                    <span style={{ color: '#ddd', fontFamily: '"Chakra Petch", sans-serif', fontSize: '15px', fontWeight: 600 }}>
                      {conn.providerName}
                    </span>
                  </div>
                  <span style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>
                    {conn.lastSyncAt ? `Last sync: ${new Date(conn.lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No sync yet'}
                  </span>
                </div>

                {/* Sync Data Display */}
                {sync?.sleep && (
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <MetricBadge label="SLEEP" value={`${sync.sleep.duration}h`} color="#00bcd4" />
                    <MetricBadge label="DEEP" value={`${sync.sleep.deep}h`} color="#6a1b9a" />
                    <MetricBadge label="REM" value={`${sync.sleep.rem}h`} color="#ff9800" />
                    {sync.sleep.efficiency !== null && <MetricBadge label="EFFICIENCY" value={`${sync.sleep.efficiency}%`} color="#00ff41" />}
                    {sync.sleep.hrAverage !== null && <MetricBadge label="HR AVG" value={`${sync.sleep.hrAverage}`} color="#ff4444" />}
                  </div>
                )}

                {sync?.activity && (
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <MetricBadge label="STEPS" value={sync.activity.steps.toLocaleString()} color="#ffb800" />
                    <MetricBadge label="ACTIVE CAL" value={String(sync.activity.caloriesActive)} color="#ff4444" />
                    {sync.activity.heartRate?.resting_bpm && <MetricBadge label="RHR" value={`${sync.activity.heartRate.resting_bpm}`} color="#ff4444" />}
                  </div>
                )}

                {sync?.body && (sync.body.weight || sync.body.bodyFat) && (
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {sync.body.weight && <MetricBadge label="WEIGHT" value={`${sync.body.weight}lbs`} color="#00bcd4" />}
                    {sync.body.bodyFat && <MetricBadge label="BODY FAT" value={`${sync.body.bodyFat}%`} color="#ffb800" />}
                  </div>
                )}

                {sync?.computedReadiness !== undefined && sync.computedReadiness !== null && (
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(0,255,65,0.03)', border: '1px solid rgba(0,255,65,0.08)' }}>
                    <span style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', letterSpacing: '1px' }}>
                      COMPUTED READINESS:{' '}
                    </span>
                    <span style={{
                      color: sync.computedReadiness > 80 ? '#00ff41' : sync.computedReadiness > 60 ? '#ffb800' : '#ff4444',
                      fontFamily: '"Orbitron", sans-serif', fontSize: '16px', fontWeight: 700,
                    }}>
                      {sync.computedReadiness}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Available Providers to Connect */}
      <div>
        <div style={{ color: '#888', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', letterSpacing: '1.5px', marginBottom: '12px' }}>
          {connections.length > 0 ? 'ADD DEVICE' : 'SELECT DEVICE TO CONNECT'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
          {PROVIDERS.filter(p => !connectedSlugs.has(p.slug)).map(provider => (
            <button
              key={provider.slug}
              onClick={() => handleConnect(provider.slug)}
              disabled={connecting !== null}
              style={{
                padding: '14px 16px',
                background: connecting === provider.slug ? 'rgba(0,255,65,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${connecting === provider.slug ? provider.color + '40' : 'rgba(255,255,255,0.06)'}`,
                cursor: connecting ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: connecting === provider.slug ? provider.color : '#333',
                transition: 'background 0.2s ease',
              }} />
              <span style={{
                color: connecting === provider.slug ? provider.color : '#888',
                fontFamily: '"Chakra Petch", sans-serif', fontSize: '14px', fontWeight: 600,
              }}>
                {connecting === provider.slug ? 'CONNECTING...' : provider.name}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile-only note */}
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          background: 'rgba(255,184,0,0.03)', border: '1px solid rgba(255,184,0,0.08)',
          color: '#666', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', lineHeight: '1.6',
        }}>
          Apple Health and Google Fit require a mobile app companion (coming soon). WHOOP, Garmin, Fitbit, Oura, and Polar connect directly via web OAuth.
        </div>
      </div>

      {loading && (
        <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>
          LOADING CONNECTIONS...
        </div>
      )}
    </div>
  );
};

// Small metric display badge
const MetricBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
    <span style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '9px', letterSpacing: '1px' }}>{label}</span>
    <span style={{ color, fontFamily: '"Orbitron", sans-serif', fontSize: '14px', fontWeight: 700 }}>{value}</span>
  </div>
);

export default WearableConnect;
