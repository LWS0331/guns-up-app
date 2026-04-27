'use client';

// RecoveryReadout — IntelCenter WEARABLES tab subsection. Calls
// /api/gunny/recovery-readout to compute a deterministic recovery
// recommendation (GO_HARD / NORMAL / DELOAD / REST) from the latest
// wearable sync, then asks Gunny for a short headline + 2-3 sentence
// guidance so the language matches the rest of the coaching surface.
//
// Falls back to self-report (sleep/stress/readiness from intake) when
// no wearable is connected — still useful, but flagged.
//
// COMMANDER+ tier-gated (matches the spreadsheet — recovery readout
// uses live wearable data which is COMMANDER+).

import React, { useState } from 'react';
import { Operator } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import { hasCommanderAccess } from '@/lib/tierGates';
import UpgradeCard from '@/components/UpgradeCard';

type Recommendation = 'GO_HARD' | 'NORMAL' | 'DELOAD' | 'REST';
type Signal = 'good' | 'warn' | 'bad';

interface ReadoutFactor {
  label: string;
  value: string;
  signal: Signal;
}

interface ReadoutData {
  recommendation: Recommendation;
  headline: string;
  guidance: string;
  factors: ReadoutFactor[];
  wearableConnected: boolean;
}

interface RecoveryReadoutProps {
  operator: Operator;
  currentUser?: Operator;
  onOpenBilling?: () => void;
}

// Color per recommendation — matches the rest of the GUNS UP surface.
const REC_COLOR: Record<Recommendation, string> = {
  GO_HARD: '#00ff41',  // green — push it
  NORMAL: '#22d3ee',   // cyan — run as written
  DELOAD: '#facc15',   // amber — dial back
  REST: '#ff4d4d',     // red — skip
};

const REC_LABEL: Record<Recommendation, string> = {
  GO_HARD: 'GO HARD',
  NORMAL: 'NORMAL',
  DELOAD: 'DELOAD',
  REST: 'REST',
};

const SIGNAL_COLOR: Record<Signal, string> = {
  good: '#00ff41',
  warn: '#facc15',
  bad: '#ff6b35',
};

export default function RecoveryReadout({ operator, currentUser, onOpenBilling }: RecoveryReadoutProps) {
  const viewer = currentUser ?? operator;
  const canAccess = hasCommanderAccess(viewer);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReadoutData | null>(null);

  if (!canAccess) {
    return (
      <UpgradeCard
        feature="Recovery Readout"
        requiredTier="opus"
        description="Live recovery recommendation from your wearable. Sleep duration, HRV, recovery score, resting HR — all rolled into a single GO HARD / NORMAL / DELOAD / REST call so you don't burn out."
        onUpgrade={onOpenBilling}
        compact
      />
    );
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/gunny/recovery-readout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ operatorId: operator.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || `Request failed (${res.status})`);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData({
        recommendation: json.recommendation,
        headline: json.headline || '',
        guidance: json.guidance || '',
        factors: Array.isArray(json.factors) ? json.factors : [],
        wearableConnected: !!json.wearableConnected,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: '#00ff41', letterSpacing: 2 }}>
          // RECOVERY READOUT
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            letterSpacing: 1.5,
            border: '1px solid #00ff41',
            background: loading ? 'rgba(0,255,65,0.15)' : 'transparent',
            color: '#00ff41',
            cursor: loading ? 'wait' : 'pointer',
            textTransform: 'uppercase',
            borderRadius: 3,
          }}
        >
          {loading ? 'Reading…' : data ? 'Refresh' : 'Run Readout'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!data && !loading && (
        <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(0,255,65,0.2)', color: '#888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, lineHeight: 1.5 }}>
          No readout yet. Tap RUN READOUT and Gunny will pull your latest wearable sync — sleep, HRV, recovery score, resting HR — and tell you whether to push it, run normal, deload, or rest today.
        </div>
      )}

      {data && (
        <>
          {/* Recommendation banner — color-coded per call */}
          <div
            style={{
              padding: 16,
              background: `${REC_COLOR[data.recommendation]}11`,
              border: `1px solid ${REC_COLOR[data.recommendation]}`,
              borderLeft: `4px solid ${REC_COLOR[data.recommendation]}`,
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 22,
                  letterSpacing: 3,
                  color: REC_COLOR[data.recommendation],
                  fontWeight: 800,
                }}
              >
                {REC_LABEL[data.recommendation]}
              </div>
              {!data.wearableConnected && (
                <div
                  style={{
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: 9,
                    letterSpacing: 1.5,
                    color: '#facc15',
                    border: '1px solid rgba(250,204,21,0.5)',
                    padding: '2px 8px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  Self-Report Only
                </div>
              )}
            </div>
            {data.headline && (
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 14, color: '#e0e0e0', lineHeight: 1.4, marginBottom: 0 }}>
                {data.headline}
              </div>
            )}
          </div>

          {/* Factor list */}
          {data.factors.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              {data.factors.map((f, i) => (
                <div
                  key={`${f.label}-${i}`}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${SIGNAL_COLOR[f.signal]}`,
                    borderRadius: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', letterSpacing: 0.5 }}>
                    {f.label}
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: SIGNAL_COLOR[f.signal], fontWeight: 700 }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Guidance paragraph */}
          {data.guidance && (
            <div
              style={{
                padding: 12,
                background: 'rgba(0,0,0,0.3)',
                borderLeft: `2px solid ${REC_COLOR[data.recommendation]}66`,
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 12,
                color: '#bbb',
                lineHeight: 1.6,
              }}
            >
              {data.guidance}
            </div>
          )}

          {!data.wearableConnected && (
            <div style={{ marginTop: 10, padding: 10, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#88dcef', lineHeight: 1.5, borderRadius: 3 }}>
              Connect a wearable (Apple Watch / WHOOP / Garmin / Fitbit / Oura) above for live HRV, sleep duration, and recovery score — that&apos;s when this readout becomes truly accurate.
            </div>
          )}
        </>
      )}
    </div>
  );
}
