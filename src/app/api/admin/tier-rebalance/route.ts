// /api/admin/tier-rebalance — one-shot tier demote endpoint.
//
// Built May 2026 to support the cost-control tier rebalance: keep
// only the trainer accounts (Ruben + Britney) on opus, demote every
// other adult opus operator to sonnet. Replaces hand-running SQL in
// the Railway console — gives a typed dry-run preview, atomic apply,
// and structured diff for audit.
//
// Auth: admin only (OPS_CENTER_ACCESS). The /admin/reset and
// /api/admin/chat-history-restore routes use the same gate.
//
// Verbs:
//   GET                 → dry-run, returns what WOULD be touched
//   POST { apply: true} → applies the demote, returns the diff
//   POST { apply: true, includeJuniors: true }
//                       → also demote junior operators (overrides
//                         the safety carve-out for youth coaching;
//                         off by default)
//
// Both verbs return the same shape so the UI / curl call can preview
// before applying.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// Trainer accounts that stay on opus regardless of any rebalance.
//
// MATCHED BY ID (primary). Earlier version of this file matched by
// callsign string-equality and missed an operator whose callsign in
// production was 'RAMPAGE ' (trailing whitespace) — the founder's own
// row got demoted with everyone else. ID-based matching is immune to
// callsign typos / whitespace / casing. Callsign comparisons below
// are kept as a backup but use trim() so a trailing space won't
// defeat them again.
const KEEP_OPUS_IDS = new Set(['op-ruben', 'op-britney']);
const KEEP_OPUS_CALLSIGNS = new Set(['RAMPAGE', 'VALKYRIE']);
function shouldKeepOpus(op: { id: string; callsign: string }): boolean {
  if (KEEP_OPUS_IDS.has(op.id)) return true;
  return KEEP_OPUS_CALLSIGNS.has(op.callsign.trim().toUpperCase());
}

interface DemoteRow {
  id: string;
  callsign: string;
  role: string;
  currentTier: string;
  isJunior: boolean;
  juniorAge: number | null;
  willDemoteTo: 'sonnet' | null;
  reason: string;
}

async function buildDemoteList(includeJuniors: boolean): Promise<DemoteRow[]> {
  // Pull ALL opus operators and tag each with its disposition. We
  // INCLUDE keep-list trainers in the response (with willDemoteTo:null)
  // so the dry-run audit is fully verifiable — without this, kept
  // trainers were silently filtered out before the response and the
  // caller had no way to confirm the keep list was working without an
  // external check (which is exactly how I missed the trailing-space
  // bug that demoted the founder).
  //
  // The apply path's `targets` filter still selects only
  // willDemoteTo === 'sonnet' rows, so including the kept rows in
  // candidates is purely a visibility win — no risk of accidentally
  // demoting them.
  const allOpus = await prisma.operator.findMany({
    where: { tier: 'opus' },
    select: {
      id: true,
      callsign: true,
      role: true,
      tier: true,
      isJunior: true,
      juniorAge: true,
    },
    orderBy: { callsign: 'asc' },
  });

  return allOpus.map((r): DemoteRow => {
    // Keep-list match wins over junior status — trainer accounts on
    // the keep list stay opus regardless of any other tag.
    if (shouldKeepOpus(r)) {
      return {
        id: r.id,
        callsign: r.callsign,
        role: r.role,
        currentTier: r.tier,
        isJunior: r.isJunior,
        juniorAge: r.juniorAge,
        willDemoteTo: null,
        reason:
          'TRAINER (keep-list) — preserved on opus regardless of other rules. Match by id (primary) + trimmed callsign (backup).',
      };
    }
    if (r.isJunior && !includeJuniors) {
      return {
        id: r.id,
        callsign: r.callsign,
        role: r.role,
        currentTier: r.tier,
        isJunior: true,
        juniorAge: r.juniorAge,
        willDemoteTo: null,
        reason:
          'JUNIOR — preserved on opus per youth-coaching safety rule (refusal scope, concussion protocol, RED-S detection). Pass includeJuniors=true to override.',
      };
    }
    return {
      id: r.id,
      callsign: r.callsign,
      role: r.role,
      currentTier: r.tier,
      isJunior: r.isJunior,
      juniorAge: r.juniorAge,
      willDemoteTo: 'sonnet',
      reason:
        'Adult non-trainer client on opus — demote to sonnet for cost-control rebalance.',
    };
  });
}

function denyIfNotAdmin(operatorId: string): NextResponse | null {
  if (!OPS_CENTER_ACCESS.includes(operatorId)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = denyIfNotAdmin(auth.operatorId);
  if (denied) return denied;

  const includeJuniors =
    new URL(req.url).searchParams.get('includeJuniors') === 'true';

  const candidates = await buildDemoteList(includeJuniors);
  const willDemote = candidates.filter((r) => r.willDemoteTo !== null);
  const willPreserve = candidates.filter((r) => r.willDemoteTo === null);

  return NextResponse.json({
    ok: true,
    mode: 'dry-run',
    keepOpusCallsigns: KEEP_OPUS_CALLSIGNS,
    includeJuniors,
    candidatesCount: candidates.length,
    willDemoteCount: willDemote.length,
    willPreserveCount: willPreserve.length,
    willDemote,
    willPreserve,
  });
}

interface ApplyBody {
  apply?: boolean;
  includeJuniors?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = denyIfNotAdmin(auth.operatorId);
  if (denied) return denied;

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    body = {};
  }

  if (!body.apply) {
    return NextResponse.json(
      {
        error:
          'POST requires { apply: true } in the body. GET this endpoint for a dry-run.',
      },
      { status: 400 },
    );
  }

  const includeJuniors = body.includeJuniors === true;
  const candidates = await buildDemoteList(includeJuniors);
  const targets = candidates.filter((r) => r.willDemoteTo === 'sonnet');

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: 'applied',
      includeJuniors,
      demoted: 0,
      message: 'No operators matched the demote criteria — nothing to do.',
    });
  }

  // Atomic transaction — all-or-nothing.
  const targetIds = targets.map((r) => r.id);
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.operator.updateMany({
      where: { id: { in: targetIds } },
      data: { tier: 'sonnet', tierLocked: true },
    });
    const verified = await tx.operator.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, callsign: true, tier: true, tierLocked: true },
      orderBy: { callsign: 'asc' },
    });
    return { count: updated.count, verified };
  });

  // eslint-disable-next-line no-console
  console.log('[tier-rebalance] applied', {
    actor: auth.operatorId,
    demotedCount: result.count,
    callsigns: targets.map((r) => r.callsign),
    includeJuniors,
  });

  return NextResponse.json({
    ok: true,
    mode: 'applied',
    includeJuniors,
    demoted: result.count,
    appliedTo: targets,
    verified: result.verified,
  });
}
