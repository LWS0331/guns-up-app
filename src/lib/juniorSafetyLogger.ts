// Junior Operator safety event logger.
//
// Scans user messages in the Gunny route for pain / concussion / red-flag
// keywords. When a match fires, appends a JuniorSafetyEvent to the
// operator's juniorSafety.events JSON column via Prisma.
//
// The Gunny prompt itself handles the conversational refusal — this logger's
// job is the audit trail: parents see a banner in ParentDashboard, the
// trainer sees an unresolved-events queue, and the kid can't dismiss the
// flag silently.
//
// Citations for the keyword sets live in docs/youth-soccer-corpus.md §4
// (concussion management, pain protocol) and §11 (knowledge boundary).

import { prisma } from './db';
import type { JuniorSafetyEvent, JuniorSafetyEventType, JuniorSafetyFlags } from './types';

// Concussion keywords — based on CDC HEADS UP signs/symptoms list. Any
// match fires a 'concussion_keyword' event and the prompt issues the
// full-stop refusal. Verb tense is broad on purpose (saw stars / seeing
// stars / starting to see stars) — we'd rather over-flag than miss.
const CONCUSSION_KEYWORDS = [
  'hit my head',
  'hit in the head',
  'hit on the head',
  'head injury',
  'banged my head',
  'headbutt',
  'concussion',
  'concussed',
  'headache after',
  'dizzy',
  'dizziness',
  'nauseous after',
  'nauseated after',
  'blurred vision',
  'blurry vision',
  'saw stars',
  'seeing stars',
  "can't remember",
  'cant remember',
  'memory blank',
  'knocked out',
  'blacked out',
  'collision',
  'neck pain after',
];

// Pain keywords — anything that suggests acute pain (not soreness). Pain
// is the kid's word; "sore" / "tired legs" / "tight" don't trip the wire.
const PAIN_KEYWORDS = [
  'sharp pain',
  'shooting pain',
  'something popped',
  'something snapped',
  'heard a pop',
  'felt a pop',
  "can't bear weight",
  'cant bear weight',
  "can't put weight",
  'cant put weight',
  'swollen',
  'swelling',
  'gave out',
  'gave way',
  'limping',
];

// Generic red flags — RED-S / eating-disorder / mental health language.
// These do NOT trigger a workout block but DO write a flag for the trainer
// + parents to follow up on. The prompt's refusal handles the conversation.
const RED_FLAG_KEYWORDS = [
  'lose weight',
  'losing weight',
  'cut weight',
  'too fat',
  'feel fat',
  'skip meals',
  'skipping meals',
  'not eating',
  'stopped eating',
  'haven\'t eaten',
  'havent eaten',
  'period stopped',
  'no period',
  'stress fracture',
  'want to die',
  'kill myself',
  'hurt myself',
  'self harm',
];

export interface DetectedSafetySignal {
  type: JuniorSafetyEventType;
  matched: string;            // the keyword that triggered
  excerpt: string;            // <=120 char excerpt around the match for parent UI
}

export function detectSafetySignals(message: string): DetectedSafetySignal[] {
  if (!message || typeof message !== 'string') return [];
  const lower = message.toLowerCase();
  const signals: DetectedSafetySignal[] = [];

  const seen = new Set<string>();
  const tryMatch = (keywords: string[], type: JuniorSafetyEventType) => {
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx < 0) continue;
      const sig = `${type}::${kw}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      // Build a short excerpt around the match for the audit log.
      const start = Math.max(0, idx - 40);
      const end = Math.min(message.length, idx + kw.length + 40);
      const excerpt = (start > 0 ? '…' : '') + message.slice(start, end) + (end < message.length ? '…' : '');
      signals.push({ type, matched: kw, excerpt });
    }
  };

  tryMatch(CONCUSSION_KEYWORDS, 'concussion_keyword');
  tryMatch(PAIN_KEYWORDS, 'pain_report');
  tryMatch(RED_FLAG_KEYWORDS, 'red_flag');
  return signals;
}

// Atomically append events to operator.juniorSafety.events. Reads the
// current JSON, splices in the new events, writes back. Two concurrent
// requests racing here would lose one event (no row-level lock), but
// safety events from the same operator in the same second is unrealistic
// for a single chat session.
export async function appendJuniorSafetyEvents(
  operatorId: string,
  signals: DetectedSafetySignal[]
): Promise<JuniorSafetyEvent[]> {
  if (signals.length === 0) return [];

  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { juniorSafety: true, isJunior: true },
  });
  if (!op || !op.isJunior) return [];

  const current = (op.juniorSafety as unknown as JuniorSafetyFlags) || { events: [] };
  const now = new Date().toISOString();
  const newEvents: JuniorSafetyEvent[] = signals.map(sig => ({
    timestamp: now,
    type: sig.type,
    detail: `[${sig.matched}] ${sig.excerpt}`,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
  }));

  const updatedFlags: JuniorSafetyFlags = {
    events: [...(current.events || []), ...newEvents],
  };

  await prisma.operator.update({
    where: { id: operatorId },
    data: { juniorSafety: updatedFlags as unknown as object },
  });

  return newEvents;
}

// Convenience wrapper used in the Gunny route — detect + persist in one
// call. Returns the events that were written so the route can include
// them in the response payload (parent dashboard polls / refetches to see
// them; the chat UI can also surface a banner).
export async function detectAndLogSafety(
  operatorId: string,
  isJunior: boolean,
  userMessage: string
): Promise<JuniorSafetyEvent[]> {
  if (!isJunior) return [];
  const signals = detectSafetySignals(userMessage);
  if (signals.length === 0) return [];
  try {
    return await appendJuniorSafetyEvents(operatorId, signals);
  } catch (err) {
    // Logging the audit trail must NEVER block the chat response. If the
    // DB write fails, log to console and keep the response moving — the
    // prompt itself still issues the refusal.
    // eslint-disable-next-line no-console
    console.error('[junior-safety] append failed', { operatorId, err });
    return [];
  }
}
