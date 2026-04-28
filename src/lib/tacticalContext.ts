// Tactical Fitness Path — Gunny system-prompt context injection.
//
// When an operator's `preferences.trainingPath === 'tactical'`, Gunny gets
// the full Tactical Fitness Corpus v1 loaded into the system prompt. Other
// training paths (bodybuilding, crossfit, powerlifting, athletic, hybrid)
// skip this injection to keep token cost reasonable.
//
// The corpus is ~62KB / ~16k tokens — substantial but well within Claude's
// 200k context. With prompt caching (already enabled on the Gunny route),
// the cost amortizes across an operator's session: full cost on first turn,
// near-zero on subsequent turns.
//
// Module index (so the system prompt can route operator queries to the
// right module without reading the full corpus every turn):
//   1   Foundational tactical fitness (deconditioned base building)
//   2   Active duty operator maintenance (in-garrison)
//   3   Pre-deployment ramp-up (6-12 weeks out)
//   4   Selection prep, general (mountain athlete / ruck-heavy)
//   5   Selection prep, water/swim heavy (BUD/S, Recon, AST)
//   6   Selection prep, Ranger School / SFAS specifics
//   7   PFT/AFT/PRT max-out programming
//   8   CPAT preparation (firefighter candidate)
//   9   Police academy / FBI PFT preparation
//   10  SWAT/HRT-style tactical operator
//   App. A  Assessment standards (military, LE, fire, SOF)

import { TACTICAL_FITNESS_CORPUS_V1, TACTICAL_CORPUS_VERSION } from '@/data/tacticalCorpus';

interface OperatorContextLike {
  preferences?: { trainingPath?: string } | Record<string, unknown> | null;
  intake?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  isJunior?: boolean;
}

/**
 * Returns true when this operator should get the tactical corpus
 * injected into their Gunny system prompt. Conservative: only adult
 * operators on the explicit `tactical` training path.
 */
export function shouldInjectTacticalCorpus(operatorContext: OperatorContextLike | null | undefined): boolean {
  if (!operatorContext) return false;
  if (operatorContext.isJunior) return false;  // youth athletes use SOCCER_YOUTH_PROMPT
  const prefs = (operatorContext.preferences || {}) as Record<string, unknown>;
  const path = typeof prefs.trainingPath === 'string' ? prefs.trainingPath : '';
  return path === 'tactical';
}

/**
 * Static system-prompt instruction explaining that Gunny has the
 * Tactical Fitness Corpus loaded. Always paired with the corpus body
 * itself via buildTacticalCorpusBlock — but kept separate so callers
 * can include the directive even in lightweight contexts (e.g. assistant
 * mode) without paying the corpus token cost.
 */
export const TACTICAL_CORPUS_INSTRUCTION = `TACTICAL FITNESS PROTOCOL:
This operator is on the TACTICAL training path. You have access to a
sourced 10-module tactical fitness corpus (MTI / Tactical Barbell /
SOFLETE / StrongFirst / NSCA TSAC + service doctrine FM 7-22 H2F,
MCO 6100.13A, DAFMAN 36-2905). When programming for this operator:

1. PROTOCOL FIRST: Use the corpus modules as your primary programming
   reference. Do not invent generic tactical programming when a sourced
   protocol applies.

2. ROUTE BY GOAL: Match operator's specific situation to a module:
   - Deconditioned/new-to-tactical → Module 1 (Foundational)
   - Active operator in-garrison → Module 2 (Maintenance)
   - Deployment 6-12 weeks out → Module 3 (Pre-Deployment Ramp)
   - Selection 12+ months out (general/ruck) → Module 4
   - Selection 12-24 months out (water/swim) → Module 5
   - Selection 8-12 weeks out (Ranger/SFAS) → Module 6
   - PFT/AFT/PRT peak → Module 7
   - Firefighter candidate → Module 8
   - Police academy/FBI PFT → Module 9
   - SWAT/HRT prep → Module 10

3. ASSESSMENT STANDARDS: Appendix A has the current 2026 standards for
   AFT, Marine PFT/CFT, Navy PRT, Air Force PFRA, FBI PFT, BUD/S PST,
   Ranger RPA, CPAT, NTOA SWAT PFQ, Cooper LE norms. Use the actual
   numerical cuts — don't approximate.

4. METHODOLOGY DISAGREEMENTS: The corpus flags disagreements between
   MTI and Tactical Barbell (concurrent vs phase-based, percentage vs
   3RM-based loading). When operator asks "what should I do," default
   to the safer option for their experience level (TB Base Building
   for deconditioned, MTI concurrent for active operators).

5. SAFETY NON-NEGOTIABLES: NSW PTG calisthenic volume caps (200/200/50
   daily, 1000/1000/250 weekly for push-ups/sit-ups/pull-ups). Hypoxic
   pool training prohibited (shallow-water blackout deaths). Build pace
   before adding ruck load. Antagonist balance (every push has a pull).

6. COACHING VOICE: Stay GUNS UP — tactical, direct, sourced. When you
   reference a protocol, name the source ("MTI's Big 24 cycle says...",
   "Per Tactical Barbell Operator template...", "Ranger RPA standard
   is..."). Operators on the tactical path know these names and will
   trust the references.

Corpus version: ${TACTICAL_CORPUS_VERSION}.`;

/**
 * Returns the full corpus body as a single appended block. Caller
 * concatenates onto the system prompt. Tilde-token-budgeted at ~16k —
 * acceptable for a per-operator system prompt that gets cached by
 * Anthropic's prompt-cache layer.
 */
export function buildTacticalCorpusBlock(): string {
  return `\n\n═══ TACTICAL FITNESS CORPUS ═══\n\n${TACTICAL_FITNESS_CORPUS_V1}\n\n═══ END TACTICAL CORPUS ═══`;
}

/**
 * One-shot helper: returns either the empty string (operator isn't on
 * tactical path) or the full instruction + corpus block.
 *
 * Usage in /api/gunny/route.ts:
 *   systemPrompt += getTacticalContextOrEmpty(operatorContext);
 */
export function getTacticalContextOrEmpty(operatorContext: OperatorContextLike | null | undefined): string {
  if (!shouldInjectTacticalCorpus(operatorContext)) return '';
  return `\n\n${TACTICAL_CORPUS_INSTRUCTION}${buildTacticalCorpusBlock()}`;
}
