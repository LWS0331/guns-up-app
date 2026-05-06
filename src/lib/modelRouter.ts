// Per-query model auto-routing.
//
// The default Gunny route maps tier → fixed model in src/lib/models.ts.
// That's wasteful: a WARFIGHTER replying "thanks champ" burns Opus
// tokens, and a COMMANDER asking "log this meal" gets Opus when Sonnet
// would do. This module adds a deterministic classifier and a per-tier
// picker so the route can swap to a cheaper model on routine asks
// without ever degrading the WARFIGHTER experience.
//
// Two hard guardrails:
//   - WARFIGHTER (white_glove) is ALWAYS Opus, every classification.
//     They pay for premium and never see a downgrade.
//   - RECON (haiku) stays at Haiku. Vision and complex routing are
//     upsell features — RECON + image returns a sentinel so the caller
//     can short-circuit with an upgrade nudge.
//
// Gated by isModelAutorouteEnabledServer() in featureFlags.ts. When
// the flag is off, callers should keep using resolveTierModel() and
// this module is unused.

import { TIER_MODEL_MAP, OWNER_OVERRIDE_MODEL } from './models';
import type { AiTier } from './types';

export type Classification = 'trivial' | 'routine' | 'complex' | 'vision';

export type RoutingDecision = {
  // null is the RECON+vision sentinel — caller should short-circuit
  // with a structured upsell response instead of calling Anthropic.
  model: string | null;
  classification: Classification;
  reason: string;
  routedDown: boolean;
};

// Strip the structured tags Gunny emits in assistant turns so prior-
// turn payloads in conversation history don't pollute classification
// when callers feed in a longer slice. Same regex shape used by the
// chat history hydration path in /api/gunny/route.ts.
const STRUCTURED_TAG_RE =
  /<(?:meal_json|pr_json|workout_json|workout_modification|workout_delete|profile_json|voice_control)>[\s\S]*?<\/(?:meal_json|pr_json|workout_json|workout_modification|workout_delete|profile_json|voice_control)>/g;

const TRIVIAL_KEYWORDS = [
  'done', 'logged', 'thanks', 'roger', 'ok', 'okay',
  'yes', 'no', 'next', 'skip', 'copy',
];

// Data-lookup vocabulary. Short factual queries about logged data —
// "did I hit macros", "calories today", "what's my protein" — score
// as 'trivial' under the length-only heuristic (≤30 chars, no
// complex/trivial keyword hits → score -2). On Sonnet tier, trivial
// downgrades to Haiku, which hallucinates from the prompt-stuffed
// NUTRITION HISTORY / WORKOUT HISTORY blocks. Reported May 5: Gunny
// inventing meal totals on Sonnet-tier operators. Floor data-lookup
// queries at 'routine' so they stay on Sonnet (the model the
// nutrition system prompt was tuned against). Cost impact is small —
// these are still short messages and Sonnet remains the ceiling for
// the tier; we're just blocking the trivial→Haiku step-down for the
// narrow class of asks that need to read context accurately.
const DATA_LOOKUP_KEYWORDS = [
  'calories', 'cal', 'kcal', 'macros', 'macro', 'protein', 'carbs', 'carb', 'fat',
  'meals', 'meal', 'ate', 'eaten', 'eat', 'lunch', 'breakfast', 'dinner', 'snack',
  'weight', 'lbs', 'kg', 'bf', 'bodyfat',
  'pr', 'prs', '1rm', 'lifted', 'lift', 'sets', 'reps',
  'workout', 'workouts', 'session', 'sessions', 'streak',
  'how many', 'how much', 'how close', 'did i', 'have i', 'what did',
];

const COMPLEX_KEYWORDS = [
  'explain', 'why', 'compare', 'design',
  'macrocycle', 'mesocycle', 'microcycle',
  'periodization', 'periodise', 'periodize', 'periodizing',
  'deload', 'plan my', 'recommend', 'analyze', 'diagnose', 'should i',
  'strategy', 'protocol', 'block', 'phase',
];

function buildKeywordRegex(words: string[]): RegExp {
  // Word-boundary matching, case-insensitive. Multi-word phrases like
  // "plan my" / "should i" are escaped and joined verbatim — the regex
  // engine handles the space between tokens.
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
}

const TRIVIAL_RE = buildKeywordRegex(TRIVIAL_KEYWORDS);
const COMPLEX_RE = buildKeywordRegex(COMPLEX_KEYWORDS);
const DATA_LOOKUP_RE = buildKeywordRegex(DATA_LOOKUP_KEYWORDS);

/**
 * Score-based classifier. No LLM call — pure heuristic.
 * Borderline cases bias toward 'routine' (route up, not down).
 */
export function classifyQueryComplexity(
  latestUserText: string,
  hasImage: boolean,
  mode: 'assistant' | 'onboarding' | 'ops' | undefined,
): Classification {
  if (hasImage) return 'vision';

  const text = (latestUserText || '').replace(STRUCTURED_TAG_RE, '').trim();
  if (text.length === 0) return 'routine';

  let score = 0;

  if (text.length < 30) score -= 2;
  else if (text.length > 140) score += 2;
  else if (text.length > 80) score += 1;

  const trivialHits = (text.match(TRIVIAL_RE) || []).length;
  const complexHits = (text.match(COMPLEX_RE) || []).length;
  score -= trivialHits;
  score += complexHits;

  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 2) score += 1;

  if (mode === 'ops') score += 2;
  else if (mode === 'onboarding') score += 1;

  if (score >= 3) return 'complex';
  // Data-lookup floor: short factual questions about logged macros,
  // calories, meals, PRs, workouts must stay at 'routine' so Sonnet-tier
  // operators don't get downgraded to Haiku (which hallucinates from
  // the prompt-stuffed NUTRITION HISTORY block). Punctuation-light
  // mobile asks like "did I hit macros" or "calories today" otherwise
  // land at score -2 → trivial → Haiku. See DATA_LOOKUP_KEYWORDS.
  const hasDataLookup = (text.match(DATA_LOOKUP_RE) || []).length > 0;
  if (score <= -2 && !hasDataLookup) return 'trivial';
  return 'routine';
}

/**
 * Per-tier ceiling/floor matrix.
 *
 * white_glove → Opus for every classification. Never downgraded.
 * opus        → Sonnet for trivial/routine, Opus for complex/vision.
 * sonnet      → Haiku for trivial, Sonnet for routine/complex/vision.
 * haiku       → Haiku for everything except vision (sentinel: null).
 * owner override (RAMPAGE) → Opus regardless.
 */
export function pickModelForQuery(
  tier: AiTier | string | null | undefined,
  classification: Classification,
  ownerOverride: boolean,
): RoutingDecision {
  if (ownerOverride) {
    return {
      model: OWNER_OVERRIDE_MODEL,
      classification,
      reason: 'owner-override',
      routedDown: false,
    };
  }

  const ceilingModel =
    tier && tier in TIER_MODEL_MAP
      ? TIER_MODEL_MAP[tier as AiTier]
      : TIER_MODEL_MAP.haiku;

  if (tier === 'white_glove') {
    return {
      model: TIER_MODEL_MAP.white_glove,
      classification,
      reason: 'warfighter-floor',
      routedDown: false,
    };
  }

  if (tier === 'haiku') {
    if (classification === 'vision') {
      return {
        model: null,
        classification,
        reason: 'vision-gated-recon',
        routedDown: false,
      };
    }
    return {
      model: TIER_MODEL_MAP.haiku,
      classification,
      reason: 'recon-pinned',
      routedDown: false,
    };
  }

  if (tier === 'opus') {
    if (classification === 'trivial' || classification === 'routine') {
      return {
        model: TIER_MODEL_MAP.sonnet,
        classification,
        reason: 'commander-routed-down-to-sonnet',
        routedDown: true,
      };
    }
    return {
      model: TIER_MODEL_MAP.opus,
      classification,
      reason: 'commander-ceiling',
      routedDown: false,
    };
  }

  if (tier === 'sonnet') {
    if (classification === 'trivial') {
      return {
        model: TIER_MODEL_MAP.haiku,
        classification,
        reason: 'operator-routed-down-to-haiku',
        routedDown: true,
      };
    }
    return {
      model: TIER_MODEL_MAP.sonnet,
      classification,
      reason: 'operator-ceiling',
      routedDown: false,
    };
  }

  // Unknown / missing tier — fall back to the resolver's default
  // (Haiku) so we don't accidentally hand a paid model to a request
  // with a malformed body.
  return {
    model: ceilingModel,
    classification,
    reason: 'unknown-tier-fallback',
    routedDown: false,
  };
}
