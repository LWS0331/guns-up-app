// POST /api/readiness/score
//
// Returns the live ReadinessScore for an operator — the same engine
// output that drives /api/gunny/recovery-readout, but stripped of the
// LLM headline/guidance layer. This is the always-on read used by the
// IntelCenter readiness panel so users can see what the engine sees:
// status, confidence, baselineDays progress, ACWR, and per-factor
// breakdown.
//
// Why a separate endpoint instead of reusing recovery-readout:
//   - recovery-readout makes an Anthropic call per request to write
//     the headline + guidance. The panel renders on tab open and on
//     refresh, so we don't want to burn an LLM call every time.
//   - The panel's job is observability ("what does the engine
//     currently think?"), not coaching copy.
//
// Auth: self / admin / trainer-of-target. Same authz as
// recovery-readout — the readiness score is operator-scoped data.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { readinessScore } from '@/lib/readiness';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const operatorId: string | undefined = body?.operatorId;
    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    // Authorization: self, admin, or trainer-of-target.
    const isSelf = auth.operatorId === operatorId;
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    let isTrainerOfTarget = false;
    if (!isSelf && !isAdmin) {
      const t = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: { trainerId: true },
      });
      isTrainerOfTarget = !!t && t.trainerId === auth.operatorId;
    }
    if (!isSelf && !isAdmin && !isTrainerOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const score = await readinessScore({ operatorId });
    return NextResponse.json({ ok: true, score });
  } catch (error) {
    console.error('[readiness/score] error', error);
    return NextResponse.json(
      { error: 'Failed to compute readiness', details: String(error) },
      { status: 500 },
    );
  }
}
