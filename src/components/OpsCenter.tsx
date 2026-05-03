'use client';

import React, { useState, useEffect } from 'react';
import { Operator, TIER_CONFIGS, AiTier, OPS_CENTER_ACCESS } from '@/lib/types';
import { getAuthToken } from '@/lib/authClient';
import Icon from '@/components/Icons';
import OpsRoadmap from '@/components/OpsRoadmap';

type OpsTab = 'REVENUE' | 'USERS' | 'PLATFORM' | 'BETA' | 'MARKETING' | 'ROADMAP';

// Hard-gated to the two founder operators ONLY. Even if OPS_CENTER_ACCESS
// expands to include other admins later (env-configurable), the ROADMAP
// tab stays scoped to Ruben + Britney. The strategy-doc content is
// internal financial / hiring / fundraising info — not for general
// admin consumption.
const FOUNDER_IDS = ['op-ruben', 'op-britney'] as const;

interface OpsCenterProps {
  currentUser: Operator;
  operators: Operator[];
}

// ═══════════════════════════════════════════════════
// DB METRICS SHAPE (from /api/ops)
// ═══════════════════════════════════════════════════
interface DbMetrics {
  timestamp: string;
  operators: {
    total: number;
    trainers: number;
    clients: number;
    beta: number;
    active7d: number;
    profileComplete: number;
    operatorStats: Array<{
      id: string;
      callsign: string;
      name: string;
      role: string;
      tier: string;
      // Closed-beta fields — needed for accurate roster rendering
      // without falling back to the stale `operators` prop.
      email: string | null;
      googleId: string | null;
      tierLocked: boolean;
      isVanguard: boolean;
      promoActive: boolean;
      trainerId: string | null;
      betaUser: boolean;
      billingStatus: string | null;
      workoutCount: number;
      mealCount: number;
      prCount: number;
      injuryCount: number;
      isActive: boolean;
      hasProfile: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  platform: {
    totalWorkouts: number;
    totalMeals: number;
    totalPRs: number;
    totalInjuries: number;
    activeWearables: number;
  };
  ai: {
    totalChatSessions: number;
    totalMessages: number;
    gunnyChatSessions: number;
    onboardingSessions: number;
    panelSessions: number;
    estTotalTokens: number;
    estMonthlyCostUSD: number;
  };
  db: {
    operatorRows: number;
    chatRows: number;
    estTotalRows: number;
  };
  chatsByOperator?: Record<string, number>;
}

interface MarketingPlatform {
  name: string;
  slug: string;
  color: string;
  connected: boolean;
  apiEndpoint: string | null;
  description: string;
}

const MARKETING_PLATFORMS: MarketingPlatform[] = [
  { name: 'Instagram', slug: 'instagram', color: '#E1306C', connected: false, apiEndpoint: null, description: 'Post reels, stories, and feed content' },
  { name: 'TikTok', slug: 'tiktok', color: '#00f2ea', connected: false, apiEndpoint: null, description: 'Post short-form video content' },
  { name: 'X (Twitter)', slug: 'twitter', color: '#1DA1F2', connected: false, apiEndpoint: null, description: 'Post tweets and threads' },
  { name: 'Facebook', slug: 'facebook', color: '#4267B2', connected: false, apiEndpoint: null, description: 'Post to page and groups' },
  { name: 'YouTube', slug: 'youtube', color: '#FF0000', connected: false, apiEndpoint: null, description: 'Upload videos and shorts' },
  { name: 'LinkedIn', slug: 'linkedin', color: '#0077B5', connected: false, apiEndpoint: null, description: 'Post professional content' },
];

/** Feedback entry shape mirrored from /api/beta-feedback. The DB stores a
 *  String[] of JSON strings, so each `betaFeedback` slot here is the parsed
 *  form of one of those strings. resolutionNote/resolvedAt/resolvedBy are
 *  set when an admin updates status to FIXED/WONTFIX (Apr 2026, PR #100). */
type FeedbackStatus = 'NEW' | 'REVIEWING' | 'FIXED' | 'WONTFIX';
interface ParsedFeedback {
  id: string;
  operatorId: string;
  callsign: string;
  type: 'BUG' | 'RECOMMENDATION' | 'UI/UX' | 'PERFORMANCE';
  category: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  screenshot?: string;
  timestamp: string;
  status: FeedbackStatus;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  NEW: '#ff4444',
  REVIEWING: '#ffb800',
  FIXED: '#00ff41',
  WONTFIX: '#888',
};

const OpsCenter: React.FC<OpsCenterProps> = ({ currentUser, operators }) => {
  const [activeTab, setActiveTab] = useState<OpsTab>('REVENUE');
  const [metrics, setMetrics] = useState<DbMetrics | null>(null);
  /** Optimistic overrides for feedback status. Keyed by feedback id; merged
   *  on top of the operator-prop snapshot until the parent re-fetches. */
  const [feedbackOverrides, setFeedbackOverrides] = useState<Record<string, FeedbackStatus>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [selectedOperatorForPromo, setSelectedOperatorForPromo] = useState<string | null>(null);

  // Verify access
  if (!OPS_CENTER_ACCESS.includes(currentUser.id)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4444', fontFamily: '"Orbitron", sans-serif' }}>
        ACCESS DENIED — CLASSIFIED
      </div>
    );
  }

  // Fetch real metrics from DB
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`/api/ops?operatorId=${currentUser.id}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('[OpsCenter:fetchMetrics] Failed:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMetrics(); }, []);

  // Auto-refresh sources so the roster is always current:
  //   - Tab refocus (visibilitychange): catches the case where admin
  //     creates an operator in a sibling tab/terminal then comes back
  //   - 60s polling while tab is visible: bounded staleness without
  //     hammering the API
  //   - After local mutations (handleTierChange, handleGrantVanguard,
  //     etc.): wired in each handler below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchMetrics();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMetrics();
      }
    }, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  // Use DB metrics when available, fall back to client-side operators array.
  //
  // `displayOperators` is the single source of truth for roster rendering,
  // KPI counts, tier distribution, and revenue. Prefers /api/ops (which
  // refetches every 60s + on tab refocus + after each mutation) so a
  // newly-created operator (e.g. via SQL or /api/admin/create-operator)
  // appears within one polling cycle without requiring a page reload.
  const opStats = metrics?.operators.operatorStats || [];
  type DisplayOp = {
    id: string; callsign: string; name: string; role: string; tier: string;
    email?: string | null; tierLocked?: boolean; isVanguard?: boolean;
    betaUser?: boolean; trainerId?: string | null; promoActive?: boolean;
    googleId?: string | null;
    /**
     * Stripe billing status from operator.billing.status. Only 'active'
     * counts as paying revenue. NULL / 'beta' / 'cancelled' / 'past_due'
     * all evaluate to non-paying. Source of truth for the Revenue tab.
     */
    billingStatus?: string | null;
  };
  const displayOperators: DisplayOp[] = opStats.length > 0
    ? opStats
    : operators as unknown as DisplayOp[];
  const trainers = displayOperators.filter(op => op.role === 'trainer');
  const clients = displayOperators.filter(op => op.role === 'client');
  const chatsByOperator = metrics?.chatsByOperator || {};

  // ═══════════════════════════════════════
  // REVENUE CALCULATIONS (DB-fresh via displayOperators + TIER_CONFIGS)
  //
  // Paying status is gated on a positive Stripe signal:
  // billing.status === 'active'. The previous version inferred PAID
  // by the absence of exemption flags (no betaUser / no vanguard / no
  // promo → PAID) which let any operator missing all three flags
  // through, even when there was no Stripe subscription. Closed beta
  // had several operators that didn't have betaUser=true set yet but
  // weren't paying either — those rows showed up as PAID.
  //
  // The forecast endpoint at /api/financials/forecast already uses
  // billing.status === 'active' as the gate — this brings the Revenue
  // tab in line with that single source of truth.
  //
  // Why split paid vs total:
  //   - MRR / ARR / Trainer Payout / Platform Revenue / Stripe Fees
  //     come from money the platform actually receives → paid count.
  //   - API Cost / Infra Cost hit on usage regardless of payment
  //     status (we still pay Anthropic when a beta user chats with
  //     Gunny) → total count.
  // ═══════════════════════════════════════
  const isPayingClient = (op: DisplayOp): boolean => {
    if (op.role !== 'client') return false;
    return op.billingStatus === 'active';
  };

  const revenueByTier = (Object.keys(TIER_CONFIGS) as AiTier[]).reduce((acc, tier) => {
    const allOnTier = displayOperators.filter(c => c.role === 'client' && c.tier === tier);
    const paidOnTier = allOnTier.filter(isPayingClient);
    const totalCount = allOnTier.length;
    const paidCount = paidOnTier.length;
    const config = TIER_CONFIGS[tier];
    acc[tier] = {
      count: totalCount,
      paidCount,
      // Revenue lines: paid only.
      mrr: paidCount * config.monthlyPrice,
      trainerPayout: paidCount * config.trainerShare,
      platformRevenue: paidCount * config.platformShare,
      stripeFees: paidCount * config.stripeFee,
      // Cost lines: every user hits the API, infra scales with totals.
      apiCost: totalCount * config.apiCostEstimate,
      infraCost: totalCount * config.infraCost,
    };
    return acc;
  }, {} as Record<AiTier, { count: number; paidCount: number; mrr: number; trainerPayout: number; platformRevenue: number; apiCost: number; stripeFees: number; infraCost: number }>);

  const totalMRR = Object.values(revenueByTier).reduce((sum, t) => sum + t.mrr, 0);
  const totalTrainerPayout = Object.values(revenueByTier).reduce((sum, t) => sum + t.trainerPayout, 0);
  const totalPlatformRevenue = Object.values(revenueByTier).reduce((sum, t) => sum + t.platformRevenue, 0);
  const totalApiCost = Object.values(revenueByTier).reduce((sum, t) => sum + t.apiCost, 0);
  const totalStripeFees = Object.values(revenueByTier).reduce((sum, t) => sum + t.stripeFees, 0);
  const totalInfraCost = Object.values(revenueByTier).reduce((sum, t) => sum + t.infraCost, 0);
  const totalARR = totalMRR * 12;
  const netProfit = totalPlatformRevenue - totalApiCost - totalStripeFees - totalInfraCost;
  const paidClientCount = clients.filter(isPayingClient).length;
  const betaClientCount = clients.filter(c => c.betaUser && !c.tierLocked).length;

  // ═══════════════════════════════════════
  // LIVE DATA BADGE
  // ═══════════════════════════════════════
  const LiveBadge = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px', background: 'rgba(0,255,65,0.06)',
        border: '1px solid rgba(0,255,65,0.15)', fontSize: '10px',
        fontFamily: '"Share Tech Mono", monospace', color: '#00ff41',
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 6px #00ff41' }} />
        LIVE FROM DB
      </div>
      {lastRefresh && (
        <span style={{ color: '#333', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px' }}>
          REFRESHED {lastRefresh}
        </span>
      )}
      <button
        onClick={fetchMetrics}
        disabled={metricsLoading}
        style={{
          padding: '3px 8px', fontSize: '10px', fontFamily: '"Share Tech Mono", monospace',
          color: '#555', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer',
        }}
      >
        {metricsLoading ? 'LOADING...' : 'REFRESH'}
      </button>
    </div>
  );

  // Handle tier change. Slim PATCH-style body — only the tier field.
  // The /api/operators/:id PUT handler uses pickFields to whitelist
  // updatable columns by role, so sending only `{tier}` is the safe
  // and correct way to change one column without risking accidental
  // overwrite of stale spread fields.
  const handleTierChange = async (operatorId: string, newTier: AiTier) => {
    try {
      const res = await fetch(`/api/operators/${operatorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ tier: newTier }),
      });
      if (res.ok) {
        fetchMetrics();
      }
    } catch (err) {
      console.error('[OpsCenter:handleTierChange] Failed:', err);
    }
  };

  // Handle activate beta — slim PATCH per operator. Reads from
  // displayOperators (DB-fresh) so newly-created operators get the
  // beta flag too.
  const handleActivateBeta = async () => {
    try {
      const today = new Date();
      const betaEnd = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
      const patch = {
        betaUser: true,
        betaStartDate: today.toISOString().split('T')[0],
        betaEndDate: betaEnd.toISOString().split('T')[0],
      };
      for (const op of displayOperators.filter(o => o.role !== 'trainer')) {
        await fetch(`/api/operators/${op.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify(patch),
        });
      }
      fetchMetrics();
    } catch (err) {
      console.error('[OpsCenter:handleActivateBeta] Failed:', err);
    }
  };

  // Handle lock all tiers — slim PATCH.
  const handleLockAllTiers = async () => {
    try {
      for (const op of displayOperators) {
        await fetch(`/api/operators/${op.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({ tierLocked: true }),
        });
      }
      fetchMetrics();
    } catch (err) {
      console.error('[OpsCenter:handleLockAllTiers] Failed:', err);
    }
  };

  // Handle grant vanguard — slim PATCH.
  const handleGrantVanguard = async (operatorId: string) => {
    try {
      await fetch(`/api/operators/${operatorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ isVanguard: true }),
      });
      fetchMetrics();
    } catch (err) {
      console.error('[OpsCenter:handleGrantVanguard] Failed:', err);
    }
  };

  // Handle reset all accounts
  const handleResetAllAccounts = async () => {
    if (!window.confirm('Are you sure? This will reset all accounts except op-ruben.')) {
      return;
    }
    try {
      const res = await fetch('/api/ops/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          operatorId: currentUser.id,
          excludeIds: ['op-ruben'],
        }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('[OpsCenter:handleResetAllAccounts] Failed:', err);
    }
  };

  // Handle promo
  const handleOfferPromo = async (promoType: 'recon' | 'operator') => {
    if (!selectedOperatorForPromo) return;
    try {
      const op = operators.find(o => o.id === selectedOperatorForPromo);
      if (!op) return;

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);

      const updated = {
        ...op,
        promoActive: true,
        promoType,
        promoExpiry: expiry.toISOString().split('T')[0],
      };
      await fetch(`/api/operators/${selectedOperatorForPromo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(updated),
      });
      setSelectedOperatorForPromo(null);
      fetchMetrics();
    } catch (err) {
      console.error('[OpsCenter:handleOfferPromo] Failed:', err);
    }
  };

  // ═══════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════
  const renderRevenue = () => {
    // Sort operators by est cost descending
    const costPerUserData = operators.map(op => {
      const workouts = opStats.find(s => s.id === op.id)?.workoutCount || 0;
      const messages = chatsByOperator[op.id] || 0;
      const estTokens = messages * 500;
      const estCost = (estTokens / 1000000) * 3;

      // Status priority — only PAID when Stripe says so. Everything
      // else falls through the descriptive flags. NOT ACTIVE is the
      // catch-all for operators sitting in the DB without a billing
      // status and without any of the exemption flags set yet.
      const opAsDisplay = op as unknown as DisplayOp;
      let status: 'PAID' | 'BETA FREE' | 'VANGUARD' | 'PROMO' | 'NOT ACTIVE';
      if (opAsDisplay.billingStatus === 'active') {
        status = 'PAID';
      } else if (op.betaUser && !op.tierLocked) {
        status = 'BETA FREE';
      } else if (op.isVanguard) {
        status = 'VANGUARD';
      } else if (op.promoActive) {
        status = 'PROMO';
      } else {
        status = 'NOT ACTIVE';
      }

      return {
        id: op.id,
        callsign: op.callsign,
        tier: op.tier,
        workouts,
        messages,
        estTokens,
        estCost,
        status,
      };
    }).sort((a, b) => b.estCost - a.estCost);

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        {/* Top-level KPIs.
            MRR / ARR / Trainer Payout count PAID clients only — beta,
            vanguard, and promo accounts are exempted. PAID CLIENTS is
            shown alongside TOTAL CLIENTS so the gap is obvious at a
            glance: if the cohort is 17 total / 0 paid, MRR is correctly
            $0 instead of an inflated tier-mix theoretical. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="MRR (PAID)" value={`$${totalMRR.toFixed(2)}`} color={totalMRR > 0 ? '#00ff41' : '#555'} />
          <KPICard label="ARR (PAID)" value={`$${totalARR.toFixed(2)}`} color={totalARR > 0 ? '#00ff41' : '#555'} />
          <KPICard label="NET PROFIT/MO" value={`$${netProfit.toFixed(2)}`} color={netProfit > 0 ? '#00ff41' : '#ff4444'} />
          <KPICard label="TOTAL CLIENTS" value={String(clients.length)} color="#00ff41" />
          <KPICard label="PAID CLIENTS" value={`${paidClientCount} / ${clients.length}`} color={paidClientCount > 0 ? '#00ff41' : '#888'} />
          <KPICard label="BETA (FREE)" value={String(betaClientCount)} color="#ff00ff" />
          <KPICard label="TRAINER PAYOUT" value={`$${totalTrainerPayout.toFixed(2)}/mo`} color="#ffb800" />
          <KPICard label="API COST" value={`$${totalApiCost.toFixed(2)}/mo`} color="#ff4444" />
        </div>

        {/* Revenue by Tier */}
        <SectionHeader title="REVENUE BY TIER" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
                {['TIER', 'USERS', 'PAID', 'PRICE', 'MRR', 'TRAINER $', 'PLATFORM $', 'API COST', 'STRIPE', 'MARGIN'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', color: '#555', textAlign: 'left', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => {
                const config = TIER_CONFIGS[tier];
                const data = revenueByTier[tier];
                const margin = data.mrr > 0 ? ((data.platformRevenue - data.apiCost - data.stripeFees - data.infraCost) / data.mrr * 100) : 0;
                // Dim the all-zero rows so the eye lands on whichever tier
                // has actual paid users (none today, but ready for when
                // beta lifts).
                const dim = data.paidCount === 0;
                return (
                  <tr key={tier} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: dim ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 8px', color: tierColor(tier), fontWeight: 700 }}>{config.codename}</td>
                    <td style={{ padding: '10px 8px', color: '#ddd' }}>{data.count}</td>
                    <td style={{ padding: '10px 8px', color: data.paidCount > 0 ? '#00ff41' : '#555' }}>{data.paidCount}</td>
                    <td style={{ padding: '10px 8px', color: '#888' }}>${config.monthlyPrice}</td>
                    <td style={{ padding: '10px 8px', color: data.mrr > 0 ? '#00ff41' : '#555' }}>${data.mrr.toFixed(2)}</td>
                    <td style={{ padding: '10px 8px', color: data.trainerPayout > 0 ? '#ffb800' : '#555' }}>${data.trainerPayout.toFixed(2)}</td>
                    <td style={{ padding: '10px 8px', color: data.platformRevenue > 0 ? '#00ff41' : '#555' }}>${data.platformRevenue.toFixed(2)}</td>
                    <td style={{ padding: '10px 8px', color: data.apiCost > 0 ? '#ff4444' : '#555' }}>${data.apiCost.toFixed(2)}</td>
                    <td style={{ padding: '10px 8px', color: '#888' }}>${data.stripeFees.toFixed(2)}</td>
                    <td style={{ padding: '10px 8px', color: data.mrr === 0 ? '#555' : margin > 50 ? '#00ff41' : margin > 30 ? '#ffb800' : '#ff4444' }}>{data.mrr === 0 ? '—' : `${margin.toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Cost/Burden Per User */}
        <SectionHeader title="COST/BURDEN PER USER" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
                {['CALLSIGN', 'TIER', 'WORKOUTS', 'MESSAGES', 'EST TOKENS', 'EST COST ($)', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', color: '#555', textAlign: 'left', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costPerUserData.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 8px', color: '#ddd', fontWeight: 600 }}>{row.callsign}</td>
                  <td style={{ padding: '10px 8px', color: tierColor(row.tier) }}>{row.tier}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>{row.workouts}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>{row.messages}</td>
                  <td style={{ padding: '10px 8px', color: '#00ff41' }}>{row.estTokens.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', color: row.estCost > 10 ? '#ff4444' : '#00ff41' }}>${row.estCost.toFixed(2)}</td>
                  <td style={{
                    padding: '10px 8px',
                    color:
                      row.status === 'PAID'       ? '#00ff41' :
                      row.status === 'VANGUARD'   ? '#ff00ff' :
                      row.status === 'BETA FREE'  ? '#00ff41' :
                      row.status === 'PROMO'      ? '#ffb800' :
                      row.status === 'NOT ACTIVE' ? '#ff4444' :
                      '#888',
                  }}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trainer Revenue Breakdown — DB-fresh via displayOperators
            (the previous version used the stale `operators` prop, so a
            newly-assigned client wouldn't show in the trainer's row
            until the parent re-fetched). Only PAID clients contribute
            to trainerMRR; the chip shows "X clients (Y paid)" so the
            gap between cohort size and active payout is visible. */}
        <SectionHeader title="TRAINER PAYOUT BREAKDOWN" />
        {displayOperators.filter(op => op.role === 'trainer').map(trainer => {
          const trainerClients = displayOperators.filter(op => op.trainerId === trainer.id);
          const paidTrainerClients = trainerClients.filter(isPayingClient);
          const trainerMRR = paidTrainerClients.reduce(
            (sum, c) => sum + (TIER_CONFIGS[c.tier as AiTier]?.trainerShare || 0),
            0,
          );
          return (
            <div key={trainer.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div>
                <span style={{ color: '#ddd', fontFamily: '"Chakra Petch", sans-serif', fontSize: '14px' }}>{trainer.callsign}</span>
                <span style={{ color: '#555', fontSize: '12px', marginLeft: '8px' }}>
                  ({trainerClients.length} clients · {paidTrainerClients.length} paid)
                </span>
              </div>
              <span style={{ color: trainerMRR > 0 ? '#ffb800' : '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '14px' }}>
                ${trainerMRR.toFixed(2)}/mo
              </span>
            </div>
          );
        })}

        {/* Projections.
            Two ARPU sources, picked by data availability:
              1. ACTUAL ARPU = totalMRR / paidClientCount.
                 Used once we have any paid users — that's our real
                 conversion picture.
              2. THEORETICAL ARPU = sum(monthlyPrice for current tier
                 mix) / clients.length.
                 Used during closed beta when paidClientCount is 0.
                 Answers: "if every current operator converted to paid
                 at their assigned tier, what would the cohort look
                 like?" — useful for sizing pricing decisions.
            The header label tells you which one is feeding the math
            so the projections aren't read as a forecast they're not. */}
        {(() => {
          const actualARPU = paidClientCount > 0 ? totalMRR / paidClientCount : 0;
          const theoreticalARPU = clients.length > 0
            ? clients.reduce(
                (sum, c) => sum + (TIER_CONFIGS[c.tier as AiTier]?.monthlyPrice || 0),
                0,
              ) / clients.length
            : 0;
          const projectionARPU = actualARPU > 0 ? actualARPU : theoreticalARPU;
          const arpuSource = actualARPU > 0
            ? `ACTUAL ARPU $${actualARPU.toFixed(2)} (paid clients)`
            : `THEORETICAL ARPU $${theoreticalARPU.toFixed(2)} (current tier mix at full price)`;
          return (
            <>
              <SectionHeader title="GROWTH PROJECTIONS" />
              <div style={{
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: '11px',
                color: '#666',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}>
                {arpuSource}
                {actualARPU === 0 && ' — assumes 100% conversion if beta lifted today'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {[25, 50, 100, 250, 500].map(count => {
                  const projected = count * projectionARPU;
                  return (
                    <div key={count} style={{
                      padding: '12px 16px', background: 'rgba(0,255,65,0.02)', border: '1px solid rgba(0,255,65,0.06)',
                    }}>
                      <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>{count} USERS</div>
                      <div style={{ color: '#00ff41', fontFamily: '"Orbitron", sans-serif', fontSize: '18px', fontWeight: 700 }}>${projected.toFixed(0)}/mo</div>
                      <div style={{ color: '#333', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>${(projected * 12).toFixed(0)}/yr</div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
    );
  };

  const renderUsers = () => {
    // Use DB stats when available for real activity data
    const dbStats = metrics?.operators;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={handleActivateBeta}
            style={{
              padding: '8px 16px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#00ff41', background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.2)',
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >
            ACTIVATE BETA
          </button>
          <button
            onClick={handleLockAllTiers}
            style={{
              padding: '8px 16px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#ffb800', background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)',
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >
            LOCK ALL TIERS
          </button>
          <button
            onClick={handleResetAllAccounts}
            style={{
              padding: '8px 16px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#ff4444', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >
            RESET ALL ACCOUNTS
          </button>
        </div>

        {/* User KPIs — DB-fresh via displayOperators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="TOTAL OPERATORS" value={String(dbStats?.total ?? displayOperators.length)} color="#00ff41" />
          <KPICard label="TRAINERS" value={String(dbStats?.trainers ?? trainers.length)} color="#ffb800" />
          <KPICard label="CLIENTS" value={String(dbStats?.clients ?? clients.length)} color="#00ff41" />
          <KPICard label="ACTIVE (7D)" value={String(dbStats?.active7d ?? 0)} color={dbStats?.active7d ? '#00ff41' : '#ff4444'} />
          <KPICard label="BETA USERS" value={String(dbStats?.beta ?? displayOperators.filter(o => o.betaUser).length)} color="#ff00ff" />
          <KPICard label="ACTIVATED" value={`${displayOperators.filter(o => !!o.email).length}/${dbStats?.total ?? displayOperators.length}`} color="#00ff41" />
        </div>

        {/* Tier Distribution */}
        <SectionHeader title="TIER DISTRIBUTION" />
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => {
            const count = displayOperators.filter(op => op.tier === tier).length;
            const total = dbStats?.total ?? displayOperators.length;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={tier} style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${tierColor(tier)}20`, flex: '1 1 120px' }}>
                <div style={{ color: tierColor(tier), fontFamily: '"Orbitron", sans-serif', fontSize: '11px', letterSpacing: '2px' }}>
                  {TIER_CONFIGS[tier].codename}
                </div>
                <div style={{ color: tierColor(tier), fontFamily: '"Orbitron", sans-serif', fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {count}
                </div>
                <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', marginTop: '2px' }}>
                  {pct}% of {total}
                </div>
              </div>
            );
          })}
        </div>

        {/* Roster with Tier Management — DB-fresh via displayOperators.
            Auto-refreshes every 60s + on tab refocus + after each
            mutation. EMAIL column doubles as the activation indicator
            for the closed-beta allowlist (NULL = locked out). GOOGLE
            shows whether the operator has linked their Google account
            for OAuth sign-in. */}
        <SectionHeader title="OPERATOR ROSTER" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
                {['CALLSIGN', 'NAME', 'ROLE', 'EMAIL', 'GOOGLE', 'TIER', 'LOCKED', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', color: '#555', textAlign: 'left', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayOperators.map(op => (
                <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 8px', color: '#ddd', fontWeight: 600 }}>{op.callsign}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>{op.name || '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>{op.role}</td>
                  <td style={{ padding: '10px 8px', color: op.email ? '#aaa' : '#ff4444', fontSize: 11 }}>
                    {op.email || '— LOCKED'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', color: op.googleId ? '#00ff41' : '#444', fontSize: 14 }}>
                    {op.googleId ? '✓' : '·'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {op.tierLocked ? (
                      <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon.Lock size={11} /> {op.tier}
                      </span>
                    ) : (
                      <select
                        value={op.tier}
                        onChange={(e) => handleTierChange(op.id, e.target.value as AiTier)}
                        style={{
                          padding: '4px 6px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
                          color: tierColor(op.tier), background: 'rgba(0,0,0,0.3)',
                          border: `1px solid ${tierColor(op.tier)}30`, cursor: 'pointer',
                        }}
                      >
                        {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => (
                          <option key={tier} value={tier}>{TIER_CONFIGS[tier].codename}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', color: op.tierLocked ? '#ffb800' : '#555' }}>
                    {op.tierLocked ? 'YES' : 'NO'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {op.betaUser && !op.isVanguard && (
                      <button
                        onClick={() => handleGrantVanguard(op.id)}
                        style={{
                          padding: '2px 8px', fontSize: '10px', fontFamily: '"Share Tech Mono", monospace',
                          color: '#ff00ff', background: 'rgba(255,0,255,0.08)', border: '1px solid rgba(255,0,255,0.2)',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        VANGUARD
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPlatform = () => {
    const dbPlatform = metrics?.platform;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        {/* Platform KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="TOTAL WORKOUTS" value={String(dbPlatform?.totalWorkouts ?? 0)} color="#00ff41" />
          <KPICard label="TOTAL MEALS" value={String(dbPlatform?.totalMeals ?? 0)} color="#00ff41" />
          <KPICard label="TOTAL PRs" value={String(dbPlatform?.totalPRs ?? 0)} color="#ffb800" />
          <KPICard label="INJURIES" value={String(dbPlatform?.totalInjuries ?? 0)} color="#ff4444" />
          <KPICard label="ACTIVE WEARABLES" value={String(dbPlatform?.activeWearables ?? 0)} color="#ff00ff" />
        </div>

        {/* Platform Details */}
        <SectionHeader title="PLATFORM METRICS" />
        <StatusRow label="Total Workouts" status={String(dbPlatform?.totalWorkouts ?? 0)} color="#00ff41" />
        <StatusRow label="Total Meals Logged" status={String(dbPlatform?.totalMeals ?? 0)} color="#00ff41" />
        <StatusRow label="Personal Records" status={String(dbPlatform?.totalPRs ?? 0)} color="#ffb800" />
        <StatusRow label="Injury Reports" status={String(dbPlatform?.totalInjuries ?? 0)} color="#ff4444" />
        <StatusRow label="Wearable Devices" status={String(dbPlatform?.activeWearables ?? 0)} color="#ff00ff" />
      </div>
    );
  };

  /**
   * Flip the status of a single beta-feedback entry via PATCH. Optimistic —
   * merge the new status into local feedbackOverrides immediately so the
   * row re-renders, then call the server. On failure, the override is
   * rolled back and we surface a console error (no toast system here yet).
   */
  const handleFeedbackStatusChange = async (id: string, next: FeedbackStatus, resolutionNote?: string) => {
    setFeedbackOverrides(prev => ({ ...prev, [id]: next }));
    try {
      const res = await fetch('/api/beta-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ id, status: next, resolutionNote }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[OpsCenter:feedbackStatus] PATCH failed', err);
        setFeedbackOverrides(prev => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    } catch (e) {
      console.error('[OpsCenter:feedbackStatus] network error', e);
      setFeedbackOverrides(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const renderBeta = () => {
    const betaOps = operators.map(op => ({
      ...op, createdAt: '', updatedAt: '',
    })).filter(op => op.betaUser);

    // Parse betaFeedback (array of JSON strings) into typed entries. Skip
    // malformed rows so one bad write doesn't blank the whole list.
    const allFeedback: Array<ParsedFeedback & { tier: string }> = [];
    for (const op of operators) {
      if (!Array.isArray(op.betaFeedback)) continue;
      for (const raw of op.betaFeedback) {
        try {
          const parsed = JSON.parse(raw) as ParsedFeedback;
          if (parsed && typeof parsed === 'object' && parsed.id) {
            // Apply the in-flight optimistic override if any.
            if (feedbackOverrides[parsed.id]) parsed.status = feedbackOverrides[parsed.id];
            allFeedback.push({ ...parsed, tier: op.tier });
          }
        } catch { /* malformed — skip */ }
      }
    }
    // Newest first.
    allFeedback.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const dbBeta = metrics?.operators;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="BETA USERS" value={String(dbBeta?.beta ?? betaOps.length)} color="#ff00ff" />
          <KPICard label="TOTAL FEEDBACK" value={String(allFeedback.length)} color="#00ff41" />
          <KPICard label="PROFILE COMPLETE" value={`${betaOps.filter(op => op.profile?.age && op.profile?.weight).length}/${betaOps.length}`} color="#00ff41" />
        </div>

        {/* Promotions */}
        <SectionHeader title="PROMOTIONS" />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedOperatorForPromo || ''}
            onChange={(e) => setSelectedOperatorForPromo(e.target.value || null)}
            style={{
              padding: '6px 10px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#ddd', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            <option value="">Select operator...</option>
            {operators.filter(op => op.betaUser).map(op => (
              <option key={op.id} value={op.id}>{op.callsign}</option>
            ))}
          </select>
          <button
            onClick={() => handleOfferPromo('recon')}
            disabled={!selectedOperatorForPromo}
            style={{
              padding: '6px 12px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#ffb800', background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.2)',
              cursor: selectedOperatorForPromo ? 'pointer' : 'not-allowed', opacity: selectedOperatorForPromo ? 1 : 0.5,
              letterSpacing: '1px',
            }}
          >
            OFFER FREE MONTH — RECON TIER
          </button>
          <button
            onClick={() => handleOfferPromo('operator')}
            disabled={!selectedOperatorForPromo}
            style={{
              padding: '6px 12px', fontSize: '12px', fontFamily: '"Share Tech Mono", monospace',
              color: '#00ff41', background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.2)',
              cursor: selectedOperatorForPromo ? 'pointer' : 'not-allowed', opacity: selectedOperatorForPromo ? 1 : 0.5,
              letterSpacing: '1px',
            }}
          >
            OFFER FREE MONTH — OPERATOR TIER
          </button>
        </div>

        <SectionHeader title="BETA ROSTER" />
        {betaOps.map(op => {
          const fbCount = operators.find(o => o.id === op.id)?.betaFeedback?.length || 0;
          const profiled = !!(op.profile?.age && op.profile?.weight);
          return (
            <div key={op.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: tierColor(op.tier), fontWeight: 600, fontFamily: '"Chakra Petch", sans-serif' }}>{op.callsign}</span>
                <span style={{ color: '#555', fontSize: '12px' }}>{op.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>
                  {fbCount} feedback{fbCount !== 1 ? 's' : ''}
                </span>
                <span style={{
                  padding: '2px 8px', fontSize: '10px', fontFamily: '"Share Tech Mono", monospace',
                  background: profiled ? 'rgba(0,255,65,0.08)' : 'rgba(255,68,68,0.08)',
                  color: profiled ? '#00ff41' : '#ff4444',
                  border: `1px solid ${profiled ? 'rgba(0,255,65,0.15)' : 'rgba(255,68,68,0.15)'}`,
                }}>
                  {profiled ? 'PROFILED' : 'INCOMPLETE'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Feedback Log */}
        <SectionHeader title="FEEDBACK LOG" />
        {allFeedback.length === 0 ? (
          <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', padding: '16px 0' }}>
            No feedback submitted yet.
          </div>
        ) : (
          allFeedback.map((fb) => (
            <div key={fb.id} style={{
              padding: '12px 16px', marginBottom: '8px',
              background: 'rgba(0,255,65,0.03)', border: '1px solid rgba(0,255,65,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: tierColor(fb.tier as AiTier), fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', fontWeight: 600 }}>{fb.callsign}</span>
                  <span style={{ color: '#888', fontSize: '11px', fontFamily: '"Share Tech Mono", monospace' }}>{fb.type}</span>
                  <span style={{ color: '#888', fontSize: '11px', fontFamily: '"Share Tech Mono", monospace' }}>{fb.category}</span>
                </div>
                <span style={{
                  color: STATUS_COLOR[fb.status] || '#888',
                  border: `1px solid ${STATUS_COLOR[fb.status] || '#888'}40`,
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontFamily: '"Share Tech Mono", monospace',
                  letterSpacing: '1px',
                }}>{fb.status}</span>
              </div>
              <div style={{ color: '#ddd', fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{fb.description}</div>
              {fb.resolutionNote && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(0,255,65,0.04)', borderLeft: '2px solid #00ff41', color: '#aaa', fontSize: '12px', fontFamily: '"Chakra Petch", sans-serif' }}>
                  Resolution: {fb.resolutionNote}
                </div>
              )}
              <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px', marginTop: '6px' }}>
                {new Date(fb.timestamp).toLocaleString()}
                {fb.resolvedAt && ` · resolved ${new Date(fb.resolvedAt).toLocaleDateString()}`}
              </div>
              {/* Admin status controls. OpsCenter is already gated to OPS_CENTER_ACCESS
                  in the parent so the buttons are safe to render unconditionally here. */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(['NEW', 'REVIEWING', 'FIXED', 'WONTFIX'] as FeedbackStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (s === fb.status) return;
                      const note = (s === 'FIXED' || s === 'WONTFIX')
                        ? (window.prompt(`Optional resolution note for ${fb.callsign}'s ${fb.type}:`) || undefined)
                        : undefined;
                      handleFeedbackStatusChange(fb.id, s, note);
                    }}
                    disabled={s === fb.status}
                    style={{
                      padding: '4px 10px',
                      fontSize: '10px',
                      fontFamily: '"Share Tech Mono", monospace',
                      letterSpacing: '1px',
                      background: s === fb.status ? `${STATUS_COLOR[s]}20` : 'transparent',
                      color: STATUS_COLOR[s],
                      border: `1px solid ${STATUS_COLOR[s]}60`,
                      cursor: s === fb.status ? 'default' : 'pointer',
                      opacity: s === fb.status ? 0.5 : 1,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderMarketing = () => (
    <div style={{ padding: '20px' }}>
      {/* MANUAL-MODE BANNER (May 2026) — until paid revenue arrives,
          marketing posting is human-driven. The provider integration
          (Buffer / Hootsuite / Publer) costs ~$12-30/mo + dev time
          and isn't justified during closed beta. The cards below
          stay visible so we have a checklist of what's coming and a
          place to paste links once we wire it. */}
      <div style={{
        background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.25)',
        padding: '16px 20px', marginBottom: '24px',
      }}>
        <div style={{ color: '#ff8c00', fontFamily: '"Orbitron", sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px' }}>
          MARKETING — MANUAL MODE
        </div>
        <div style={{ color: '#bbb', fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', lineHeight: '1.6' }}>
          Posting is manual during the closed beta. Platform integrations (one provider covering all six channels) ship once paid revenue justifies the ~$12-30/mo provider fee + dev time. For now, post directly from each platform&apos;s native app and use the cards below as a reference of what&apos;s on the roadmap.
        </div>
      </div>

      <SectionHeader title="SOCIAL PLATFORMS" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {MARKETING_PLATFORMS.map(platform => (
          <div key={platform.slug} style={{
            padding: '16px', background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${platform.connected ? platform.color + '30' : 'rgba(255,255,255,0.05)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: platform.connected ? platform.color : '#333' }} />
                <span style={{ color: platform.connected ? platform.color : '#888', fontFamily: '"Chakra Petch", sans-serif', fontSize: '15px', fontWeight: 600 }}>
                  {platform.name}
                </span>
              </div>
              <span style={{
                padding: '2px 8px', fontSize: '10px', fontFamily: '"Share Tech Mono", monospace',
                background: platform.connected ? `${platform.color}15` : 'rgba(255,255,255,0.03)',
                color: platform.connected ? platform.color : '#555',
                border: `1px solid ${platform.connected ? platform.color + '25' : 'rgba(255,255,255,0.06)'}`,
              }}>
                {platform.connected ? 'CONNECTED' : 'NOT CONNECTED'}
              </span>
            </div>
            <div style={{ color: '#666', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px', marginBottom: '8px' }}>
              {platform.description}
            </div>
            <div style={{ color: '#333', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px' }}>
              API: {platform.apiEndpoint || 'Not configured'}
            </div>
          </div>
        ))}
      </div>

      {/* Marketing API Config */}
      <SectionHeader title="API CONFIGURATION" />
      <div style={{
        padding: '16px 20px', background: 'rgba(0,255,65,0.02)', border: '1px solid rgba(0,255,65,0.08)',
        marginBottom: '16px',
      }}>
        <div style={{ color: '#888', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', lineHeight: '1.8' }}>
          <div style={{ color: '#00ff41', fontWeight: 700, marginBottom: '8px' }}>WEBHOOK ENDPOINT (for marketing agent):</div>
          <code style={{ color: '#00ff41', background: 'rgba(0,255,65,0.08)', padding: '4px 8px' }}>
            POST /api/marketing/publish
          </code>
          <div style={{ marginTop: '12px', color: '#555' }}>
            Expected payload:
          </div>
          <pre style={{ color: '#666', fontSize: '11px', marginTop: '4px', padding: '12px', background: 'rgba(0,0,0,0.3)', overflow: 'auto' }}>
{`{
  "platform": "instagram|tiktok|twitter|...",
  "content": {
    "text": "Post caption or tweet text",
    "media_url": "URL to image/video",
    "scheduled_at": "ISO8601 datetime or null",
    "hashtags": ["array", "of", "tags"]
  },
  "campaign_id": "optional campaign grouping"
}`}
          </pre>
        </div>
      </div>

      <SectionHeader title="SCHEDULED POSTS" />
      <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', padding: '16px 0' }}>
        No scheduled posts. Connect platforms and use the marketing agent to create and schedule content.
      </div>

      <SectionHeader title="CONTENT CALENDAR" />
      <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', padding: '16px 0' }}>
        Calendar view will populate once content is scheduled through the marketing API.
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'REVENUE': return renderRevenue();
      case 'USERS': return renderUsers();
      case 'PLATFORM': return renderPlatform();
      case 'BETA': return renderBeta();
      case 'MARKETING': return renderMarketing();
      case 'ROADMAP':
        // Defensive: even if activeTab is set to ROADMAP (state replay,
        // dev hot-reload, etc.), the data only renders for founders.
        return FOUNDER_IDS.includes(currentUser.id as typeof FOUNDER_IDS[number])
          ? <OpsRoadmap />
          : null;
      default: return null;
    }
  };

  // Tab metadata for the OpsCenter top strip — character glyphs were
  // replaced with SVG icons so the admin chrome stays on-brand. The
  // "$" for REVENUE is left as a glyph since there's no money icon
  // in the design-system set yet; we render it inside a styled span
  // so it visually matches the SVG siblings.
  // ROADMAP is conditionally appended — only the two founders
  // (op-ruben + op-britney) ever see it.
  const isFounder = FOUNDER_IDS.includes(currentUser.id as typeof FOUNDER_IDS[number]);
  const tabConfig: { id: OpsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'REVENUE', label: 'REVENUE', icon: <span className="t-mono" style={{ fontSize: 14 }}>$</span> },
    { id: 'USERS', label: 'USERS', icon: <Icon.User /> },
    { id: 'PLATFORM', label: 'PLATFORM', icon: <Icon.Settings /> },
    { id: 'BETA', label: 'BETA', icon: <Icon.Bolt /> },
    { id: 'MARKETING', label: 'MARKETING', icon: <Icon.Send /> },
    ...(isFounder ? [{ id: 'ROADMAP' as OpsTab, label: 'ROADMAP', icon: <Icon.Target /> }] : []),
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#030303', color: '#ddd', fontFamily: '"Chakra Petch", sans-serif' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,0,0,0.1)',
        background: 'linear-gradient(180deg, rgba(20,0,0,0.6) 0%, rgba(3,3,3,0.98) 100%)',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: 900, color: '#fff',
          fontFamily: '"Orbitron", sans-serif',
          boxShadow: '0 0 16px rgba(255,68,68,0.3)',
        }}>
          O
        </div>
        <div>
          <div style={{ fontSize: '22px', fontFamily: '"Orbitron", sans-serif', color: '#ff4444', fontWeight: 900, letterSpacing: '3px', textShadow: '0 0 8px rgba(255,68,68,0.3)' }}>
            OPS CENTER
          </div>
          <div style={{ fontSize: '11px', fontFamily: '"Share Tech Mono", monospace', color: '#555', letterSpacing: '2px' }}>
            CLASSIFIED — {currentUser.callsign} ACCESS
          </div>
        </div>
      </div>

      {/* Sub-tabs.
          Six buttons wrap into 2 rows on narrow viewports instead of
          overflow-scrolling and getting clipped at the right edge
          (the previous version used overflowX:auto with no visible
          scroll indicator, so on mobile the sixth tab — ROADMAP —
          looked like a permanently-cut-off "ROADMA"). Each button
          has flex: 1 1 30% so three fit per row at ≤375px and they
          distribute evenly when the strip is wider. The icon is
          dropped on narrow viewports so the labels stay legible. */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,68,68,0.06)',
        background: 'rgba(255,0,0,0.01)',
      }}>
        {tabConfig.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1 1 30%',
                minWidth: 90,
                padding: '8px 10px',
                fontSize: '11px',
                fontFamily: '"Share Tech Mono", monospace',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '1px',
                color: isActive ? '#ff4444' : '#555',
                background: isActive ? 'rgba(255,68,68,0.08)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(255,68,68,0.2)' : 'rgba(255,255,255,0.04)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{ opacity: 0.7, display: 'inline-flex', alignItems: 'center' }}>
                {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: 12 })}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
};

// ═══════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════
const KPICard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '14px 16px', background: 'rgba(0,0,0,0.3)',
    border: `1px solid ${color}15`,
  }}>
    <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>
    <div style={{ color, fontFamily: '"Orbitron", sans-serif', fontSize: '20px', fontWeight: 700 }}>{value}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div style={{
    color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px',
    letterSpacing: '2px', padding: '16px 0 8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: '12px',
  }}>
    {title}
  </div>
);

const StatusRow: React.FC<{ label: string; status: string; color: string }> = ({ label, status, color }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.03)',
  }}>
    <span style={{ color: '#888', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px' }}>{label}</span>
    <span style={{ color, fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', fontWeight: 700 }}>{status}</span>
  </div>
);

const DataRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)',
  }}>
    <span style={{ color: '#666', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px' }}>{label}</span>
    <span style={{ color: '#ddd', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px' }}>{value}</span>
  </div>
);

const tierColor = (tier: AiTier | string): string => {
  switch (tier) {
    case 'haiku': return '#00ff41';
    case 'sonnet': return '#ffb800';
    case 'opus': return '#ff4444';
    case 'white_glove': return '#ff00ff';
    default: return '#888';
  }
};

export default OpsCenter;
