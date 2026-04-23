// Single source of truth for Anthropic model IDs used by the API routes.
//
// Why centralize: the same tier → model map was duplicated across
// /api/gunny, /api/gunny/sitrep, /api/gunny/daily-brief, and more. When
// Anthropic retires a model name (they do, roughly yearly), every route
// had to be updated by hand and at least one always got missed. Touch
// this file and all four routes pick up the change.
//
// If you see a 404/model-not-found error at runtime and the app shows
// "⚠ [DEBUG · RAMPAGE] type: model" in the Gunny fallback, that means
// the string below has been deprecated upstream. Check the Anthropic
// docs, update the constant, and deploy.

export type AppTier = 'haiku' | 'sonnet' | 'opus' | 'white_glove';

export const TIER_MODEL_MAP: Readonly<Record<AppTier, string>> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  white_glove: 'claude-opus-4-6',
};

// Fallback when tier is missing/unknown on an incoming request.
export const DEFAULT_MODEL = TIER_MODEL_MAP.haiku;

// RAMPAGE owner override — used to force Opus for the platform owner regardless
// of their stored tier (the owner uses the highest-quality responses for QA).
export const OWNER_OVERRIDE_MODEL = TIER_MODEL_MAP.opus;

// Specialized routes use a fixed model instead of reading from the tier map,
// because their output quality/cost profile is orthogonal to the user's tier.
export const PHOTO_ANALYSIS_MODEL = TIER_MODEL_MAP.sonnet; // nutrition/analyze-photo
export const SITREP_MODEL_FALLBACK = TIER_MODEL_MAP.sonnet; // sitrep route's default floor
export const DAILY_BRIEF_MODEL_FALLBACK = TIER_MODEL_MAP.haiku;

/**
 * Resolve the model for a given tier, falling back to DEFAULT_MODEL for
 * unknown/missing tiers. Safer than raw Record access which returns
 * undefined and can surface as cryptic errors from the SDK.
 */
export function resolveTierModel(tier: string | undefined | null): string {
  if (tier && tier in TIER_MODEL_MAP) {
    return TIER_MODEL_MAP[tier as AppTier];
  }
  return DEFAULT_MODEL;
}
