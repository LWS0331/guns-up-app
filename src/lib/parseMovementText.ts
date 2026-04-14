/**
 * parseMovementText — converts a free-form warmup / cooldown string into
 * individual movement entries so the UI can render them as tappable cards.
 *
 * Accepts common formats:
 *   "5min row, arm circles 2x10, leg swings 2x10, cat-cow 1min"
 *   "Foam roll quads 60s; banded walks 2x15; glute bridge 2x10"
 *   newline-separated lists
 *
 * Returns a shaped array of { name, prescription }.
 */

export interface ParsedMovement {
  name: string;
  prescription: string; // e.g. "2x10", "60s", "5 min"
  raw: string;
  /**
   * True when this segment is an actual exercise/movement worth searching
   * YouTube for. False for weight-only entries ("135x6", "185x4") and
   * instruction/warning text ("BAIL PROTOCOL: ...", "SHOOTING PAIN",
   * "NUMBNESS — DROP TO GOBLET SQUATS"). Controls whether the UI renders a
   * DEMO button on the card.
   */
  isExercise: boolean;
}

/**
 * Return true if the movement name is an actual exercise worth demoing —
 * i.e. not just a weight/rep spec and not an instruction/warning line.
 */
function isExerciseName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;

  // Must contain at least one letter — pure numeric prescriptions
  // like "135x6" / "185x4" / "90" fail this check.
  if (!/[a-zA-Z]/.test(n)) return false;

  // Reject weight-only specs where letters are just unit markers:
  // "135 lbs", "50kg", "185x4 lbs".
  if (/^\s*\d+\s*x?\s*\d*\s*(lbs?|kgs?|pounds?|kilograms?)?\s*$/i.test(n)) {
    return false;
  }

  // Reject instruction / warning / bail-protocol text. These are user-facing
  // notes on the day's lift, not movements to demonstrate.
  const lower = n.toLowerCase();
  const INSTRUCTION_KEYWORDS = [
    'bail protocol',
    'bail out',
    'shooting pain',
    'sharp pain',
    'numbness',
    'tingling',
    'warning',
    'caution',
    'do not ',
    'stop if',
    'drop to ',
    'no ego',
    'symptoms',
    'if any ',
    'if you feel',
  ];
  if (INSTRUCTION_KEYWORDS.some((kw) => lower.includes(kw))) return false;

  // Starts-with instruction cues
  if (/^(if|when|note|warning|caution|stop|drop|bail)\b/i.test(n)) return false;

  return true;
}

const PRESCRIPTION_RE =
  /(\d+\s*x\s*\d+|\d+\s*sec(?:onds?)?|\d+\s*s\b|\d+\s*min(?:utes?)?|\d+\s*m\b|\d+\s*reps?|\d+\s*rounds?|\d+['"′″]?)/i;

/**
 * Split by commas, semicolons, or newlines — but NOT inside a prescription.
 */
function splitSegments(text: string): string[] {
  return text
    .split(/[\n;,]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract prescription + clean movement name from a single segment.
 */
function parseSegment(segment: string): ParsedMovement {
  const raw = segment.trim();

  // Find prescription token (first match)
  const match = raw.match(PRESCRIPTION_RE);
  let prescription = '';
  let name = raw;

  if (match) {
    prescription = match[0].replace(/\s+/g, '').toLowerCase();
    // Normalize "30seconds" -> "30s", "2minutes" -> "2min"
    prescription = prescription
      .replace(/seconds?$/, 's')
      .replace(/minutes?$/, 'min')
      .replace(/reps?$/, ' reps')
      .replace(/rounds?$/, ' rounds');

    // Remove the prescription from the name
    name = raw.replace(match[0], '').replace(/\s+/g, ' ').trim();
    // Clean trailing/leading punctuation
    name = name.replace(/^[\-–—:\s]+|[\-–—:\s]+$/g, '').trim();
  }

  if (!name) name = raw;
  return { name, prescription, raw, isExercise: isExerciseName(name) };
}

/**
 * Main entry point. Returns [] if text is empty/whitespace.
 */
export function parseMovementText(text: string | null | undefined): ParsedMovement[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  return splitSegments(trimmed).map(parseSegment);
}
