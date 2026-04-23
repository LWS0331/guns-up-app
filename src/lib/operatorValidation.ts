// Shape validators for the JSON columns on the Operator model.
//
// Prisma stores profile/nutrition/prs/injuries/preferences/workouts/dayTags/
// intake/sitrep/dailyBrief as unstructured JSONB. Without a boundary check,
// a caller could PUT `{ profile: "not an object" }` or `{ prs: {} }`; the DB
// happily stores the wrong shape, then any component that does
// `operator.profile.weight` or `operator.prs.map(...)` crashes at runtime.
//
// These validators are deliberately shallow — we enforce the container shape
// (object vs array vs scalar) but not the full nested schema. The Operator
// type is a moving target and deep schemas would rot faster than they help.
// The goal is defense in depth: catch obviously-wrong writes that would
// surface as NPE / TypeError on later reads.

type FieldKind = 'object' | 'array';

const OPERATOR_JSON_FIELD_KINDS: Readonly<Record<string, FieldKind>> = {
  intake: 'object',
  profile: 'object',
  nutrition: 'object',
  preferences: 'object',
  workouts: 'object',
  dayTags: 'object',
  sitrep: 'object',
  dailyBrief: 'object',
  prs: 'array',
  injuries: 'array',
};

export interface ValidationIssue {
  field: string;
  expected: FieldKind;
  got: string;
}

const typeName = (v: unknown): string => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
};

const shapeOk = (kind: FieldKind, v: unknown): boolean => {
  if (kind === 'array') return Array.isArray(v);
  return v !== null && typeof v === 'object' && !Array.isArray(v);
};

/**
 * Validate that the JSON-typed fields present in `body` have the expected
 * container shape. Returns an array of issues; empty array means OK.
 * Fields not present in `body` are not checked (PATCH-style semantics — only
 * what's being written is validated).
 */
export function validateOperatorJsonFields(body: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [field, kind] of Object.entries(OPERATOR_JSON_FIELD_KINDS)) {
    if (!(field in body)) continue;
    const v = body[field];
    // Allow explicit null/undefined — Prisma will reset to default.
    if (v === null || v === undefined) continue;
    if (!shapeOk(kind, v)) {
      issues.push({ field, expected: kind, got: typeName(v) });
    }
  }
  return issues;
}
