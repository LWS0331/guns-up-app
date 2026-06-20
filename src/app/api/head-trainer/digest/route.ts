import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS, isHeadTrainer, type Operator } from '@/lib/types';
import { buildRosterDigest } from '@/lib/rosterDigest';
import { getAppTodayStr } from '@/lib/dateUtils';

// GET /api/head-trainer/digest — the head-trainer upward roll-up.
//
// Returns one compact row per operator (streak, 7-day compliance, last
// workout, latest readiness, plan-takeover/stale/diverged status) so a
// head trainer can see the whole roster at a glance and decide where to
// step in. Head-trainer (HEAD_TRAINER_ACCESS) or admin (OPS_CENTER_ACCESS)
// only — this reads every operator's data.
export async function GET(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isHeadTrainer(auth.operatorId) && !OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'Forbidden: head-trainer access required' }, { status: 403 });
  }

  try {
    const rows = await prisma.operator.findMany();
    // Pacific app day — matches how streak/compliance/staleness compare
    // elsewhere. (Per-operator timezone is a future refinement; the digest
    // is a coach overview, not a per-operator clock.)
    const today = getAppTodayStr();
    const digest = buildRosterDigest(rows as unknown as Operator[], today);
    return NextResponse.json({ today, count: digest.length, digest });
  } catch (error) {
    console.error('[api/head-trainer/digest GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to build roster digest' }, { status: 500 });
  }
}
