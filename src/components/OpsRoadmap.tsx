'use client';

// OpsRoadmap — Founder-only sub-tab inside the NAV.OPS center.
//
// Renders the 15-month strategic ops brief from
// GUNS_UP_Pricing_Strategy_v1.docx (April 2026):
//   • Executive summary + headline projections
//   • Tier structure & unit economics
//   • 5 quarterly phase lines (ALPHA → ECHO) with end-state targets,
//     monthly milestones, and concrete action items
//   • Trainer recruitment math
//   • Risk register
//   • KPI dashboard (daily / weekly / monthly / quarterly cadence)
//
// Visibility: gated by FOUNDER_IDS at the OpsCenter render site —
// only Ruben (op-ruben) and Britney (op-britney) ever see this tab,
// even if OPS_CENTER_ACCESS expands to include other admins later.
//
// All content is hard-coded from the strategy doc. The doc is the
// source of truth — when it revises (next review: Aug 31 2026, end
// of Phase ALPHA), update the consts below to match. Do not let the
// numbers drift between this component, lib/types.ts::TIER_CONFIGS,
// and the landing page tier cards.

import React from 'react';
import Icon from '@/components/Icons';

// ─── Strategy doc data ──────────────────────────────────────────────

interface PhaseMonth {
  month: string;
  subs: number;
  mrr: number;
  net: number;
}
interface PhaseLine {
  code: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA' | 'ECHO';
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5';
  title: string;
  period: string;
  days: number;
  endState: {
    subs: number;
    mrr: number;
    net: number;
    trainers: string;
  };
  highlights: string[]; // 3-5 end-state bullets after the headline targets
  milestones: PhaseMonth[];
  actions: { group: string; items: string[] }[];
  risks?: { risk: string; mitigation: string }[];
}

const PHASES: PhaseLine[] = [
  {
    code: 'ALPHA',
    quarter: 'Q1',
    title: 'Launch Operations',
    period: 'Jun 1 – Aug 31, 2026',
    days: 92,
    endState: { subs: 117, mrr: 1643, net: 1003, trainers: '6–8' },
    highlights: [
      'First successful Stripe payout cycle (15th of each month)',
      'API cost validated within ±15% of $0.28/sub blended projection',
      'Average trainer roster: 15 clients',
    ],
    milestones: [
      { month: 'End of Jun 2026', subs: 35, mrr: 491, net: 300 },
      { month: 'End of Jul 2026', subs: 75, mrr: 1053, net: 643 },
      { month: 'End of Aug 2026', subs: 117, mrr: 1643, net: 1003 },
    ],
    actions: [
      {
        group: 'Recruitment',
        items: [
          'Onboard 5 trainers from personal network in first 14 days post-launch (May 30 – Jun 13).',
          'Add 1 trainer per week through July via Instagram/TikTok content funnel (T-1 through T-6 posts per playbook).',
          'Run trainer onboarding call within 48 hours of signup — app walkthrough, Stripe Connect setup, Gunny system prompt review, first 5 client invitations sent during the call.',
          'Issue first Charter Trainer perks: founder badge in app, locked-in 25% bonus on revenue share for first 12 months, priority support channel.',
        ],
      },
      {
        group: 'Subscriber Acquisition',
        items: [
          'Launch Charter Member promo: 25% off annual billing (3 months free) for first 200 subscribers.',
          'Each trainer commits to onboarding 5 clients in their first 30 days, scaling to 15 by day 90.',
          'Direct trainer DMs to clients pitching OPERATOR as default ($9.99). RECON positioned as "no commitment trial."',
          'Soft target: 60% of subs on OPERATOR or above by end of August.',
        ],
      },
      {
        group: 'Operations',
        items: [
          'Daily MRR + sub count check (5 minutes, every morning). Track in Notion/Sheets.',
          'Weekly API cost review against projection. If costs run >20% high, investigate cache hit rate.',
          'Monthly trainer payout via Stripe Connect on the 15th. Generate per-trainer earnings report.',
          'First marketing playbook content cycle: 4 IG posts/week, 3 TikToks/week alternating trainer (T) and client (C) content.',
        ],
      },
    ],
    risks: [
      { risk: 'Trainer onboarding takes longer than planned', mitigation: 'Pre-built onboarding checklist + 30-min video walkthrough.' },
      { risk: 'First payout cycle has bugs', mitigation: 'Dry-run Stripe Connect with $1 test transactions in May before public launch.' },
      { risk: 'API costs exceed $0.50/sub on average', mitigation: 'Cache hit dashboard built into ops view; alert if rate drops below 50%.' },
    ],
  },
  {
    code: 'BRAVO',
    quarter: 'Q2',
    title: 'Stabilization',
    period: 'Sep 1 – Nov 30, 2026',
    days: 91,
    endState: { subs: 292, mrr: 4100, net: 2503, trainers: '15–18' },
    highlights: [
      'First trainer reaches SERGEANT rank (11+ active clients) — unlocks +5% revenue boost',
      'Monthly churn rate below 7% measured cohort-over-cohort',
    ],
    milestones: [
      { month: 'End of Sep 2026', subs: 175, mrr: 2457, net: 1500 },
      { month: 'End of Oct 2026', subs: 230, mrr: 3229, net: 1971 },
      { month: 'End of Nov 2026', subs: 292, mrr: 4100, net: 2503 },
    ],
    actions: [
      {
        group: 'Product',
        items: [
          'Ship trainer dashboard v2: real-time revenue analytics, per-client breakdown, projected next payout, rank progress bar.',
          'Roll out annual billing across all four tiers via Stripe yearly subscriptions. 17% discount baseline.',
          'Launch upgrade nudge system: Gunny suggests tier upgrades to clients showing usage patterns above their tier.',
          'Build usage metering dashboard for ops view — token use per user per session per tier.',
        ],
      },
      {
        group: 'Recruitment',
        items: [
          'Move trainer recruitment from "personal network" to "warm outreach." Use playbook DM scripts 1–2.',
          'Begin gym/box partnership outreach: 5 affiliate gyms or CrossFit boxes. Pitch white-label trainer onboarding.',
          'First Big Fish recruitment: identify 3 trainers with 30+ existing clients. Offer LIEUTENANT priority access + co-marketing.',
          'Run trainer rank-up event when first SERGEANT crosses threshold. Public post in trainer Slack/Discord.',
        ],
      },
      {
        group: 'Retention',
        items: [
          'Cohort churn analysis: month 1 vs month 2 vs month 3 retention by tier and trainer.',
          'Weekly Gunny prompt audit — verify tone, accuracy, callsign use, format compliance.',
          'Bilingual EN/ES marketing pilot: translate top 5 playbook posts, run 30-day Spanish-language IG/TikTok experiment.',
          'First user feedback survey at 60-day cohort. NPS + open-ended on what would justify a tier upgrade.',
        ],
      },
    ],
  },
  {
    code: 'CHARLIE',
    quarter: 'Q3',
    title: 'Scale',
    period: 'Dec 1, 2026 – Feb 28, 2027',
    days: 90,
    endState: { subs: 584, mrr: 8199, net: 5005, trainers: '28–32' },
    highlights: [
      'First LIEUTENANT trainer (31+ clients, +10% bonus)',
      'Wearable integrations live: Apple Watch, Garmin, Whoop minimum',
    ],
    milestones: [
      { month: 'End of Dec 2026', subs: 380, mrr: 5335, net: 3257 },
      { month: 'End of Jan 2027', subs: 480, mrr: 6739, net: 4114 },
      { month: 'End of Feb 2027', subs: 584, mrr: 8199, net: 5005 },
    ],
    actions: [
      {
        group: 'Growth',
        items: [
          'January resolution surge prep: stock content calendar with 2× normal volume in late December.',
          'Trainer-to-trainer referral system goes live: SERGEANT and above earn $50 cash bounty per trainer they refer who hits 5 clients.',
          'CAC measurement dashboard live across all channels (organic social, trainer referral, gym partnership, paid).',
          'First paid acquisition test: $500/mo budget on either Meta or TikTok. Hard kill switch if CAC exceeds $15.',
        ],
      },
      {
        group: 'Product',
        items: [
          'Wearable integrations ship: Apple Watch, Garmin, Whoop. Heart rate zones into Daily Brief.',
          'Family/couple plan beta: 2 subs at 20% combined discount. Test conversion against single-sub baseline.',
          'Bilingual EN/ES rollout completed across full app + marketing.',
          'Voice mode / TTS quality pass — Gunny audio output usable on commute or in gym.',
        ],
      },
      {
        group: 'Operations',
        items: [
          'Hire first part-time contractor: trainer success manager OR content creator (5–10 hrs/week, $25–35/hr).',
          'Move from personal Stripe to GUNS UP LLC if not already done. Tax setup for trainer 1099s ahead of January cycle.',
          'Implement automated trainer 1099 generation for January 2027 tax season.',
          'Validate WARFIGHTER price-lift readiness — pull retention, NPS, and feature usage data on existing W cohort.',
        ],
      },
    ],
  },
  {
    code: 'DELTA',
    quarter: 'Q4',
    title: 'Price Lift + Year One Close',
    period: 'Mar 1 – May 31, 2027',
    days: 92,
    endState: { subs: 973, mrr: 16580, net: 10011, trainers: '45–55' },
    highlights: [
      'First CAPTAIN trainer (61+ clients, +15% bonus)',
      'WARFIGHTER price-lift to $79.99 implemented (April 1, 2027)',
      'Year One closeout: cumulative ARR exceeds $200K',
    ],
    milestones: [
      { month: 'End of Mar 2027', subs: 750, mrr: 10530, net: 6427 },
      { month: 'End of Apr 2027', subs: 850, mrr: 14484, net: 8738 },
      { month: 'End of May 2027', subs: 973, mrr: 16580, net: 10011 },
    ],
    actions: [
      {
        group: 'Pricing',
        items: [
          'Mar 1: Internal lock on WARFIGHTER price-lift decision. Build email + in-app announcement.',
          'Mar 15: Email all existing WARFIGHTER subs announcing price increase effective Apr 1. Offer 12-month price lock at $49.99 if they convert to annual before Apr 1.',
          'Apr 1: New WARFIGHTER signups billed at $79.99. Update landing page, app, and all marketing collateral.',
          'Apr 30: Measure WARFIGHTER conversion drop. If new-signup rate falls more than 30%, run ABC test on tier benefits page.',
        ],
      },
      {
        group: 'Partnerships',
        items: [
          'First gym/box licensing deal: $500–$1,500/mo for unlimited member access at one location.',
          'Sponsor or speak at one regional fitness event (CrossFit local sanctional, USAPL meet, hybrid athlete event).',
          'Reach out to 5 fitness podcasts with founder pitch: Marine vet who built an AI fitness app that pays trainers.',
        ],
      },
      {
        group: 'Operations',
        items: [
          'Hire second contractor: depending on what is bottlenecked — content, customer support, or trainer onboarding (10–20 hrs/week).',
          'Year One financial close: full P&L, cash position, ARR, churn, LTV calculation by tier.',
          'Decision point: are we self-funded indefinitely or open to raising? Year One numbers inform the answer.',
          'Apply for verified Veteran-Owned status on LinkedIn, Stripe, and any state/federal vet-business directories.',
        ],
      },
    ],
  },
  {
    code: 'ECHO',
    quarter: 'Q5',
    title: 'Year Two Launch',
    period: 'Jun 1 – Aug 31, 2027',
    days: 92,
    endState: { subs: 1459, mrr: 24861, net: 15013, trainers: '65–80' },
    highlights: [
      'First GENERAL trainer (100+ clients, +20% bonus + equity discussion)',
      'Annual run-rate exceeds $300K ARR',
      'Series Pre-Seed conversation if growth supports it',
    ],
    milestones: [
      { month: 'End of Jun 2027', subs: 1150, mrr: 19596, net: 11832 },
      { month: 'End of Jul 2027', subs: 1325, mrr: 22578, net: 13632 },
      { month: 'End of Aug 2027', subs: 1459, mrr: 24861, net: 15013 },
    ],
    actions: [
      {
        group: 'Strategic',
        items: [
          'Launch fifth tier — codename "OVERLORD" — at $99/mo. Includes everything in WARFIGHTER plus monthly biometric review and dedicated coach pairing.',
          'First GENERAL trainer equity conversation. Establish framework for advisor or partner equity grants for trainers exceeding 100 active clients.',
          'Enterprise pilot: gym-wide licensing for $2,000/mo at one mid-sized chain (3+ locations).',
          'Open Series Pre-Seed conversation if growth supports it.',
        ],
      },
      {
        group: 'Product',
        items: [
          'White-label option for top trainers: trainer\'s brand on their client-facing app for $200/mo + per-user fees.',
          'Corporate wellness offering: $8/employee/mo for company plans, 20-employee minimum.',
          'Mobile-first iteration: native iOS and Android apps if PWA usage data shows install friction is suppressing growth.',
          'Voice-first beta: full Gunny voice conversations during workouts via earbuds. Premium feature for COMMANDER+ tiers.',
        ],
      },
    ],
  },
];

// Tier structure table — pulled directly from §02 of the doc.
interface TierRow {
  field: string;
  recon: string;
  operator: string;
  commander: string;
  warfighter: string;
}
const TIER_TABLE: TierRow[] = [
  { field: 'Monthly Price',     recon: '$3.99',     operator: '$9.99',     commander: '$14.99',    warfighter: '$49.99 → $79.99' },
  { field: 'Annual Price',      recon: '$39.92',    operator: '$99.50',    commander: '$149.40',   warfighter: '$497.90' },
  { field: 'AI Model',          recon: 'Haiku 4.5', operator: 'Sonnet 4.6', commander: 'Opus 4.6',  warfighter: 'Opus 4.6' },
  { field: 'Target Audience',   recon: 'Budget / trial', operator: 'Daily lifter', commander: 'Serious athlete', warfighter: 'Pro / concierge' },
  { field: 'Trainer Share %',   recon: '25%',       operator: '30%',       commander: '20%',       warfighter: '40%' },
  { field: 'Trainer $/sub/mo',  recon: '$1.00',     operator: '$3.00',     commander: '$3.00',     warfighter: '$20 / $32' },
];

// Unit economics waterfall — §03 of the doc.
interface EconRow {
  line: string;
  recon: string;
  operator: string;
  commander: string;
  warfighter: string;
  warfighterPlus: string;
  notes: string;
}
const ECON_TABLE: EconRow[] = [
  { line: 'Subscriber Pays',  recon: '$3.99',  operator: '$9.99',  commander: '$14.99', warfighter: '$49.99', warfighterPlus: '$79.99',  notes: '— ' },
  { line: 'Stripe Fee',       recon: '–$0.42', operator: '–$0.59', commander: '–$0.73', warfighter: '–$1.75', warfighterPlus: '–$2.62',  notes: '2.9% + $0.30' },
  { line: 'Trainer Share',    recon: '–$1.00', operator: '–$3.00', commander: '–$3.00', warfighter: '–$20.00', warfighterPlus: '–$32.00', notes: '25/30/20/40%' },
  { line: 'API Cost (cached)',recon: '–$0.07', operator: '–$0.34', commander: '–$0.56', warfighter: '–$0.56', warfighterPlus: '–$0.56',  notes: '60% cache hit' },
  { line: 'Variable Infra',   recon: '–$0.10', operator: '–$0.10', commander: '–$0.10', warfighter: '–$0.10', warfighterPlus: '–$0.10',  notes: 'Railway + DB' },
  { line: 'PLATFORM NET',     recon: '$2.40',  operator: '$5.96',  commander: '$10.60', warfighter: '$27.58', warfighterPlus: '$44.71',  notes: '— ' },
  { line: 'Margin %',         recon: '60.2%',  operator: '59.7%',  commander: '70.7%',  warfighter: '55.2%',  warfighterPlus: '55.9%',   notes: '— ' },
];

// Recruitment math — §05 of the doc.
const RECRUITMENT_ROWS = [
  { phase: 'ALPHA',   subs: 117,   trainers: 7,  avgRoster: 17, netToTrainer: '$4.30',  avgPay: '$73/mo' },
  { phase: 'BRAVO',   subs: 292,   trainers: 17, avgRoster: 17, netToTrainer: '$4.30',  avgPay: '$73/mo' },
  { phase: 'CHARLIE', subs: 584,   trainers: 30, avgRoster: 19, netToTrainer: '$4.50*', avgPay: '$87/mo' },
  { phase: 'DELTA',   subs: 973,   trainers: 50, avgRoster: 19, netToTrainer: '$5.50',  avgPay: '$104/mo' },
  { phase: 'ECHO',    subs: 1459,  trainers: 72, avgRoster: 20, netToTrainer: '$5.50',  avgPay: '$112/mo' },
];

// Risk register — §06.
const RISK_REGISTER = [
  { risk: 'Trainer recruitment lags',          likelihood: 'HIGH',   impact: 'CRITICAL', mitigation: 'Aggressive Big Fish strategy from Phase BRAVO. Sign 3 known-quantity trainers personally before public launch.' },
  { risk: 'API costs exceed projection',       likelihood: 'MEDIUM', impact: 'MEDIUM',   mitigation: 'Cache hit rate dashboard. Auto-downgrade Opus to Sonnet for non-COMMANDER tiers if costs spike. Alert at 50% cache hit threshold.' },
  { risk: 'Churn higher than 7%',              likelihood: 'MEDIUM', impact: 'HIGH',     mitigation: 'Annual billing push from Phase ALPHA reduces month-to-month churn risk. Trainer-led onboarding raises switching cost.' },
  { risk: 'Anthropic price increase',          likelihood: 'LOW',    impact: 'HIGH',     mitigation: 'Margins absorb up to 30% API cost increase before requiring price changes. Multi-model abstraction layer enables rapid model swap.' },
  { risk: 'OpenAI/ChatGPT enters fitness',     likelihood: 'HIGH',   impact: 'MEDIUM',   mitigation: 'Trainer revenue share is the moat — generic ChatGPT doesn\'t pay trainers. Lean into trainer marketplace messaging in all comms.' },
  { risk: 'Single-founder burnout',            likelihood: 'MEDIUM', impact: 'CRITICAL', mitigation: 'First contractor by Phase CHARLIE. Second by Phase DELTA. Defined hand-off categories: trainer success, content, support.' },
  { risk: 'WARFIGHTER price lift drops signups', likelihood: 'MEDIUM', impact: 'LOW',    mitigation: 'Existing W subs grandfathered. New $79.99 still 60–75% under Future, Caliber Premium, Trainwell. Worst case: revert to $49.99.' },
];

// KPI cadence — §07.
const KPI_CADENCE = [
  {
    cadence: 'Daily',
    duration: '5-minute morning check',
    items: [
      'Active subscriber count',
      'MRR (gross)',
      'New signups in last 24 hours',
      'Cancellations in last 24 hours',
      'Anthropic API spend last 24 hours',
    ],
  },
  {
    cadence: 'Weekly',
    duration: '30-minute Sunday review',
    items: [
      'Net subscriber growth (signups minus cancellations)',
      'Tier distribution shift week-over-week',
      'Trainer-by-trainer client count and earnings',
      'Cache hit rate average across all API calls',
      'Cost per acquisition by channel',
      'Top three Gunny conversation issues from logs',
    ],
  },
  {
    cadence: 'Monthly',
    duration: '90-minute month-end deep dive',
    items: [
      'Full P&L: revenue, COGS, contractor costs, fixed infra, net',
      'Cohort retention by month and tier',
      'LTV calculation by tier (gross and net)',
      'CAC by channel and CAC payback period',
      'Trainer rank distribution and rank-up velocity',
      'Phase line target tracking — on pace, ahead, or behind',
    ],
  },
  {
    cadence: 'Quarterly',
    duration: 'Phase end executive review',
    items: [
      'Compare actual to projected: subs, MRR, net, trainer count',
      'Identify largest variance and root cause',
      'Update next phase line targets if material variance (>15%)',
      'Risk register update — what changed, what new risks emerged',
      'Strategic decision review: pricing, hiring, fundraising readiness',
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────

export default function OpsRoadmap() {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* CLASSIFIED HEADER */}
      <header style={{ borderBottom: '1px solid var(--border-green-soft)', paddingBottom: 16 }}>
        <div className="t-mono-sm" style={{ color: 'var(--danger)', letterSpacing: 2, marginBottom: 6 }}>
          // CLASSIFIED · STRATEGIC OPS BRIEF
        </div>
        <h1 className="t-display-xl" style={{ fontSize: 26, color: 'var(--green)', marginBottom: 4, textShadow: '0 0 12px rgba(0,255,65,0.5)' }}>
          GUNS UP FITNESS
        </h1>
        <h2 className="t-display-l" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 10 }}>
          Pricing Strategy &amp; 15-Month Growth Roadmap
        </h2>
        <div className="t-mono-sm" style={{ color: 'var(--text-secondary)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span>v1.0 · April 2026</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>Operational period: Jun 1, 2026 – Aug 31, 2027</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span style={{ color: 'var(--amber)' }}>EARNED, NOT GIVEN.</span>
        </div>
      </header>

      {/* 01 EXECUTIVE SUMMARY */}
      <section>
        <SectionEyebrow num="01" title="Executive Summary" />
        <div className="ds-card bracket" style={{ padding: 20 }}>
          <span className="bl" /><span className="br" />
          <p className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 14 }}>
            GUNS UP enters public launch with a four-tier pricing structure that captures the dense $9.99–$14.99 mid-market while undercutting every premium competitor at the high end. The platform pays trainers 20–40% revenue share — a structural moat no AI-first fitness app currently offers. <strong style={{ color: 'var(--text-bright)' }}>The single highest-leverage activity across every phase is trainer recruitment.</strong> Subs do not arrive directly — they arrive through trainers.
          </p>
          {/* Headline projections grid */}
          <div className="t-eyebrow" style={{ marginTop: 8, marginBottom: 8 }}>// Headline projections</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {PHASES.map(p => (
              <div key={p.code} style={{ padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-green-soft)' }}>
                <div className="t-mono-sm" style={{ color: 'var(--green)', fontWeight: 700, letterSpacing: 1.5 }}>{p.code}</div>
                <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', fontSize: 9 }}>{p.period.split(',')[0].split(' – ').pop()}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Stat label="SUBS" value={p.endState.subs.toLocaleString()} />
                  <Stat label="MRR" value={`$${p.endState.mrr.toLocaleString()}`} tone="green" />
                  <Stat label="NET/MO" value={`$${p.endState.net.toLocaleString()}`} tone="amber" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 TIER STRUCTURE */}
      <section>
        <SectionEyebrow num="02" title="Tier Structure" subtitle="Confirmed pricing architecture · benchmarked vs 28 competitors" />
        <DataTable
          columns={['Field', 'RECON', 'OPERATOR', 'COMMANDER', 'WARFIGHTER']}
          rows={TIER_TABLE.map(r => [r.field, r.recon, r.operator, r.commander, r.warfighter])}
        />
      </section>

      {/* 03 UNIT ECONOMICS */}
      <section>
        <SectionEyebrow num="03" title="Unit Economics" subtitle="Per-subscriber profitability waterfall · 60% cache hit rate" />
        <DataTable
          columns={['Line', 'RECON', 'OPERATOR', 'COMMANDER', 'WARFIGHTER', 'WARFIGHTER+', 'Notes']}
          rows={ECON_TABLE.map(r => [r.line, r.recon, r.operator, r.commander, r.warfighter, r.warfighterPlus, r.notes])}
          highlightRows={[5, 6]} // PLATFORM NET + Margin %
        />
        <div className="t-mono-sm" style={{ marginTop: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Blended ARPU: <strong style={{ color: 'var(--green)' }}>$14.04</strong> (Phase 1) · <strong style={{ color: 'var(--green)' }}>$17.04</strong> (Phase 2 W+ at $79.99) ·
          Subs needed for $1,000/mo NET: <strong style={{ color: 'var(--amber)' }}>117</strong> → <strong style={{ color: 'var(--amber)' }}>98</strong>
        </div>
      </section>

      {/* 04 PHASE LINES */}
      <section>
        <SectionEyebrow num="04" title="Phase Lines" subtitle="15-month quarterly roadmap · 5 phases · ALPHA → ECHO" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {PHASES.map(p => (
            <PhaseCard key={p.code} phase={p} />
          ))}
        </div>
      </section>

      {/* 05 RECRUITMENT */}
      <section>
        <SectionEyebrow num="05" title="Trainer Recruitment Math" subtitle="The growth lever · 80/20 of trainer-to-sub ratio" />
        <DataTable
          columns={['Phase', 'Subs', 'Trainers', 'Avg Roster', 'Net to Trainer', 'Avg Pay']}
          rows={RECRUITMENT_ROWS.map(r => [r.phase, r.subs.toLocaleString(), String(r.trainers), String(r.avgRoster), r.netToTrainer, r.avgPay])}
        />
        <div className="ds-card bracket" style={{ padding: 16, marginTop: 14 }}>
          <span className="bl" /><span className="br" />
          <div className="t-eyebrow" style={{ marginBottom: 10 }}>// 80/20 of trainer recruitment</div>
          <p className="t-body-sm" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
            Five Big Fish trainers (40+ clients each) deliver more revenue than fifty Recruits (5 clients each). Recruitment focus must shift toward established trainers with existing rosters by Phase Line BRAVO.
          </p>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }} className="t-body-sm">
            <li style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>›</span>
              <span>1 Big Fish (40 clients) = 8 small trainers (5 clients each) in subscriber output</span>
            </li>
            <li style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>›</span>
              <span>1 Big Fish requires the same onboarding effort as 1 small trainer</span>
            </li>
            <li style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>›</span>
              <span>Big Fish retention is higher — they&apos;ve already proven they retain clients</span>
            </li>
            <li style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>›</span>
              <span>CAC for Big Fish is higher (more vetting, longer pitch cycle) but ROI is 5–10×</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 06 RISK REGISTER */}
      <section>
        <SectionEyebrow num="06" title="Risk Register" subtitle="Likelihood · Impact · Mitigation" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RISK_REGISTER.map((r, i) => (
            <div key={i} className="ds-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="t-display-m" style={{ color: 'var(--text-primary)', fontSize: 13 }}>{r.risk}</span>
                <RiskChip label={r.likelihood} kind="likelihood" />
                <RiskChip label={r.impact} kind="impact" />
              </div>
              <div className="t-body-sm" style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--green)' }}>Mitigation:</strong> {r.mitigation}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 07 KPI DASHBOARD */}
      <section>
        <SectionEyebrow num="07" title="KPI Dashboard" subtitle="What to track at each cadence" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {KPI_CADENCE.map(c => (
            <div key={c.cadence} className="ds-card bracket" style={{ padding: 16 }}>
              <span className="bl" /><span className="br" />
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>// {c.cadence}</div>
              <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 10, fontSize: 10 }}>
                {c.duration}
              </div>
              <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }} className="t-body-sm">
                {c.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', flexShrink: 0 }}>›</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 08 OPERATIONAL DIRECTIVE */}
      <section>
        <SectionEyebrow num="08" title="Operational Directive" subtitle="Final brief · approved for execution" />
        <div className="ds-card bracket amber amber-tone" style={{ padding: 20 }}>
          <span className="bl" /><span className="br" />
          <p className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
            GUNS UP launches on a pricing structure that captures real margin, undercuts every premium competitor, and gives trainers a real revenue stream nobody else in the AI fitness category offers. The path from public launch to $15,000/month platform net is 15 months of disciplined execution against the five phase lines documented above.
          </p>
          <p className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
            The numbers are aggressive but not fantasy. Every projection is grounded in March 2026 unit economics, validated cache hit rates, and conservative blended tier mix assumptions. The single largest variable is trainer recruitment velocity. Hit Big Fish trainers early and the model accelerates. Stick with Recruit-tier trainers only and the model still works but slower.
          </p>
          <p className="t-body-sm" style={{ color: 'var(--amber)', lineHeight: 1.6, fontWeight: 600 }}>
            This document is a directive, not a forecast. Phase line targets are commitments. Variance from target requires written analysis, not vibes. Course corrections are expected and welcomed — drift without measurement is not.
          </p>
          <div className="t-mono-sm" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid color-mix(in srgb, var(--amber) 22%, transparent)', color: 'var(--text-secondary)' }}>
            Approved for execution: <strong style={{ color: 'var(--text-bright)' }}>RUBEN RODRIGUEZ</strong> · Founder · GUNS UP FITNESS · USMC NCO · CPT
            <br />
            Document version 1.0 · April 2026 · Next review cycle: <strong style={{ color: 'var(--green)' }}>August 31, 2026</strong> (Phase ALPHA close)
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function SectionEyebrow({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 14 }}>
      <div className="t-eyebrow">{`// ${num} · ${title}`}</div>
      {subtitle && (
        <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 4, fontSize: 11 }}>
          {subtitle}
        </div>
      )}
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' }) {
  const color = tone === 'amber' ? 'var(--amber)' : tone === 'green' ? 'var(--green)' : 'var(--text-primary)';
  return (
    <div>
      <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', fontSize: 9, letterSpacing: 1.2 }}>
        {label}
      </div>
      <div className="t-mono" style={{ color, fontSize: 13, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  highlightRows = [],
}: {
  columns: string[];
  rows: string[][];
  highlightRows?: number[];
}) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-green-soft)', background: 'var(--bg-card)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(0,255,65,0.05)' }}>
            {columns.map((c, i) => (
              <th
                key={i}
                className="t-eyebrow"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border-green-soft)',
                  color: 'var(--green)',
                  fontSize: 10,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid var(--border-green-soft)',
                background: highlightRows.includes(i) ? 'rgba(255,140,0,0.06)' : undefined,
              }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={j === 0 ? 't-mono' : 't-mono-sm'}
                  style={{
                    padding: '8px 12px',
                    color: highlightRows.includes(i) ? 'var(--amber)' : (j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)'),
                    fontWeight: highlightRows.includes(i) ? 700 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhaseCard({ phase }: { phase: PhaseLine }) {
  return (
    <div className="ds-card bracket" style={{ padding: 18 }}>
      <span className="bl" /><span className="br" />

      {/* Header — code + quarter + title + period */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 10, borderBottom: '1px dashed rgba(0,255,65,0.15)' }}>
        <div className="t-display-l" style={{ color: 'var(--green)', fontSize: 22, letterSpacing: 3, textShadow: '0 0 8px rgba(0,255,65,0.4)' }}>
          {phase.code}
        </div>
        <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
          PHASE LINE · {phase.quarter}
        </div>
        <div style={{ flex: 1 }} />
        <div className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>
          {phase.period} · {phase.days} days
        </div>
      </div>

      <div className="t-display-m" style={{ color: 'var(--text-primary)', fontSize: 15, marginBottom: 12 }}>
        {phase.title}
      </div>

      {/* End-state targets */}
      <div className="t-eyebrow amber" style={{ marginBottom: 8 }}>// End-state targets</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Stat label="SUBS" value={phase.endState.subs.toLocaleString()} />
        <Stat label="MRR" value={`$${phase.endState.mrr.toLocaleString()}`} tone="green" />
        <Stat label="NET / MO" value={`$${phase.endState.net.toLocaleString()}`} tone="amber" />
        <Stat label="TRAINERS" value={phase.endState.trainers} />
      </div>
      {phase.highlights.length > 0 && (
        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '0 0 14px 0' }} className="t-body-sm">
          {phase.highlights.map((h, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--amber)', fontFamily: 'var(--mono)' }}>◆</span>
              <span style={{ color: 'var(--text-primary)' }}>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Monthly milestones */}
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>// Monthly milestones</div>
      <DataTable
        columns={['Month', 'Subs', 'MRR', 'Net']}
        rows={phase.milestones.map(m => [m.month, m.subs.toLocaleString(), `$${m.mrr.toLocaleString()}`, `$${m.net.toLocaleString()}`])}
      />

      {/* Action items */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {phase.actions.map(a => (
          <div key={a.group}>
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>// Action items — {a.group.toLowerCase()}</div>
            <ol style={{ paddingLeft: 22, margin: 0 }} className="t-body-sm">
              {a.items.map((item, i) => (
                <li key={i} style={{ marginBottom: 6, color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5 }}>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Risk flags (only on phases that have them — currently just ALPHA) */}
      {phase.risks && phase.risks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="t-eyebrow" style={{ marginBottom: 6, color: 'var(--danger)' }}>
            <Icon.Warning size={11} /> Risk flags
          </div>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }} className="t-body-sm">
            {phase.risks.map((r, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{r.risk}.</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>Mitigation: {r.mitigation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RiskChip({ label, kind }: { label: string; kind: 'likelihood' | 'impact' }) {
  const color = label === 'CRITICAL' || label === 'HIGH'
    ? 'var(--danger)'
    : label === 'MEDIUM'
      ? 'var(--amber)'
      : 'var(--text-tertiary)';
  return (
    <span
      className="t-mono-sm"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 9,
        letterSpacing: 1.2,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', fontSize: 8 }}>{kind === 'likelihood' ? 'L:' : 'I:'}</span>
      {label}
    </span>
  );
}
