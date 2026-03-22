'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Operator, TIER_CONFIGS, AiTier, OPS_CENTER_ACCESS } from '@/lib/types';

type OpsTab = 'REVENUE' | 'USERS' | 'PLATFORM' | 'BETA' | 'MARKETING';

interface OpsCenterProps {
  currentUser: Operator;
  operators: Operator[];
}

// ═══════════════════════════════════════════════════
// API USAGE TRACKING (in-memory for now, DB later)
// ═══════════════════════════════════════════════════
interface PlatformMetrics {
  totalApiCalls: number;
  gunnyTokensUsed: number;
  avgResponseTime: number;
  errorRate: number;
  dbSize: string;
  lastDeploy: string;
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

  // Verify access
  if (!OPS_CENTER_ACCESS.includes(currentUser.id)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ff4444', fontFamily: '"Orbitron", sans-serif' }}>
        ACCESS DENIED — CLASSIFIED
      </div>
    );
  }

  // ═══════════════════════════════════════
  // REVENUE CALCULATIONS
  // ═══════════════════════════════════════
  const trainers = operators.filter(op => op.role === 'trainer');
  const clients = operators.filter(op => op.role === 'client');

  const revenueByTier = (Object.keys(TIER_CONFIGS) as AiTier[]).reduce((acc, tier) => {
    const count = clients.filter(c => c.tier === tier).length;
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
  // USER ANALYTICS
  // ═══════════════════════════════════════
  const betaUsers = operators.filter(op => op.betaUser);
  const activeUsers = operators.filter(op => {
    const workoutDates = Object.keys(op.workouts || {});
    if (workoutDates.length === 0) return false;
    const latestDate = workoutDates.sort().reverse()[0];
    const daysSinceLastWorkout = (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastWorkout <= 7;
  });
  const profileComplete = operators.filter(op =>
    op.profile?.age && op.profile?.weight && op.profile?.goals?.length && op.preferences?.daysPerWeek
  );

  // ═══════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════
  const renderRevenue = () => (
    <div style={{ padding: '20px' }}>
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
      {trainers.map(trainer => {
        const trainerClients = operators.filter(op => op.trainerId === trainer.id);
        const trainerMRR = trainerClients.reduce((sum, c) => sum + TIER_CONFIGS[c.tier as AiTier]?.trainerShare || 0, 0);
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

  const renderUsers = () => (
    <div style={{ padding: '20px' }}>
      {/* User KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <KPICard label="TOTAL OPERATORS" value={String(operators.length)} color="#00bcd4" />
        <KPICard label="TRAINERS" value={String(trainers.length)} color="#ffb800" />
        <KPICard label="CLIENTS" value={String(clients.length)} color="#00ff41" />
        <KPICard label="ACTIVE (7D)" value={String(activeUsers.length)} color="#00ff41" />
        <KPICard label="BETA USERS" value={String(betaUsers.length)} color="#ff00ff" />
        <KPICard label="PROFILE DONE" value={`${profileComplete.length}/${operators.length}`} color="#00bcd4" />
      </div>

      {/* Tier Distribution */}
      <SectionHeader title="TIER DISTRIBUTION" />
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(Object.keys(TIER_CONFIGS) as AiTier[]).map(tier => {
          const count = operators.filter(op => op.tier === tier).length;
          const pct = operators.length > 0 ? Math.round(count / operators.length * 100) : 0;
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

      {/* Full User Roster */}
      <SectionHeader title="ALL OPERATORS" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Share Tech Mono", monospace', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
              {['CALLSIGN', 'NAME', 'ROLE', 'TIER', 'GOALS', 'PROFILE', 'BETA'].map(h => (
                <th key={h} style={{ padding: '8px', color: '#555', textAlign: 'left', fontSize: '10px', letterSpacing: '1px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operators.map(op => {
              const hasProfile = op.profile?.age && op.profile?.weight;
              return (
                <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '8px', color: tierColor(op.tier as AiTier), fontWeight: 600 }}>{op.callsign}</td>
                  <td style={{ padding: '8px', color: '#888' }}>{op.name}</td>
                  <td style={{ padding: '8px', color: op.role === 'trainer' ? '#ffb800' : '#00bcd4' }}>{op.role.toUpperCase()}</td>
                  <td style={{ padding: '8px', color: tierColor(op.tier as AiTier) }}>{TIER_CONFIGS[op.tier as AiTier]?.codename || op.tier}</td>
                  <td style={{ padding: '8px', color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.profile?.goals?.join(', ') || '—'}</td>
                  <td style={{ padding: '8px', color: hasProfile ? '#00ff41' : '#ff4444' }}>{hasProfile ? 'YES' : 'NO'}</td>
                  <td style={{ padding: '8px', color: op.betaUser ? '#ff00ff' : '#333' }}>{op.betaUser ? 'YES' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlatform = () => {
    // Estimate metrics from operator data
    const totalWorkouts = operators.reduce((sum, op) => sum + Object.keys(op.workouts || {}).length, 0);
    const totalMeals = operators.reduce((sum, op) => {
      const meals = op.nutrition?.meals || {};
      return sum + Object.values(meals).reduce((s, dayMeals) => s + (Array.isArray(dayMeals) ? dayMeals.length : 0), 0);
    }, 0);
    const totalPRs = operators.reduce((sum, op) => sum + (op.prs?.length || 0), 0);
    const totalInjuries = operators.reduce((sum, op) => sum + (op.injuries?.length || 0), 0);
    const estTokensPerChat = 2000;
    const estChatsPerDay = operators.length * 2;
    const estDailyTokens = estChatsPerDay * estTokensPerChat;
    const estMonthlyCost = (estDailyTokens * 30 / 1000000) * 3; // rough $3/MTok avg

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="TOTAL WORKOUTS" value={String(totalWorkouts)} color="#00ff41" />
          <KPICard label="MEALS LOGGED" value={String(totalMeals)} color="#ffb800" />
          <KPICard label="PRs RECORDED" value={String(totalPRs)} color="#00bcd4" />
          <KPICard label="INJURIES TRACKED" value={String(totalInjuries)} color="#ff4444" />
          <KPICard label="EST DAILY TOKENS" value={`${(estDailyTokens / 1000).toFixed(0)}K`} color="#ff00ff" />
          <KPICard label="EST API COST/MO" value={`$${estMonthlyCost.toFixed(2)}`} color="#ff4444" />
        </div>

        <SectionHeader title="INFRASTRUCTURE STATUS" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <StatusRow label="RAILWAY DEPLOY" status="LIVE" color="#00ff41" />
          <StatusRow label="POSTGRESQL" status="CONNECTED" color="#00ff41" />
          <StatusRow label="ANTHROPIC API" status="ACTIVE" color="#00ff41" />
          <StatusRow label="JUNCTION WEARABLES" status={process.env.NEXT_PUBLIC_VITAL_CONFIGURED ? 'ACTIVE' : 'PENDING CONFIG'} color={process.env.NEXT_PUBLIC_VITAL_CONFIGURED ? '#00ff41' : '#ffb800'} />
          <StatusRow label="PRISMA 7" status="v7.5.0" color="#00bcd4" />
          <StatusRow label="NEXT.JS" status="v14.2" color="#00bcd4" />
        </div>

        <SectionHeader title="DATA VOLUME" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <DataRow label="Operators in DB" value={String(operators.length)} />
          <DataRow label="Workouts stored" value={String(totalWorkouts)} />
          <DataRow label="Meal entries" value={String(totalMeals)} />
          <DataRow label="PR records" value={String(totalPRs)} />
          <DataRow label="Injury records" value={String(totalInjuries)} />
          <DataRow label="Est. DB rows" value={`~${operators.length + totalWorkouts + totalMeals + totalPRs}`} />
        </div>
      </div>
    );
  };

  const renderBeta = () => {
    const allFeedback = operators.flatMap(op =>
      (op.betaFeedback || []).map(fb => ({ callsign: op.callsign, feedback: fb, tier: op.tier }))
    );

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard label="BETA USERS" value={String(betaUsers.length)} color="#ff00ff" />
          <KPICard label="TOTAL FEEDBACK" value={String(allFeedback.length)} color="#00bcd4" />
          <KPICard label="PROFILE COMPLETE" value={`${profileComplete.filter(op => op.betaUser).length}/${betaUsers.length}`} color="#00ff41" />
        </div>

        <SectionHeader title="BETA ROSTER" />
        {betaUsers.map(op => {
          const feedbackCount = op.betaFeedback?.length || 0;
          const hasProfile = op.profile?.age && op.profile?.weight;
          return (
            <div key={op.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: tierColor(op.tier as AiTier), fontWeight: 600, fontFamily: '"Chakra Petch", sans-serif' }}>{op.callsign}</span>
                <span style={{ color: '#555', fontSize: '12px' }}>{op.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#555', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px' }}>
                  {feedbackCount} feedback{feedbackCount !== 1 ? 's' : ''}
                </span>
                <span style={{
                  padding: '2px 8px', fontSize: '10px', fontFamily: '"Share Tech Mono", monospace',
                  background: hasProfile ? 'rgba(0,255,65,0.08)' : 'rgba(255,68,68,0.08)',
                  color: hasProfile ? '#00ff41' : '#ff4444',
                  border: `1px solid ${hasProfile ? 'rgba(0,255,65,0.15)' : 'rgba(255,68,68,0.15)'}`,
                }}>
                  {hasProfile ? 'PROFILED' : 'INCOMPLETE'}
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
