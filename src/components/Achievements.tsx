'use client';

import React, { useMemo } from 'react';
import { Operator } from '@/lib/types';
import { toLocalDateStr } from '@/lib/dateUtils';

interface AchievementsProps {
  operator: Operator;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  category: 'workout' | 'nutrition' | 'strength' | 'streak' | 'social' | 'milestone';
  earned: boolean;
  earnedDate?: string;
  progress: number; // 0-100
  requirement: string;
}

const BADGE_COLORS = {
  bronze: { bg: '#8B4513', border: '#CD853F', text: '#FFD700' },
  silver: { bg: '#708090', border: '#888888', text: '#FFFFFF' },
  gold: { bg: '#B8860B', border: '#FFD700', text: '#FFFFFF' },
  diamond: { bg: '#00ff41', border: '#00ff41', text: '#FFFFFF' },
};

const Achievements: React.FC<AchievementsProps> = ({ operator }) => {
  const badges = useMemo<Badge[]>(() => {
    const workouts = Object.values(operator.workouts || {});
    const completedWorkouts = workouts.filter(w => w.completed);
    const prs = operator.prs || [];
    const meals = Object.values(operator.nutrition?.meals || {});
    const totalMeals = meals.reduce((acc, day) => acc + (Array.isArray(day) ? day.length : 0), 0);

    // Calculate streak
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toLocalDateStr(d);
      if (operator.workouts?.[key]?.completed) streak++;
      else if (i > 0) break;
    }

    const intakeComplete = operator.intake && (operator.intake as unknown as Record<string, unknown>).completed !== false;

    return [
      // WORKOUT BADGES
      { id: 'first-blood', name: 'FIRST BLOOD', description: 'Complete your first workout', icon: '🎯',
        tier: 'bronze', category: 'workout', earned: completedWorkouts.length >= 1,
        progress: Math.min(100, (completedWorkouts.length / 1) * 100), requirement: '1 workout' },
      { id: 'ten-hut', name: 'TEN HUT', description: 'Complete 10 workouts', icon: '💪',
        tier: 'bronze', category: 'workout', earned: completedWorkouts.length >= 10,
        progress: Math.min(100, (completedWorkouts.length / 10) * 100), requirement: '10 workouts' },
      { id: 'fifty-cal', name: 'FIFTY CAL', description: 'Complete 50 workouts', icon: '🔫',
        tier: 'silver', category: 'workout', earned: completedWorkouts.length >= 50,
        progress: Math.min(100, (completedWorkouts.length / 50) * 100), requirement: '50 workouts' },
      { id: 'centurion', name: 'CENTURION', description: 'Complete 100 workouts', icon: '🏛️',
        tier: 'gold', category: 'workout', earned: completedWorkouts.length >= 100,
        progress: Math.min(100, (completedWorkouts.length / 100) * 100), requirement: '100 workouts' },
      { id: 'war-machine', name: 'WAR MACHINE', description: 'Complete 365 workouts', icon: '⚔️',
        tier: 'diamond', category: 'workout', earned: completedWorkouts.length >= 365,
        progress: Math.min(100, (completedWorkouts.length / 365) * 100), requirement: '365 workouts' },

      // STREAK BADGES
      { id: 'week-warrior', name: 'WEEK WARRIOR', description: '7-day workout streak', icon: '🔥',
        tier: 'bronze', category: 'streak', earned: streak >= 7,
        progress: Math.min(100, (streak / 7) * 100), requirement: '7 consecutive days' },
      { id: 'iron-will', name: 'IRON WILL', description: '30-day workout streak', icon: '🔥',
        tier: 'silver', category: 'streak', earned: streak >= 30,
        progress: Math.min(100, (streak / 30) * 100), requirement: '30 consecutive days' },
      { id: 'unbreakable', name: 'UNBREAKABLE', description: '90-day workout streak', icon: '💎',
        tier: 'gold', category: 'streak', earned: streak >= 90,
        progress: Math.min(100, (streak / 90) * 100), requirement: '90 consecutive days' },
      { id: 'legend', name: 'LEGEND', description: '365-day workout streak', icon: '👑',
        tier: 'diamond', category: 'streak', earned: streak >= 365,
        progress: Math.min(100, (streak / 365) * 100), requirement: '365 consecutive days' },

      // STRENGTH BADGES
      { id: 'pr-hunter', name: 'PR HUNTER', description: 'Log your first PR', icon: '🏆',
        tier: 'bronze', category: 'strength', earned: prs.length >= 1,
        progress: Math.min(100, (prs.length / 1) * 100), requirement: '1 PR logged' },
      { id: 'pr-collector', name: 'PR COLLECTOR', description: 'Log 10 personal records', icon: '🏆',
        tier: 'silver', category: 'strength', earned: prs.length >= 10,
        progress: Math.min(100, (prs.length / 10) * 100), requirement: '10 PRs logged' },
      { id: 'two-plate-club', name: '2 PLATE CLUB', description: 'Bench press 225 lbs', icon: '🏅',
        tier: 'gold', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('bench') && p.weight >= 225),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('bench')).map(p => p.weight)) / 225) * 100),
        requirement: '225 lbs bench' },
      { id: 'three-plate-club', name: '3 PLATE CLUB', description: 'Squat 315 lbs', icon: '🥇',
        tier: 'gold', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('squat') && p.weight >= 315),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('squat')).map(p => p.weight)) / 315) * 100),
        requirement: '315 lbs squat' },
      { id: 'four-plate-club', name: '4 PLATE CLUB', description: 'Deadlift 405 lbs', icon: '🏆',
        tier: 'diamond', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('deadlift') && p.weight >= 405),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('deadlift')).map(p => p.weight)) / 405) * 100),
        requirement: '405 lbs deadlift' },
      { id: '1000-club', name: '1000 LB CLUB', description: 'Combined SBD total over 1000 lbs', icon: '💀',
        tier: 'diamond', category: 'strength',
        earned: (() => {
          const bestSquat = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('squat')).map(p => p.weight));
          const bestBench = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('bench')).map(p => p.weight));
          const bestDead = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('deadlift')).map(p => p.weight));
          return (bestSquat + bestBench + bestDead) >= 1000;
        })(),
        progress: (() => {
          const bestSquat = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('squat')).map(p => p.weight));
          const bestBench = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('bench')).map(p => p.weight));
          const bestDead = Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('deadlift')).map(p => p.weight));
          return Math.min(100, ((bestSquat + bestBench + bestDead) / 1000) * 100);
        })(),
        requirement: 'S+B+D = 1000+ lbs' },

      // NUTRITION BADGES
      { id: 'fuel-up', name: 'FUEL UP', description: 'Log your first meal', icon: '🍗',
        tier: 'bronze', category: 'nutrition', earned: totalMeals >= 1,
        progress: Math.min(100, (totalMeals / 1) * 100), requirement: '1 meal logged' },
      { id: 'meal-prepper', name: 'MEAL PREPPER', description: 'Log 50 meals', icon: '🥩',
        tier: 'silver', category: 'nutrition', earned: totalMeals >= 50,
        progress: Math.min(100, (totalMeals / 50) * 100), requirement: '50 meals logged' },
      { id: 'nutrition-machine', name: 'NUTRITION MACHINE', description: 'Log 200 meals', icon: '🍱',
        tier: 'gold', category: 'nutrition', earned: totalMeals >= 200,
        progress: Math.min(100, (totalMeals / 200) * 100), requirement: '200 meals logged' },

      // MILESTONE BADGES
      { id: 'enlisted', name: 'ENLISTED', description: 'Complete intake assessment', icon: '📋',
        tier: 'bronze', category: 'milestone', earned: !!intakeComplete,
        progress: intakeComplete ? 100 : 0, requirement: 'Complete intake' },
      { id: 'connected', name: 'CONNECTED', description: 'Link a wearable device', icon: '⌚',
        tier: 'bronze', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).wearableConnected,
        progress: (operator as unknown as Record<string, unknown>).wearableConnected ? 100 : 0,
        requirement: 'Connect wearable' },

      // COMMS / VOICE — unlocks once the operator uses tactical radio voice
      // input. We mark it earned when the voice-input flag is set on the
      // operator record (set by TacticalRadio on first successful PTT
      // transcription) — same gating pattern as 'connected' above.
      { id: 'comms-check', name: 'COMMS CHECK', description: 'Use Tactical Radio voice input', icon: '🎙️',
        tier: 'bronze', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).voiceInputUsed,
        progress: (operator as unknown as Record<string, unknown>).voiceInputUsed ? 100 : 0,
        requirement: 'Use voice PTT once' },

      // ZONE LOCK — fires when the user has logged at least one workout
      // with live HR data captured (proxy: wearable connected AND a
      // completed workout exists). Encourages the cardio/HR-zone flow
      // that the Commander tier unlocks.
      { id: 'zone-lock', name: 'ZONE LOCK', description: 'Train with live HR zones', icon: '❤️',
        tier: 'silver', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).wearableConnected && completedWorkouts.length >= 1,
        progress:
          (operator as unknown as Record<string, unknown>).wearableConnected && completedWorkouts.length >= 1
            ? 100
            : (operator as unknown as Record<string, unknown>).wearableConnected
              ? 50
              : 0,
        requirement: 'Wearable + 1 workout' },
    ] as Badge[];
  }, [operator]);

  const earnedBadges = badges.filter(b => b.earned);
  const inProgressBadges = badges.filter(b => !b.earned && b.progress > 0);
  const lockedBadges = badges.filter(b => !b.earned && b.progress === 0);

  // XP calculation
  const xp = earnedBadges.reduce((total, b) => {
    const tierXP = { bronze: 50, silver: 150, gold: 500, diamond: 1000 };
    return total + tierXP[b.tier];
  }, 0);
  const level = Math.floor(xp / 500) + 1;
  const xpToNext = 500 - (xp % 500);

  const renderBadge = (badge: Badge) => {
    const colors = BADGE_COLORS[badge.tier];
    return (
      <div
        key={badge.id}
        className="ds-card bracket"
        style={{
          padding: 12,
          // Earned tier defines the background tint; locked stays
          // on the default --bg-card. Opacity drops on un-earned
          // so they read as backlogged goals, not active state.
          background: badge.earned ? `${colors.bg}22` : undefined,
          borderColor: badge.earned ? colors.border : undefined,
          opacity: badge.earned ? 1 : 0.65,
          transition: 'all 0.3s',
          overflow: 'hidden',
        }}
      >
        <span className="bl" /><span className="br" />
        {/* Progress watermark — fills the card horizontally with a
            faint tinted overlay proportional to progress. Sits below
            the content via z-index. */}
        {!badge.earned && badge.progress > 0 && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${badge.progress}%`,
              background: `${colors.border}11`,
              zIndex: 0,
            }}
          />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{badge.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div
                className="t-display-m"
                style={{ fontSize: 10, color: badge.earned ? colors.text : 'var(--text-tertiary)' }}
              >
                {badge.name}
              </div>
              <div className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: 9 }}>
                {badge.description}
              </div>
            </div>
          </div>
          {!badge.earned && (
            <div style={{ marginTop: 6 }}>
              {/* Per-badge progress — uses the canonical .bar with
                  a tier-tinted fill via inline override since each
                  tier color is dynamic. */}
              <div className="bar" style={{ height: 3 }}>
                <span style={{ width: `${badge.progress}%`, background: colors.border }} />
              </div>
              <div className="t-mono-sm" style={{ color: 'var(--text-dim)', marginTop: 2, fontSize: 8 }}>
                {Math.round(badge.progress)}% — {badge.requirement}
              </div>
            </div>
          )}
          {badge.earned && (
            <div
              className="t-mono-sm"
              style={{ color: colors.border, marginTop: 4, fontSize: 8 }}
            >
              EARNED {badge.tier.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const sectionLabel = (text: string, count: number, tone: 'green' | 'amber' | 'dim') => (
    <div
      className={`t-eyebrow${tone === 'amber' ? ' amber' : ''}`}
      style={{
        marginBottom: 8,
        color: tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)' : 'var(--text-dim)',
      }}
    >
      {text} ({count})
    </div>
  );

  return (
    <div className="stack-4">
      {/* XP / Level header — bracket card with two stat clusters
          (level + xp on the left, badge ratio on the right). The
          XP progress bar sits below as the canonical .bar. */}
      <div
        className="ds-card bracket"
        style={{
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span className="bl" /><span className="br" />
        <div>
          <div className="t-display-m" style={{ color: 'var(--warn)' }}>
            Level {level}
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {xp} XP — {xpToNext} XP to next level
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="t-num-display">{earnedBadges.length}</div>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
            / {badges.length} BADGES
          </div>
        </div>
      </div>

      {/* XP progress — gradient amber→orange to match the gamified
          XP/leveling vibe. .bar takes the colored fill via inline. */}
      <div className="bar amber" style={{ height: 6, marginBottom: 20 }}>
        <span
          style={{
            width: `${((xp % 500) / 500) * 100}%`,
            background: 'linear-gradient(90deg, var(--warn), #ff6600)',
          }}
        />
      </div>

      {earnedBadges.length > 0 && (
        <>
          {sectionLabel('Earned', earnedBadges.length, 'green')}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {earnedBadges.map(renderBadge)}
          </div>
        </>
      )}

      {inProgressBadges.length > 0 && (
        <>
          {sectionLabel('In Progress', inProgressBadges.length, 'amber')}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {inProgressBadges.map(renderBadge)}
          </div>
        </>
      )}

      {lockedBadges.length > 0 && (
        <>
          {sectionLabel('Locked', lockedBadges.length, 'dim')}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {lockedBadges.map(renderBadge)}
          </div>
        </>
      )}
    </div>
  );
};

export default Achievements;
