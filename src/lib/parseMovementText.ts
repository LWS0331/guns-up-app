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
  return { name, prescription, raw };
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
