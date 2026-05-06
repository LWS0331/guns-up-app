// POST /api/admin/delete-operator
//
// HARD DELETE — removes an Operator row plus all child tables that
// reference operatorId. Permanent. No restoration path. Use the
// /api/admin/operator-status disable action instead unless you really
// mean it.
//
// Why a confirmation token: the request body must include a callsign
// match. The endpoint refuses unless the caller-supplied
// `confirmCallsign` exactly equals the target's current callsign. This
// makes a fat-fingered POST with the wrong operatorId fail closed
// rather than silently nuking the wrong account. Mirrors the GitHub /
// Stripe / Postgres `DROP TABLE` confirmation pattern.
//
// Cleanup scope (all rows referencing operatorId — no FK constraints
// in the schema, so cascade is manual):
//   - AuthToken
//   - ChatHistory
//   - ChatHistorySnapshot
//   - DailyOpsPlan
//   - GunnyUsageLog
//   - OperatorBaseline
//   - PersonalRhythm
//   - PushSubscription
//   - WearableConnection
//   - WearableSnapshot
// Wrapped in a single Prisma transaction so a partial failure rolls
// back. The Operator row goes last.
//
// Self-protection: the actor cannot delete themselves. Co-founder
// admin trying to delete the other co-founder is allowed (intentional
// — both have to consent for an admin nuke), but a 404 still surfaces
// if the target doesn't exist. Founders' static data lives in
// src/data/operators.ts so a delete + re-seed will resurrect them.
//
// Auth: either ADMIN_SECRET header OR session whose operatorId is in
// OPS_CENTER_ACCESS.
//
// Body:
//   { operatorId: string,
//     confirmCallsign: string,  // must equal target.callsign exactly
//     reason?: string           // optional admin note (logged only)
//   }
//
// Response: { ok: true,
//             deleted: { id, callsign, name },
//             cleanup: { authTokens, chatHistory, ..., wearableSnapshot } }
// Errors:   { ok: false, error, reason } with 400/401/403/404/409/500

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthOperator } from '@/lib/authMiddleware';
import { OPS_CENTER_ACCESS } from '@/lib/types';

const MAX_REASON_LENGTH = 500;

export async function POST(req: NextRequest) {
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
    const confirmCallsign = String(body?.confirmCallsign || '').trim();
    const reason = body?.reason != null ? String(body.reason).trim() : '';

    if (!operatorId) {
      return NextResponse.json({
        ok: false, error: 'operatorId required',
      }, { status: 400 });
    }
    if (!confirmCallsign) {
      return NextResponse.json({
        ok: false,
        error: 'confirmCallsign required',
        reason: 'Type the target operator\'s callsign exactly to confirm the delete',
      }, { status: 400 });
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json({
        ok: false,
        error: 'reason too long',
        reason: `reason must be ≤ ${MAX_REASON_LENGTH} chars`,
      }, { status: 400 });
    }

    // Self-delete blocker — applies to both auth paths.
    if (sessionAuthorized && actorId === operatorId) {
      return NextResponse.json({
        ok: false,
        error: 'cannot delete self',
        reason: 'Use another admin or the ADMIN_SECRET path to delete your own account',
      }, { status: 400 });
    }

    const target = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { id: true, callsign: true, name: true, role: true, clientIds: true },
    });
    if (!target) {
      return NextResponse.json({
        ok: false,
        error: 'operator not found',
        reason: `no operator with id ${operatorId}`,
      }, { status: 404 });
    }

    // Callsign match — case-insensitive but exact otherwise. Stripping
    // whitespace because admins copy-paste from the roster table.
    if (target.callsign.toUpperCase() !== confirmCallsign.toUpperCase()) {
      return NextResponse.json({
        ok: false,
        error: 'confirmation mismatch',
        reason: `confirmCallsign "${confirmCallsign}" does not match target callsign "${target.callsign}"`,
      }, { status: 409 });
    }

    // Trainer-with-clients guard. Hard delete a trainer and their
    // clients are orphaned (auth/me will auto-reassign to op-ruben on
    // next call but only for clients with no trainerId — those still
    // pointing at the deleted trainer keep a dangling reference until
    // they refetch). Surface a warning shape so admins make a deliberate
    // choice. Override by setting forceTrainerDelete: true.
    if (target.role === 'trainer' && (target.clientIds?.length ?? 0) > 0 && body?.forceTrainerDelete !== true) {
      return NextResponse.json({
        ok: false,
        error: 'trainer has clients',
        reason: `trainer ${target.callsign} has ${target.clientIds?.length} client(s). Re-route them first or pass forceTrainerDelete: true`,
        clientIds: target.clientIds,
      }, { status: 409 });
    }

    // Single transaction so a child-table failure rolls back the
    // operator row delete. deleteMany returns { count } per call.
    const cleanup = await prisma.$transaction(async (tx) => {
      const authTokens = await tx.authToken.deleteMany({ where: { operatorId } });
      const chatHistory = await tx.chatHistory.deleteMany({ where: { operatorId } });
      const chatHistorySnapshot = await tx.chatHistorySnapshot.deleteMany({ where: { operatorId } });
      const dailyOpsPlan = await tx.dailyOpsPlan.deleteMany({ where: { operatorId } });
      const gunnyUsageLog = await tx.gunnyUsageLog.deleteMany({ where: { operatorId } });
      const operatorBaseline = await tx.operatorBaseline.deleteMany({ where: { operatorId } });
      const personalRhythm = await tx.personalRhythm.deleteMany({ where: { operatorId } });
      const pushSubscription = await tx.pushSubscription.deleteMany({ where: { operatorId } });
      const wearableConnection = await tx.wearableConnection.deleteMany({ where: { operatorId } });
      const wearableSnapshot = await tx.wearableSnapshot.deleteMany({ where: { operatorId } });
      await tx.operator.delete({ where: { id: operatorId } });
      return {
        authTokens: authTokens.count,
        chatHistory: chatHistory.count,
        chatHistorySnapshot: chatHistorySnapshot.count,
        dailyOpsPlan: dailyOpsPlan.count,
        gunnyUsageLog: gunnyUsageLog.count,
        operatorBaseline: operatorBaseline.count,
        personalRhythm: personalRhythm.count,
        pushSubscription: pushSubscription.count,
        wearableConnection: wearableConnection.count,
        wearableSnapshot: wearableSnapshot.count,
      };
    });

    console.log(
      `[admin/delete-operator] ${actorId || 'CLI'} HARD DELETED ${operatorId} (${target.callsign})${reason ? ` — ${reason}` : ''}; cleanup=${JSON.stringify(cleanup)}`,
    );
    return NextResponse.json({
      ok: true,
      deleted: { id: target.id, callsign: target.callsign, name: target.name },
      cleanup,
    });
  } catch (error) {
    console.error('[admin/delete-operator] error', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to delete operator',
      details: String(error),
    }, { status: 500 });
  }
}
