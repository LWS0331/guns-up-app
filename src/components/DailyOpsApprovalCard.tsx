'use client';

// DailyOpsApprovalCard — drop-in card for ParentDashboard.
//
// Surfaces every pending DailyOpsPlan across the parent's linked
// juniors with an Approve / Reject control. Fetches from
// `/api/daily-ops?pendingApprovals=true` on mount, and re-fetches
// after each decision so the queue stays in sync.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';
import type { DailyOpsPlanShape, DailyBlock } from '@/lib/dailyOpsTypes';

interface PendingItem {
  plan: DailyOpsPlanShape;
  junior: { id: string; callsign: string | null; juniorAge: number | null; name: string } | null;
}

const cardStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: 4,
  padding: 12,
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888',
  letterSpacing: 2,
  marginBottom: 8,
  textTransform: 'uppercase',
  fontFamily: 'Orbitron, sans-serif',
};

const planCardStyle: React.CSSProperties = {
  background: '#050505',
  border: '1px solid #2a2a2a',
  borderLeft: '3px solid #ff8800',
  borderRadius: 3,
  padding: 10,
  marginBottom: 8,
};

const blockRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px 1fr',
  gap: 8,
  fontSize: 11,
  padding: '3px 0',
  borderTop: '1px solid #1a1a1a',
};

const btnStyle = (variant: 'approve' | 'reject'): React.CSSProperties => ({
  padding: '6px 12px',
  background: variant === 'approve' ? '#0a1a0a' : '#1a0505',
  border: `1px solid ${variant === 'approve' ? '#00ff41' : '#ff4040'}`,
  color: variant === 'approve' ? '#00ff41' : '#ff4040',
  fontFamily: 'Orbitron, sans-serif',
  fontSize: 10,
  letterSpacing: 1,
  borderRadius: 3,
  cursor: 'pointer',
  textTransform: 'uppercase',
});

const noteStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#666',
  fontStyle: 'italic',
  lineHeight: 1.5,
};

function sortBlocks(blocks: DailyBlock[]): DailyBlock[] {
  return [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

const DailyOpsApprovalCard: React.FC = () => {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectionTextById, setRejectionTextById] = useState<Record<string, string>>({});

  // Request-token guard. fetchPending fires on mount and on every
  // approve/reject action (via decide() at the bottom of this file).
  // Rapid navigate-away-then-back can leave a stale pending list set
  // by the orphaned mount fetch; the guard makes the latest call win.
  const lastFetchRef = useRef(0);

  const fetchPending = useCallback(async () => {
    const myReq = ++lastFetchRef.current;
    setLoading(true);
    try {
      const res = await fetch('/api/daily-ops?pendingApprovals=true', {
        credentials: 'include',
      });
      if (lastFetchRef.current !== myReq) return; // superseded
      if (!res.ok) return;
      const data = await res.json();
      if (lastFetchRef.current !== myReq) return;
      setPending(Array.isArray(data.pending) ? data.pending : []);
    } catch (err) {
      if (lastFetchRef.current !== myReq) return;
      console.error('[daily-ops-approval] fetch failed', err);
    } finally {
      if (lastFetchRef.current === myReq) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const decide = useCallback(
    async (planId: string, approved: boolean) => {
      setDecidingId(planId);
      try {
        const res = await fetch('/api/daily-ops', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            planId,
            approved,
            notes: approved ? undefined : (rejectionTextById[planId] ?? '').slice(0, 500),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Approval failed.');
          return;
        }
        await fetchPending();
      } finally {
        setDecidingId(null);
      }
    },
    [fetchPending, rejectionTextById],
  );

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{t('parent.daily_ops_pending') || 'DAILY OPS — PENDING APPROVAL'}</div>
        <div style={noteStyle}>Loading…</div>
      </div>
    );
  }

  if (pending.length === 0) {
    return null; // Hide the card entirely when there's nothing to review.
  }

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('parent.daily_ops_pending') || 'DAILY OPS — PENDING APPROVAL'}{' '}
        <span style={{ color: '#ff8800' }}>({pending.length})</span>
      </div>
      <div style={noteStyle}>
        Gunny generated these daily-schedule plans for your linked juniors. Review each
        plan and approve before it goes live for them.
      </div>
      <div style={{ marginTop: 10 }}>
        {pending.map(({ plan, junior }) => {
          const blocks = sortBlocks(plan.blocks);
          return (
            <div key={plan.id} style={planCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>
                  {junior?.callsign || junior?.name || plan.operatorId}{' '}
                  <span style={{ color: '#888', fontWeight: 400 }}>· {plan.date}</span>
                </div>
                <div style={{ fontSize: 10, color: '#888', fontFamily: "'Share Tech Mono', monospace" }}>
                  {junior?.juniorAge != null ? `Age ${junior.juniorAge}` : ''}
                </div>
              </div>
              {plan.notes && (
                <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                  &ldquo;{plan.notes}&rdquo;
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                {blocks.map((b) => (
                  <div key={b.id} style={blockRowStyle}>
                    <div style={{ color: '#ff8800', fontFamily: "'Share Tech Mono', monospace" }}>
                      {b.startTime}
                    </div>
                    <div>
                      <div style={{ color: '#e0e0e0' }}>{b.label}</div>
                      <div style={{ color: '#666', fontSize: 10, fontStyle: 'italic' }}>
                        {b.rationale}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={btnStyle('approve')}
                  onClick={() => decide(plan.id, true)}
                  disabled={decidingId === plan.id}
                >
                  ✓ Approve
                </button>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={rejectionTextById[plan.id] || ''}
                  onChange={(e) =>
                    setRejectionTextById((prev) => ({ ...prev, [plan.id]: e.target.value }))
                  }
                  style={{
                    flex: 1,
                    minWidth: 140,
                    padding: '5px 8px',
                    background: '#000',
                    border: '1px solid #333',
                    color: '#e0e0e0',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 11,
                    borderRadius: 3,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  style={btnStyle('reject')}
                  onClick={() => decide(plan.id, false)}
                  disabled={decidingId === plan.id}
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyOpsApprovalCard;
