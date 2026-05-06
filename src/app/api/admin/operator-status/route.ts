// POST /api/admin/operator-status
//
// Toggle the admin hard kill switch on a single operator. The
// `disabled` column is read by isOperatorAllowed() — flipping it to
// true ejects the operator on the next /api/auth/me call without
// destroying any data. Flipping back to false re-enables the same
// account with all history intact (workouts, chats, intake).
//
// Why a separate endpoint instead of riding on /api/operators/:id PUT:
//   - PUT writes are field-scoped per actor (ADMIN_FIELDS / SELF_FIELDS
//     / TRAINER_FIELDS), and `disabled` doesn't belong on any of those
//     lists. Adding it to ADMIN_FIELDS would let any future bug in the
//     scope check leak the kill switch to non-admins.
//   - This endpoint is auditable as a single intent ("disable Bob")
//     rather than mixed in with field-level edits.
//
// Auth: either ADMIN_SECRET header OR session whose operatorId is in
// OPS_CENTER_ACCESS. Same dual auth as create-operator.
//
// Body:
//   { operatorId: string,
//     action: 'disable' | 'enable',
//     reason?: string  // optional admin note for the audit trail
//   }
//
// Response: { ok: true, operator: { id, callsign, disabled, disabledAt, disabledReason } }
// Errors:   { ok: false, error, reason } with 400/401/403/404/500

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthOperator } from '@/lib/authMiddleware';
import { OPS_CENTER_ACCESS } from '@/lib/types';

const VALID_ACTIONS = new Set(['disable', 'enable']);
const MAX_REASON_LENGTH = 500;

export async function POST(req: NextRequest) {
  // Auth — same dual path as create-operator.
  const secret = req.headers.get('x-admin-secret');
  const secretMatches =
    !!process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET;
  let sessionAuthorized = false;
  let actorId: string | null = null;
  if (!secretMatches) {
    const authData = getAuthOperator(req);
    if (authData && OPS_CENTER_ACCESS.includes(authData.operatorId)) {
      sessionAuthorized = true;
      actorId = authData.operatorId;
    }
  }
  if (!secretMatches && !sessionAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const operatorId = String(body?.operatorId || '').trim();
    const action = String(body?.action || '').trim();
    const reason = body?.reason != null ? String(body.reason).trim() : '';

    if (!operatorId) {
      return NextResponse.json({
        ok: false, error: 'operatorId required',
      }, { status: 400 });
    }
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid action',
        reason: `action must be one of: ${[...VALID_ACTIONS].join(', ')}`,
      }, { status: 400 });
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json({
        ok: false,
        error: 'reason too long',
        reason: `reason must be ≤ ${MAX_REASON_LENGTH} chars`,
      }, { status: 400 });
    }

    // Self-protection: an OPS_CENTER admin can disable other ops admins
    // (intentional — co-founder can lock out a compromised account) but
    // can't disable their OWN session in one call. The error here keeps
    // them from accidentally locking themselves out of the panel they're
    // standing in. Use a different actor or the secret path if intentional.
    if (
      sessionAuthorized &&
      actorId === operatorId &&
      action === 'disable'
    ) {
      return NextResponse.json({
        ok: false,
        error: 'cannot disable self',
        reason: 'Use another OPS_CENTER admin or the ADMIN_SECRET path to disable your own session',
      }, { status: 400 });
    }

    const target = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { id: true, callsign: true, disabled: true, role: true },
    });
    if (!target) {
      return NextResponse.json({
        ok: false,
        error: 'operator not found',
        reason: `no operator with id ${operatorId}`,
      }, { status: 404 });
    }

    const wantDisabled = action === 'disable';
    if (target.disabled === wantDisabled) {
      // Already in target state — return current row, idempotent no-op.
      return NextResponse.json({
        ok: true,
        operator: target,
        message: `operator already ${wantDisabled ? 'disabled' : 'enabled'} — no change`,
      });
    }

    const updated = await prisma.operator.update({
      where: { id: operatorId },
      data: wantDisabled
        ? {
            disabled: true,
            disabledAt: new Date(),
            disabledReason: reason || null,
          }
        : {
            disabled: false,
            disabledAt: null,
            disabledReason: null,
          },
      select: {
        id: true, callsign: true, name: true, email: true, role: true,
        disabled: true, disabledAt: true, disabledReason: true,
      },
    });

    console.log(
      `[admin/operator-status] ${actorId || 'CLI'} ${action}d ${operatorId} (${target.callsign})${reason ? ` — ${reason}` : ''}`,
    );
    return NextResponse.json({ ok: true, operator: updated });
  } catch (error) {
    console.error('[admin/operator-status] error', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to update status',
      details: String(error),
    }, { status: 500 });
  }
}
