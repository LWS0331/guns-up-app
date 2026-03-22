'use client';

import React, { useState, useEffect } from 'react';
import { Operator, TIER_CONFIGS, AiTier, OPS_CENTER_ACCESS } from '@/lib/types';

type OpsTab = 'REVENUE' | 'USERS' | 'PLATFORM' | 'BETA' | 'MARKETING';

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
      betaUser: boolean;
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

const OpsCenter: React.FC<OpsCenterProps> = ({ currentUser, operators }) => {
  const [activeTab, setActiveTab] = useState<OpsTab>('REVENUE');
  const [metrics, setMetrics] = useState<DbMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

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
      const res = await fetch(`/api/ops?operatorId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch OPS metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMetrics(); }, []);

  // Use DB metrics when available, fall back to client-side operators array
  const opStats = metrics?.operators.operatorStats || [];
  const trainers = metrics ? opStats.filter(op => op.role === 'trainer') : operators.filter(op => op.role === 'trainer');
  const clients = metrics ? opStats.filter(op => op.role === 'client') : operators.filter(op => op.role === 'client');

  // ═══════════════════════════════════════
  // REVENUE CALCULATIONS (always from operators + TIER_CONFIGS)
  // ═══════════════════════════════════════
  const revenueByTier = (Object.keys(TIER_CONFIGS) as AiTier[]).reduce((acc, tier) => {
    const count = operators.filter(c => c.role === 'client' && c.tier === tier).length;
    const config = TIER_CONFIGS[tier];
    acc[tier] = {
      count,
      mrr: count * config.monthlyPrice,
      trainerPayout: count * config.trainerShare,
      platformRevenue: count * config.platformShare,
      apiCost: count * config.apiCostEstimate,
      stripeFees: count * config.stripeFee,
      infraCost: count * config.infraCost,
    };
    return acc;
  }, {} as Record<AiTier, { count: number; mrr: number; trainerPayout: number; platformRevenue: number; apiCost: number; stripeFees: number; infraCost: number }>);

  const totalMRR = Object.values(revenueByTier).reduce((sum, t) => sum + t.mrr, 0);
  const totalTrainerPayout = Object.values(revenueByTier).reduce((sum, t) => sum + t.trainerPayout, 0);
  const totalPlatformRevenue = Object.values(revenueByTier).reduce((sum, t) => sum + t.platformRevenue, 0);
  const totalApiCost = Object.values(revenueByTier).reduce((sum, t) => sum + t.apiCost, 0);
  const totalStripeFees = Object.values(revenueByTier).reduce((sum, t) => sum + t.stripeFees, 0);
  const totalInfraCost = Object.values(revenueByTier).reduce((sum, t) => sum + t.infraCost, 0);
  const totalARR = totalMRR * 12;
  const netProfit = totalPlatformRevenue - totalApiCost - totalStripeFees - totalInfraCost;

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

  // ═══════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════
  const renderRevenue = () => (
    <div style={{ padding: '20px' }}>
      <LiveBadge />
      {/* Top-level KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <KPICard label="MRR" value={`$${totalMRR.toFixed(2)}`} color="#00ff41" />
        <KPICard label="ARR" value={`$${totalARR.toFixed(2)}`} color="#00ff41" />
        <KPICard label="NET PROFIT/MO" value={`$${netProfit.toFixed(2)}`} color={netProfit > 0 ? '#00ff41' : '#ff4444'} />
        <KPICard label="TOTAL CLIENTS" value={String(clients.length)} color="#00bcd4" />
        <KPICard label="TRAINER PAYOUT" value={`$${totalTrainerPayout.toFixed(2)}/mo`} color="#ffb800" />
        <KPICard label="API COST" value={`$${totalApiCost.toFixed(2)}/mo`} color="#ff4444" />
      </div>

      {/* Revenue by Tier */}
      <SectionHeader title="REVENUE BY TIER" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
              {['TIER', 'USERS', 'PRICE', 'MRR', 'TRAINER $', 'PLATFORM $', 'API COST', 'STRIPE', 'MARGIN'].map(h => (
                <th key={h} style={{ padding: '10px 8px', color: '#555', textAlign: 'left', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => {
              const config = TIER_CONFIGS[tier];
              const data = revenueByTier[tier];
              const margin = data.mrr > 0 ? ((data.platformRevenue - data.apiCost - data.stripeFees - data.infraCost) / data.mrr * 100) : 0;
              return (
                <tr key={tier} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 8px', color: tierColor(tier), fontWeight: 700 }}>{config.codename}</td>
                  <td style={{ padding: '10px 8px', color: '#ddd' }}>{data.count}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>${config.monthlyPrice}</td>
                  <td style={{ padding: '10px 8px', color: '#00ff41' }}>${data.mrr.toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: '#ffb800' }}>${data.trainerPayout.toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: '#00bcd4' }}>${data.platformRevenue.toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: '#ff4444' }}>${data.apiCost.toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: '#888' }}>${data.stripeFees.toFixed(2)}</td>
                  <td style={{ padding: '10px 8px', color: margin > 50 ? '#00ff41' : margin > 30 ? '#ffb800' : '#ff4444' }}>{margin.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Trainer Revenue Breakdown */}
      <SectionHeader title="TRAINER PAYOUT BREAKDOWN" />
      {operators.filter(op => op.role === 'trainer').map(trainer => {
        const trainerClients = operators.filter(op => op.trainerId === trainer.id);
        const trainerMRR = trainerClients.reduce((sum, c) => sum + (TIER_CONFIGS[c.tier as AiTier]?.trainerShare || 0), 0);
        return (
          <div key={trainer.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}>
            <div>
              <span style={{ color: '#ddd', fontFamily: '"Chakra Petch", sans-serif', fontSize: '14px' }}>{trainer.callsign}</span>
              <span style={{ color: '#555', fontSize: '12px', marginLeft: '8px' }}>({trainerClients.length} clients)</span>
            </div>
            <span style={{ color: '#ffb800', fontFamily: '"Share Tech Mono", monospace', fontSize: '14px' }}>${trainerMRR.toFixed(2)}/mo</span>
          </div>
        );
      })}

      {/* Projections */}
      <SectionHeader title="GROWTH PROJECTIONS" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[25, 50, 100, 250, 500].map(count => {
          const avgRevPerUser = clients.length > 0 ? totalMRR / clients.length : 5;
          const projected = count * avgRevPerUser;
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
    </div>
  );

  const renderUsers = () => {
    // Use DB stats when available for real activity data
    const dbStats = metrics?.operators;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        {/* User KPIs — real from DB */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="TOTAL OPERATORS" value={String(dbStats?.total ?? operators.length)} color="#00bcd4" />
          <KPICard label="TRAINERS" value={String(dbStats?.trainers ?? trainers.length)} color="#ffb800" />
          <KPICard label="CLIENTS" value={String(dbStats?.clients ?? clients.length)} color="#00ff41" />
          <KPICard label="ACTIVE (7D)" value={String(dbStats?.active7d ?? 0)} color={dbStats?.active7d ? '#00ff41' : '#ff4444'} />
          <KPICard label="BETA USERS" value={String(dbStats?.beta ?? 0)} color="#ff00ff" />
          <KPICard label="PROFILE DONE" value={`${dbStats?.profileComplete ?? 0}/${dbStats?.total ?? operators.length}`} color="#00bcd4" />
        </div>

        {/* Tier Distribution */}
        <SectionHeader title="TIER DISTRIBUTION" />
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => {
            const count = (opStats.length > 0 ? opStats : operators).filter((op: { tier?: string }) => op.tier === tier).length;
            const total = dbStats?.total ?? operators.length;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={tier} style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${tierColor(tier)}20`, flex: '1 1 120px' }}>
                <div style={{ color: tierColor(tier), fontFamily: '"Orbitron", sans-serif', fontSize: '11px', letterSpacing: '2px' }}>
                  {TIER_CONFIGS[tier].codename}
                </div>
                <div style={{ color: '#ddd', fontFamily: '"Orbitron", sans-serif', fontSize: '24px', fontWeight: 700 }}>{count}</div>
                <div style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>{pct}%</div>
              </div>
            );
          })}
        </div>

        {/* Full User Roster — use DB stats for workout/PR counts */}
        <SectionHeader title="ALL OPERATORS" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
                {['CALLSIGN', 'NAME', 'ROLE', 'TIER', 'WORKOUTS', 'PRs', 'ACTIVE', 'PROFILE', 'BETA'].map(h => (
                  <th key={h} style={{ padding: '8px', color: '#555', textAlign: 'left', fontSize: '10px', letterSpacing: '1px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(opStats.length > 0 ? opStats : operators.map(op => ({
                id: op.id, callsign: op.callsign, name: op.name, role: op.role, tier: op.tier,
                workoutCount: Object.keys(op.workouts || {}).length,
                prCount: (op.prs || []).length,
                isActive: false, hasProfile: !!(op.profile?.age && op.profile?.weight),
                betaUser: op.betaUser || false,
              }))).map(op => (
                <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '8px', color: tierColor(op.tier), fontWeight: 600 }}>{op.callsign}</td>
                  <td style={{ padding: '8px', color: '#888' }}>{op.name}</td>
                  <td style={{ padding: '8px', color: op.role === 'trainer' ? '#ffb800' : '#00bcd4' }}>{op.role.toUpperCase()}</td>
                  <td style={{ padding: '8px', color: tierColor(op.tier) }}>{TIER_CONFIGS[op.tier as AiTier]?.codename || op.tier}</td>
                  <td style={{ padding: '8px', color: op.workoutCount > 0 ? '#00ff41' : '#333' }}>{op.workoutCount}</td>
                  <td style={{ padding: '8px', color: op.prCount > 0 ? '#00bcd4' : '#333' }}>{op.prCount}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 6px', fontSize: '9px',
                      background: op.isActive ? 'rgba(0,255,65,0.08)' : 'rgba(255,68,68,0.05)',
                      color: op.isActive ? '#00ff41' : '#444',
                      border: `1px solid ${op.isActive ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.03)'}`,
                    }}>
                      {op.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: op.hasProfile ? '#00ff41' : '#ff4444' }}>{op.hasProfile ? 'YES' : 'NO'}</td>
                  <td style={{ padding: '8px', color: op.betaUser ? '#ff00ff' : '#333' }}>{op.betaUser ? 'YES' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPlatform = () => {
    const pm = metrics?.platform;
    const ai = metrics?.ai;
    const db = metrics?.db;

    // Real counts from DB when available
    const totalWorkouts = pm?.totalWorkouts ?? operators.reduce((sum, op) => sum + Object.keys(op.workouts || {}).length, 0);
    const totalMeals = pm?.totalMeals ?? 0;
    const totalPRs = pm?.totalPRs ?? operators.reduce((sum, op) => sum + (op.prs?.length || 0), 0);
    const totalInjuries = pm?.totalInjuries ?? operators.reduce((sum, op) => sum + (op.injuries?.length || 0), 0);
    const activeWearables = pm?.activeWearables ?? 0;

    // Real AI usage from DB
    const totalChatSessions = ai?.totalChatSessions ?? 0;
    const totalMessages = ai?.totalMessages ?? 0;
    const estTokens = ai?.estTotalTokens ?? 0;
    const estCost = ai?.estMonthlyCostUSD ?? 0;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="TOTAL WORKOUTS" value={String(totalWorkouts)} color="#00ff41" />
          <KPICard label="MEALS LOGGED" value={String(totalMeals)} color="#ffb800" />
          <KPICard label="PRs RECORDED" value={String(totalPRs)} color="#00bcd4" />
          <KPICard label="INJURIES TRACKED" value={String(totalInjuries)} color="#ff4444" />
          <KPICard label="WEARABLE LINKS" value={String(activeWearables)} color="#ff00ff" />
        </div>

        {/* AI Usage — real from chat history DB */}
        <SectionHeader title="GUNNY AI USAGE" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="CHAT SESSIONS" value={String(totalChatSessions)} color="#ffb800" />
          <KPICard label="TOTAL MESSAGES" value={String(totalMessages)} color="#00bcd4" />
          <KPICard label="GUNNY TAB" value={String(ai?.gunnyChatSessions ?? 0)} color="#00ff41" />
          <KPICard label="ONBOARDING" value={String(ai?.onboardingSessions ?? 0)} color="#ff00ff" />
          <KPICard label="SIDE PANEL" value={String(ai?.panelSessions ?? 0)} color="#ffb800" />
          <KPICard label="EST TOKENS" value={estTokens > 1000000 ? `${(estTokens / 1000000).toFixed(1)}M` : estTokens > 1000 ? `${(estTokens / 1000).toFixed(0)}K` : String(estTokens)} color="#ff4444" />
          <KPICard label="EST API COST" value={`$${estCost.toFixed(2)}`} color="#ff4444" />
        </div>

        <SectionHeader title="INFRASTRUCTURE STATUS" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <StatusRow label="RAILWAY DEPLOY" status="LIVE" color="#00ff41" />
          <StatusRow label="POSTGRESQL" status={metrics ? 'CONNECTED' : 'CHECKING...'} color={metrics ? '#00ff41' : '#ffb800'} />
          <StatusRow label="ANTHROPIC API" status="ACTIVE" color="#00ff41" />
          <StatusRow label="JUNCTION WEARABLES" status={activeWearables > 0 ? `${activeWearables} LINKED` : 'PENDING CONFIG'} color={activeWearables > 0 ? '#00ff41' : '#ffb800'} />
          <StatusRow label="PRISMA 7" status="v7.5.0" color="#00bcd4" />
          <StatusRow label="NEXT.JS" status="v14.2" color="#00bcd4" />
        </div>

        <SectionHeader title="DATABASE VOLUME" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <DataRow label="Operator rows" value={String(db?.operatorRows ?? operators.length)} />
          <DataRow label="Chat history rows" value={String(db?.chatRows ?? 0)} />
          <DataRow label="Workouts stored" value={String(totalWorkouts)} />
          <DataRow label="Meal entries" value={String(totalMeals)} />
          <DataRow label="PR records" value={String(totalPRs)} />
          <DataRow label="Injury records" value={String(totalInjuries)} />
          <DataRow label="Wearable connections" value={String(activeWearables)} />
          <DataRow label="Est. total DB rows" value={`~${db?.estTotalRows ?? operators.length}`} />
        </div>
      </div>
    );
  };

  const renderBeta = () => {
    // Normalize beta operators into a common shape
    const betaOps = (opStats.length > 0 ? opStats : operators.map(op => ({
      id: op.id, callsign: op.callsign, name: op.name, role: op.role, tier: op.tier,
      betaUser: op.betaUser || false, hasProfile: !!(op.profile?.age && op.profile?.weight),
      workoutCount: 0, mealCount: 0, prCount: 0, injuryCount: 0, isActive: false,
      createdAt: '', updatedAt: '',
    }))).filter(op => op.betaUser);

    const allFeedback = operators.flatMap(op =>
      (op.betaFeedback || []).map(fb => ({ callsign: op.callsign, feedback: fb, tier: op.tier }))
    );

    const dbBeta = metrics?.operators;

    return (
      <div style={{ padding: '20px' }}>
        <LiveBadge />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="BETA USERS" value={String(dbBeta?.beta ?? betaOps.length)} color="#ff00ff" />
          <KPICard label="TOTAL FEEDBACK" value={String(allFeedback.length)} color="#00bcd4" />
          <KPICard label="PROFILE COMPLETE" value={`${betaOps.filter(op => op.hasProfile).length}/${betaOps.length}`} color="#00ff41" />
        </div>

        <SectionHeader title="BETA ROSTER" />
        {betaOps.map(op => {
          const fbCount = operators.find(o => o.id === op.id)?.betaFeedback?.length || 0;
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
                  background: op.hasProfile ? 'rgba(0,255,65,0.08)' : 'rgba(255,68,68,0.08)',
                  color: op.hasProfile ? '#00ff41' : '#ff4444',
                  border: `1px solid ${op.hasProfile ? 'rgba(0,255,65,0.15)' : 'rgba(255,68,68,0.15)'}`,
                }}>
                  {op.hasProfile ? 'PROFILED' : 'INCOMPLETE'}
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
          allFeedback.map((fb, i) => (
            <div key={i} style={{
              padding: '12px 16px', marginBottom: '6px',
              background: 'rgba(0,188,212,0.03)', border: '1px solid rgba(0,188,212,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: tierColor(fb.tier as AiTier), fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', fontWeight: 600 }}>{fb.callsign}</span>
              </div>
              <div style={{ color: '#aaa', fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', lineHeight: '1.5' }}>{fb.feedback}</div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderMarketing = () => (
    <div style={{ padding: '20px' }}>
      <div style={{
        background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.12)',
        padding: '16px 20px', marginBottom: '24px',
      }}>
        <div style={{ color: '#ffb800', fontFamily: '"Orbitron", sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px' }}>
          MARKETING COMMAND CENTER
        </div>
        <div style={{ color: '#888', fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px', lineHeight: '1.6' }}>
          Centralized hub for scheduling and pushing content across all social platforms. Connect platform APIs below — the marketing agent will use these endpoints to publish content on your behalf.
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
          <code style={{ color: '#00bcd4', background: 'rgba(0,188,212,0.08)', padding: '4px 8px' }}>
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
      default: return null;
    }
  };

  const tabConfig: { id: OpsTab; label: string; icon: string }[] = [
    { id: 'REVENUE', label: 'REVENUE', icon: '$' },
    { id: 'USERS', label: 'USERS', icon: '◈' },
    { id: 'PLATFORM', label: 'PLATFORM', icon: '▦' },
    { id: 'BETA', label: 'BETA', icon: '★' },
    { id: 'MARKETING', label: 'MARKETING', icon: '◆' },
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

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: '4px', padding: '10px 20px',
        borderBottom: '1px solid rgba(255,68,68,0.06)',
        background: 'rgba(255,0,0,0.01)', overflowX: 'auto',
      }}>
        {tabConfig.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', fontSize: '12px',
                fontFamily: '"Share Tech Mono", monospace',
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '1.5px',
                color: isActive ? '#ff4444' : '#555',
                background: isActive ? 'rgba(255,68,68,0.08)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(255,68,68,0.2)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ marginRight: '6px', opacity: 0.6 }}>{tab.icon}</span>
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

// ═══════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════
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
    case 'haiku': return '#00bcd4';
    case 'sonnet': return '#ffb800';
    case 'opus': return '#ff4444';
    case 'white_glove': return '#ff00ff';
    default: return '#888';
  }
};

export default OpsCenter;
