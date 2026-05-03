// Server-side Daily Ops plan generator. Phase 2C.
//
// Why this exists: the chat-driven path through /api/gunny works
// great when the operator types "build me today's plan", but the
// proactive Phase 2C surface (overnight pre-gen cron) needs to
// generate a plan with NO user message, NO chat history, and NO HTTP
// auth context. This helper is the unattended path:
//
//   await generateDailyOpsPlan({ operatorId, targetDate, reason })
//
// Internally it composes a focused system prompt (just the daily-ops
// section + corpus + signals), sends a minimal user message asking
// for the plan, parses the <daily_ops_json> from the response, and
// upserts via the existing upsertDailyOpsPlan() helper. The
// PersonalRhythm + WearableSignals injection mirrors the chat-path
// behavior so the pre-generated plan is just as personalized as
// one the operator asks for live.
//
// ABSENT BY DESIGN:
//   - chat-history merging (no chat to merge)
//   - tool-use / multi-turn (single shot)
//   - tier checks (caller already gated to Commander operators)
//   - junior parent-approval flow (handled inside upsertDailyOpsPlan)

import Anthropic from '@anthropic-ai/sdk';
import { recomputePersonalRhythm, renderRhythmForPrompt } from '@/lib/personalRhythm';
import { getWearableSignals, renderWearableForPrompt } from '@/lib/wearableSignals';
import { upsertDailyOpsPlan } from '@/lib/dailyOpsPersistence';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  _client = new Anthropic({ apiKey });
  return _client;
}

const PREGEN_MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are Gunny, the GUNS UP AI coach. You're generating a Daily Ops plan
unattended — the operator did NOT prompt you live; the system is
pre-generating tomorrow's plan based on the operator's profile,
rhythm history, and wearable data.

Output rules:
1. Output ONLY a single <daily_ops_json> block with the day's plan
   wrapped in tags. No conversational text before or after.
2. Use the personal-rhythm offsets (when present) as authoritative
   defaults for caffeine_cutoff / wind_down / sleep_target /
   workout startTimes. Do NOT revert to corpus defaults if the
   operator has 14-day feedback that says otherwise.
3. If the WEARABLE block reports readiness < 60 OR sleep_debt < -1
   for the upcoming day, soften the plan: cap caffeine to the LOW
   end of the dose range, pull wind_down + sleep_target 30 min
   earlier, flag in plan.notes that today is recovery-priority.
4. If high-skip blocks are listed (>=60% skipped over 14 days),
   DROP them or radically soften them. Don't generate a category
   the operator has clearly told you they ignore.
5. Always populate basis.sleepDebtHrs, basis.readinessScore,
   basis.scheduledWorkoutTime (if known), basis.workoutLoad,
   basis.periodizationPhase (if known), basis.trainingPath, and
   basis.date.

Block categories (use exact strings):
  wake, sun_exposure, caffeine_window_open, caffeine_cutoff, meal,
  pre_workout_supp, workout, post_workout, mobility, wind_down,
  pre_bed_supp, sleep_target, sauna, cold_exposure, recovery_walk,
  fifa_warmup (junior soccer only), mistake_reset_ritual (junior only)

Each block MUST carry a 1-clause rationale citing the corpus, e.g.:
  "tier1.caffeine — 30-60 min pre, 3-6 mg/kg"
  "natural_T sleep.hygieneProtocol — 8-10 hrs pre-bed cutoff"
  "Mamerow 2014 — 4 evenly spaced ~0.4 g/kg protein feedings"

For junior operators (under 18) STRIP these even if the corpus
suggests them:
  - caffeine_window_open / caffeine_cutoff for under 13
  - pre_workout_supp / pre_bed_supp for under 13
  - any reference to ashwagandha, tongkat ali, melatonin, sodium
    bicarbonate, tribulus, fadogia, turkesterone, ecdysterone, HMB,
    DAA, shilajit at any junior age
  - any reference to alcohol / nicotine / caffeine pills / fat burners

Format (single block, exact wrapper):

<daily_ops_json>
{
  "date": "YYYY-MM-DD",
  "basis": { ... },
  "notes": "1-3 short sentences explaining the day-level shape (intensification week, recovery focus, etc.)",
  "blocks": [
    { "id":"wake-1", "startTime":"06:00", "category":"wake", "label":"Wake", "rationale":"natural_T sleep — consistent ±30 min target", "flexibility":"fixed", "source":"gunny_default" },
    ...
  ]
}
</daily_ops_json>`;

interface OperatorContext {
  operatorId: string;
  isJunior: boolean;
  juniorAge: number | null;
  trainingPath: string | null;
  age: number | null;
  callsign: string | null;
}

interface GenerateArgs {
  operatorContext: OperatorContext;
  /** Target date for the plan (YYYY-MM-DD, operator local). */
  targetDate: string;
  /** Why the plan is being generated — diagnostics only. */
  reason: 'overnight_pregen' | 'manual_admin' | 'fallback';
}

interface GenerateOk {
  ok: true;
  planId: string;
  status: string;
  reason: GenerateArgs['reason'];
}
interface GenerateErr {
  ok: false;
  error: string;
  reason: GenerateArgs['reason'];
}

export type GenerateResult = GenerateOk | GenerateErr;

/**
 * Build the user-facing instruction for the unattended generation.
 * Kept short — Gunny's job is to read the system prompt + signals
 * and produce a plan, not to riff conversationally.
 */
function buildUserMessage(operator: OperatorContext, targetDate: string): string {
  const base =
    `Generate the daily ops plan for ${targetDate}. ` +
    `Operator: ${operator.callsign ?? operator.operatorId}` +
    (operator.isJunior ? ` (junior, age ${operator.juniorAge ?? '?'})` : '') +
    `. Training path: ${operator.trainingPath ?? 'unspecified'}.`;
  return base;
}

export async function generateDailyOpsPlan(args: GenerateArgs): Promise<GenerateResult> {
  const { operatorContext, targetDate, reason } = args;

  // Pull personalization signals — same code path as the chat surface.
  const [rhythm, wearable] = await Promise.all([
    recomputePersonalRhythm(operatorContext.operatorId).catch(() => null),
    getWearableSignals(operatorContext.operatorId, targetDate).catch(() => null),
  ]);
  const rhythmText = rhythm ? renderRhythmForPrompt(rhythm) : '';
  const wearableText = wearable ? renderWearableForPrompt(wearable) : '';

  const signalsBlock =
    rhythmText || wearableText
      ? '\n\n═══ DAILY OPS PERSONALIZATION SIGNALS ═══' + rhythmText + wearableText
      : '';

  const systemPrompt = SYSTEM_PROMPT + signalsBlock;
  const userMessage = buildUserMessage(operatorContext, targetDate);

  let responseText: string;
  try {
    const response = await client().messages.create({
      model: PREGEN_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (err) {
    return {
      ok: false,
      error: `Anthropic call failed: ${(err as Error).message}`,
      reason,
    };
  }

  const m = responseText.match(/<daily_ops_json>([\s\S]*?)<\/daily_ops_json>/);
  if (!m) {
    return { ok: false, error: 'No <daily_ops_json> block in response', reason };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(m[1].trim());
  } catch {
    return { ok: false, error: 'Invalid JSON in <daily_ops_json> block', reason };
  }

  // Force the date to the target — paranoid override in case the model
  // emits today's date instead of tomorrow's.
  if (payload && typeof payload === 'object') {
    (payload as Record<string, unknown>).date = targetDate;
  }

  const result = await upsertDailyOpsPlan({
    operatorId: operatorContext.operatorId,
    rawPayload: payload,
    generatedBy: 'gunny',
  });

  if ('error' in result) {
    return { ok: false, error: result.error, reason };
  }
  return { ok: true, planId: result.plan.id, status: result.plan.status, reason };
}
