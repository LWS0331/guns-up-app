// Tier gating — runtime checks for which features each operator can access.
//
// Pricing model claims (per the Feature Report spreadsheet):
//   - OPERATOR+ gates: Nutrition History, Volume Tracking, Strength
//     Progression, Workout Frequency, Body Composition
//   - COMMANDER+ gates: Wearable Connection, Live HR Zones, Sleep &
//     Recovery, HR Line Graph
//
// Tier rank: haiku (RECON) < sonnet (OPERATOR) < opus (COMMANDER) <
// white_glove (WARFIGHTER). Higher rank gets everything below it.
//
// TRAINER + ADMIN bypass: trainers always have full access to coach
// their clients regardless of subscription tier. OPS_CENTER_ACCESS
// admins (e.g. RAMPAGE) likewise. Only client/junior operators are
// gated by `tier`.

import { OPS_CENTER_ACCESS } from './types';

export type TierKey = 'haiku' | 'sonnet' | 'opus' | 'white_glove';

const TIER_RANK: Record<TierKey, number> = {
  haiku: 1,        // RECON
  sonnet: 2,       // OPERATOR
  opus: 3,         // COMMANDER
  white_glove: 4,  // WARFIGHTER
};

export interface GatedOperator {
  id?: string;
  tier?: string;
  role?: string;
}

function isAdminOrTrainer(op: GatedOperator | undefined): boolean {
  if (!op) return false;
  if (op.role === 'trainer') return true;
  if (op.id && OPS_CENTER_ACCESS.includes(op.id)) return true;
  return false;
}

function tierAtLeast(currentTier: string | undefined, requiredTier: TierKey): boolean {
  if (!currentTier) return false;
  const cur = TIER_RANK[currentTier as TierKey] ?? 0;
  const req = TIER_RANK[requiredTier];
  return cur >= req;
}

/**
 * Operator can access OPERATOR-tier features (Sonnet, Opus, White Glove).
 * Gated features: Nutrition History 14-day chart, Volume Tracking,
 * Strength Progression, Workout Frequency, Body Composition.
 */
export function hasOperatorAccess(op: GatedOperator | undefined): boolean {
  if (isAdminOrTrainer(op)) return true;
  return tierAtLeast(op?.tier, 'sonnet');
}

/**
 * Operator can access COMMANDER-tier features (Opus, White Glove).
 * Gated features: Wearable Connection, Live HR Zone Tracking, Sleep &
 * Recovery Metrics, HR Line Graph SVG.
 */
export function hasCommanderAccess(op: GatedOperator | undefined): boolean {
  if (isAdminOrTrainer(op)) return true;
  return tierAtLeast(op?.tier, 'opus');
}

/**
 * Operator can access WARFIGHTER-tier features (White Glove only).
 * Currently used for: human trainer assignment, AI Form Analysis (planned).
 */
export function hasWarfighterAccess(op: GatedOperator | undefined): boolean {
  if (isAdminOrTrainer(op)) return true;
  return tierAtLeast(op?.tier, 'white_glove');
}

/**
 * Display label for the tier name (used in upgrade prompts).
 */
export function tierLabel(tier: string | undefined): string {
  switch (tier as TierKey) {
    case 'haiku': return 'RECON';
    case 'sonnet': return 'OPERATOR';
    case 'opus': return 'COMMANDER';
    case 'white_glove': return 'WARFIGHTER';
    default: return 'UNKNOWN';
  }
}

/**
 * What does the user need to upgrade to in order to unlock a feature
 * gated at the given required tier? Returns the next-step tier label.
 */
export function upgradeTargetLabel(requiredTier: 'sonnet' | 'opus' | 'white_glove'): string {
  return tierLabel(requiredTier);
}
