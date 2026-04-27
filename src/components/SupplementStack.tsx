'use client';

// SupplementStack — IntelCenter NUTRITION tab subsection. Calls
// /api/gunny/recommend-supplements to generate a structured stack
// (3-6 evidence-backed compounds) and renders it. Persists the latest
// recommendation on operator.nutrition.supplementStack so the user
// doesn't need to re-call the LLM on every page load.
//
// Junior operators get a referral message instead of a stack — the
// endpoint returns refusal: true with a clinician-routing message.
//
// COMMANDER+ tier-gated (matches the spreadsheet claim that
// supplement recommendations are a COMMANDER+ feature).

import React, { useState } from 'react';
import { Operator } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import { hasCommanderAccess } from '@/lib/tierGates';
import UpgradeCard from '@/components/UpgradeCard';

interface StackItem {
  name: string;
  dose: string;
  timing: string;
  rationale: string;
  tier: 'core' | 'situational' | 'optional';
}

interface AvoidItem {
  name: string;
  reason: string;
}

interface SupplementStackData {
  stack: StackItem[];
  avoid: AvoidItem[];
  notes: string;
  refusal?: boolean;
  message?: string;
  generatedAt?: string;
}

interface SupplementStackProps {
  operator: Operator;
  currentUser?: Operator;
  onUpdateOperator: (updated: Operator) => void;
  onOpenBilling?: () => void;
}

const TIER_ACCENT: Record<StackItem['tier'], string> = {
  core: '#00ff41',
  situational: '#facc15',
  optional: '#888',
};

export default function SupplementStack({ operator, currentUser, onUpdateOperator, onOpenBilling }: SupplementStackProps) {
  const viewer = currentUser ?? operator;
  const canAccess = hasCommanderAccess(viewer);

  const existing = (operator.nutrition as { supplementStack?: SupplementStackData } | undefined)?.supplementStack;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SupplementStackData | null>(existing || null);

  if (!canAccess) {
    return (
      <UpgradeCard
        feature="Supplement Stack Recommendations"
        requiredTier="opus"
        description="AI-driven evidence-backed supplement protocol tailored to your goals, training path, diet, and intake. Skips the snake oil. Upgrade to COMMANDER to unlock."
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
      const res = await fetch('/api/gunny/recommend-supplements', {
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
      const next: SupplementStackData = {
        stack: json.stack || [],
        avoid: json.avoid || [],
        notes: json.notes || '',
        refusal: !!json.refusal,
        message: json.message,
        generatedAt: new Date().toISOString(),
      };
      setData(next);
      // Persist on operator.nutrition.supplementStack for next page load.
      // We extend NutritionData with supplementStack via the JSON column
      // so a runtime cast is the cleanest path.
      onUpdateOperator({
        ...operator,
        nutrition: {
          ...operator.nutrition,
          supplementStack: next,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
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
          // SUPPLEMENT STACK
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
          {loading ? 'Analyzing…' : data ? 'Regenerate' : 'Generate Stack'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {data?.refusal && (
        <div style={{ padding: 12, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.4)', color: '#ffb800', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
          {data.message}
        </div>
      )}

      {!data && !loading && (
        <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(0,255,65,0.2)', color: '#888', fontFamily: 'Share Tech Mono, monospace', fontSize: 12, lineHeight: 1.5 }}>
          No stack generated yet. Tap GENERATE STACK and Gunny will analyze your goal / training path / intake and propose 3–6 evidence-backed compounds with doses + timing.
        </div>
      )}

      {data && !data.refusal && data.stack.length > 0 && (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.stack.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                style={{
                  padding: 12,
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${TIER_ACCENT[item.tier]}33`,
                  borderLeft: `3px solid ${TIER_ACCENT[item.tier]}`,
                  borderRadius: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#e0e0e0', letterSpacing: 1, fontWeight: 700 }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: TIER_ACCENT[item.tier], letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {item.tier}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                  <div><span style={{ color: '#666' }}>Dose:</span> <span style={{ color: '#ddd' }}>{item.dose}</span></div>
                  <div><span style={{ color: '#666' }}>Timing:</span> <span style={{ color: '#ddd' }}>{item.timing}</span></div>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                  {item.rationale}
                </div>
              </div>
            ))}
          </div>

          {data.avoid.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#ff6b35', letterSpacing: 2, marginBottom: 8 }}>
                // SKIP — NOT WORTH IT
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.avoid.map((item, i) => (
                  <div
                    key={`avoid-${i}`}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255,107,53,0.06)',
                      border: '1px solid rgba(255,107,53,0.2)',
                      borderRadius: 3,
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: '#ff6b35', fontWeight: 700 }}>{item.name}</span>
                    <span style={{ color: '#888' }}> — {item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.notes && (
            <div style={{ marginTop: 14, padding: 10, background: 'rgba(0,0,0,0.3)', borderLeft: '2px solid rgba(0,255,65,0.3)', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#888', lineHeight: 1.5 }}>
              {data.notes}
            </div>
          )}

          {data.generatedAt && (
            <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#555', letterSpacing: 1, textAlign: 'right' }}>
              GENERATED {new Date(data.generatedAt).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
