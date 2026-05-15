'use client';

import React, { useMemo } from 'react';
import { Operator } from '@/lib/types';
import { toLocalDateStr } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/i18n';
import Icon from './Icons';

interface AchievementsProps {
  operator: Operator;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  // Icon now flows through Icons.tsx — we render a tier-tinted SVG
  // sized to the badge layout. Per Major Update Workstream 1: pure
  // SVG paths, no emoji characters in any badge definition.
  icon: React.ReactNode;
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
  const { t } = useLanguage();
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

    // Per-badge icon size — fits the .ds-card.bracket badge layout.
    const ic = (Comp: React.FC<{ size?: number }>) => <Comp size={20} />;

    return [
      // WORKOUT BADGES
      { id: 'first-blood', name: t('achievements.first_blood.name'), description: t('achievements.first_blood.desc'), icon: ic(Icon.Target),
        tier: 'bronze', category: 'workout', earned: completedWorkouts.length >= 1,
        progress: Math.min(100, (completedWorkouts.length / 1) * 100), requirement: t('achievements.first_blood.req') },
      { id: 'ten-hut', name: t('achievements.ten_hut.name'), description: t('achievements.ten_hut.desc'), icon: ic(Icon.Dumbbell),
        tier: 'bronze', category: 'workout', earned: completedWorkouts.length >= 10,
        progress: Math.min(100, (completedWorkouts.length / 10) * 100), requirement: t('achievements.ten_hut.req') },
      { id: 'fifty-cal', name: t('achievements.fifty_cal.name'), description: t('achievements.fifty_cal.desc'), icon: ic(Icon.Bolt),
        tier: 'silver', category: 'workout', earned: completedWorkouts.length >= 50,
        progress: Math.min(100, (completedWorkouts.length / 50) * 100), requirement: t('achievements.fifty_cal.req') },
      { id: 'centurion', name: t('achievements.centurion.name'), description: t('achievements.centurion.desc'), icon: ic(Icon.Trophy),
        tier: 'gold', category: 'workout', earned: completedWorkouts.length >= 100,
        progress: Math.min(100, (completedWorkouts.length / 100) * 100), requirement: t('achievements.centurion.req') },
      { id: 'war-machine', name: t('achievements.war_machine.name'), description: t('achievements.war_machine.desc'), icon: ic(Icon.Bolt),
        tier: 'diamond', category: 'workout', earned: completedWorkouts.length >= 365,
        progress: Math.min(100, (completedWorkouts.length / 365) * 100), requirement: t('achievements.war_machine.req') },

      // STREAK BADGES — flame icon for all streak tiers, color
      // already differentiates them via tier-tinted card border.
      { id: 'week-warrior', name: t('achievements.week_warrior.name'), description: t('achievements.week_warrior.desc'), icon: ic(Icon.Flame),
        tier: 'bronze', category: 'streak', earned: streak >= 7,
        progress: Math.min(100, (streak / 7) * 100), requirement: t('achievements.week_warrior.req') },
      { id: 'iron-will', name: t('achievements.iron_will.name'), description: t('achievements.iron_will.desc'), icon: ic(Icon.Flame),
        tier: 'silver', category: 'streak', earned: streak >= 30,
        progress: Math.min(100, (streak / 30) * 100), requirement: t('achievements.iron_will.req') },
      { id: 'unbreakable', name: t('achievements.unbreakable.name'), description: t('achievements.unbreakable.desc'), icon: ic(Icon.Flame),
        tier: 'gold', category: 'streak', earned: streak >= 90,
        progress: Math.min(100, (streak / 90) * 100), requirement: t('achievements.unbreakable.req') },
      { id: 'legend', name: t('achievements.legend.name'), description: t('achievements.legend.desc'), icon: ic(Icon.Trophy),
        tier: 'diamond', category: 'streak', earned: streak >= 365,
        progress: Math.min(100, (streak / 365) * 100), requirement: t('achievements.legend.req') },

      // STRENGTH BADGES
      { id: 'pr-hunter', name: t('achievements.pr_hunter.name'), description: t('achievements.pr_hunter.desc'), icon: ic(Icon.Trophy),
        tier: 'bronze', category: 'strength', earned: prs.length >= 1,
        progress: Math.min(100, (prs.length / 1) * 100), requirement: t('achievements.pr_hunter.req') },
      { id: 'pr-collector', name: t('achievements.pr_collector.name'), description: t('achievements.pr_collector.desc'), icon: ic(Icon.Trophy),
        tier: 'silver', category: 'strength', earned: prs.length >= 10,
        progress: Math.min(100, (prs.length / 10) * 100), requirement: t('achievements.pr_collector.req') },
      { id: 'two-plate-club', name: t('achievements.two_plate.name'), description: t('achievements.two_plate.desc'), icon: ic(Icon.Dumbbell),
        tier: 'gold', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('bench') && p.weight >= 225),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('bench')).map(p => p.weight)) / 225) * 100),
        requirement: t('achievements.two_plate.req') },
      { id: 'three-plate-club', name: t('achievements.three_plate.name'), description: t('achievements.three_plate.desc'), icon: ic(Icon.Dumbbell),
        tier: 'gold', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('squat') && p.weight >= 315),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('squat')).map(p => p.weight)) / 315) * 100),
        requirement: t('achievements.three_plate.req') },
      { id: 'four-plate-club', name: t('achievements.four_plate.name'), description: t('achievements.four_plate.desc'), icon: ic(Icon.Trophy),
        tier: 'diamond', category: 'strength',
        earned: prs.some(p => p.exercise.toLowerCase().includes('deadlift') && p.weight >= 405),
        progress: Math.min(100, (Math.max(0, ...prs.filter(p => p.exercise.toLowerCase().includes('deadlift')).map(p => p.weight)) / 405) * 100),
        requirement: t('achievements.four_plate.req') },
      { id: '1000-club', name: t('achievements.thousand_club.name'), description: t('achievements.thousand_club.desc'), icon: ic(Icon.Trophy),
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
        requirement: t('achievements.thousand_club.req') },

      // NUTRITION BADGES
      { id: 'fuel-up', name: t('achievements.fuel_up.name'), description: t('achievements.fuel_up.desc'), icon: ic(Icon.Food),
        tier: 'bronze', category: 'nutrition', earned: totalMeals >= 1,
        progress: Math.min(100, (totalMeals / 1) * 100), requirement: t('achievements.fuel_up.req') },
      { id: 'meal-prepper', name: t('achievements.meal_prepper.name'), description: t('achievements.meal_prepper.desc'), icon: ic(Icon.Food),
        tier: 'silver', category: 'nutrition', earned: totalMeals >= 50,
        progress: Math.min(100, (totalMeals / 50) * 100), requirement: t('achievements.meal_prepper.req') },
      { id: 'nutrition-machine', name: t('achievements.nutrition_machine.name'), description: t('achievements.nutrition_machine.desc'), icon: ic(Icon.Food),
        tier: 'gold', category: 'nutrition', earned: totalMeals >= 200,
        progress: Math.min(100, (totalMeals / 200) * 100), requirement: t('achievements.nutrition_machine.req') },

      // MILESTONE BADGES
      { id: 'enlisted', name: t('achievements.enlisted.name'), description: t('achievements.enlisted.desc'), icon: ic(Icon.User),
        tier: 'bronze', category: 'milestone', earned: !!intakeComplete,
        progress: intakeComplete ? 100 : 0, requirement: t('achievements.enlisted.req') },
      { id: 'connected', name: t('achievements.connected.name'), description: t('achievements.connected.desc'), icon: ic(Icon.Heart),
        tier: 'bronze', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).wearableConnected,
        progress: (operator as unknown as Record<string, unknown>).wearableConnected ? 100 : 0,
        requirement: t('achievements.connected.req') },

      // COMMS / VOICE — unlocks once the operator uses tactical radio voice
      // input. We mark it earned when the voice-input flag is set on the
      // operator record (set by TacticalRadio on first successful PTT
      // transcription) — same gating pattern as 'connected' above.
      { id: 'comms-check', name: t('achievements.comms_check.name'), description: t('achievements.comms_check.desc'), icon: ic(Icon.Mic),
        tier: 'bronze', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).voiceInputUsed,
        progress: (operator as unknown as Record<string, unknown>).voiceInputUsed ? 100 : 0,
        requirement: t('achievements.comms_check.req') },

      // ZONE LOCK — fires when the user has logged at least one workout
      // with live HR data captured (proxy: wearable connected AND a
      // completed workout exists). Encourages the cardio/HR-zone flow
      // that the Commander tier unlocks.
      { id: 'zone-lock', name: t('achievements.zone_lock.name'), description: t('achievements.zone_lock.desc'), icon: ic(Icon.Heart),
        tier: 'silver', category: 'milestone',
        earned: !!(operator as unknown as Record<string, unknown>).wearableConnected && completedWorkouts.length >= 1,
        progress:
          (operator as unknown as Record<string, unknown>).wearableConnected && completedWorkouts.length >= 1
            ? 100
            : (operator as unknown as Record<string, unknown>).wearableConnected
              ? 50
              : 0,
        requirement: t('achievements.zone_lock.req') },
    ] as Badge[];
  }, [operator, t]);

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
            {/* Tier-tinted icon. .icon is a ReactNode (SVG) — color
                cascades through currentColor via the wrapper span. */}
            <span style={{ color: badge.earned ? colors.text : 'var(--text-tertiary)', display: 'inline-flex', lineHeight: 0 }}>
              {badge.icon}
            </span>
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
                {t('achievements.requirement_progress').replace('{percent}', String(Math.round(badge.progress))).replace('{requirement}', badge.requirement)}
              </div>
            </div>
          )}
          {badge.earned && (
            <div
              className="t-mono-sm"
              style={{ color: colors.border, marginTop: 4, fontSize: 8 }}
            >
              {t('achievements.earned_prefix')} {t(`achievements.tier.${badge.tier}`)}
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
            {t('achievements.level')} {level}
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {t('achievements.xp_to_next').replace('{xp}', String(xp)).replace('{toNext}', String(xpToNext))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="t-num-display">{earnedBadges.length}</div>
          <div className="t-mono-sm" style={{ color: 'var(--text-tertiary)' }}>
            / {badges.length} {t('achievements.badges_suffix')}
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
          {sectionLabel(t('achievements.section_earned'), earnedBadges.length, 'green')}
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
          {sectionLabel(t('achievements.section_in_progress'), inProgressBadges.length, 'amber')}
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
          {sectionLabel(t('achievements.section_locked'), lockedBadges.length, 'dim')}
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
