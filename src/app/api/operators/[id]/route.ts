import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { validateOperatorJsonFields } from '@/lib/operatorValidation';

// Field sets per actor. Admins can set everything; self can set profile + identity
// but NOT privilege/billing fields; trainers of the target can only set training-facing
// data + trainerNotes. Anything not on the actor's list is dropped silently rather than
// 403-ing, so legacy clients that PUT the whole operator object still succeed.
const ADMIN_FIELDS = new Set([
  'name', 'callsign', 'pin', 'email',
  'role', 'tier', 'coupleWith', 'trainerId', 'clientIds', 'trainerNotes',
  'betaUser', 'betaFeedback', 'betaStartDate', 'betaEndDate', 'isVanguard',
  'tierLocked', 'promoActive', 'promoType', 'promoExpiry',
  'intake', 'profile', 'nutrition', 'prs', 'injuries', 'preferences',
  'workouts', 'dayTags', 'sitrep', 'dailyBrief',
  // Junior Operator program — admin owns identity-level junior fields
  // (isJunior toggle, juniorAge, parent linking) and can override anything.
  'isJunior', 'juniorAge', 'parentIds', 'sportProfile', 'juniorConsent', 'juniorSafety',
]);

const SELF_FIELDS = new Set([
  // Identity that the user owns
  'name', 'callsign', 'pin', 'email',
  // Training data
  'intake', 'profile', 'nutrition', 'prs', 'injuries', 'preferences',
  'workouts', 'dayTags', 'sitrep', 'dailyBrief',
  // Self can pair up / pick a trainer
  'coupleWith', 'trainerId',
  // Feedback submissions (beta-feedback API is canonical, but keep writable here for compatibility)
  'betaFeedback',
  // Junior self-update: the kid can save their own intake answers
  // (sportProfile gets written from JuniorIntakeForm.onComplete) and
  // the consent step. Admin still controls isJunior/parentIds.
  'sportProfile', 'juniorConsent',
]);

const TRAINER_FIELDS = new Set([
  // Coach-owned notes + training plan / profile data for assigned client
  'trainerNotes',
  'intake', 'profile', 'nutrition', 'prs', 'injuries', 'preferences',
  'workouts', 'dayTags', 'sitrep', 'dailyBrief',
  // Trainer of a junior owns the sport profile (coachNotes, maturationStage)
  // and resolves entries in juniorSafety.events as they're addressed.
  'sportProfile', 'juniorSafety',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickFields(body: Record<string, any>, allowed: Set<string>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const key of Object.keys(body)) {
    if (allowed.has(key)) out[key] = body[key];
  }
  return out;
}

// PUT /api/operators/:id — update a single operator (auth required + field-scoped to actor role)
// Previously allowed any trainer-of-target (or self) to set every column — including
// `role`, `tier`, `tierLocked`, `isVanguard`, `promo*` — which is privilege escalation.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const isSelf = auth.operatorId === id;
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    let isTrainerOfTarget = false;
    if (!isSelf && !isAdmin) {
      const target = await prisma.operator.findUnique({
        where: { id },
        select: { trainerId: true },
      });
      isTrainerOfTarget = !!target && target.trainerId === auth.operatorId;
    }
    if (!isSelf && !isAdmin && !isTrainerOfTarget) {
      console.warn('[api/operators/:id PUT] FORBIDDEN', { actor: auth.operatorId, target: id });
      return NextResponse.json({ error: 'Forbidden: cannot update another operator' }, { status: 403 });
    }

    const body = await req.json();

    // Admin supersedes self/trainer. Self supersedes trainer (if a trainer edits their
    // own profile we want the self set, not the trainer set).
    const allowed = isAdmin ? ADMIN_FIELDS : isSelf ? SELF_FIELDS : TRAINER_FIELDS;
    const data = pickFields(body, allowed);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields in request' }, { status: 400 });
    }

    // Shape-check JSON columns before they hit Prisma. Without this, a caller
    // could PUT { profile: "oops" } and store a string where code expects an
    // object, producing a NPE on next read. We only validate container shape
    // (object/array), not nested schema — see operatorValidation.ts.
    const issues = validateOperatorJsonFields(data as Record<string, unknown>);
    if (issues.length > 0) {
      console.warn('[api/operators/:id PUT] shape validation failed', { actor: auth.operatorId, target: id, issues });
      return NextResponse.json(
        { error: 'Invalid JSON field shape', issues },
        { status: 400 },
      );
    }

    const updated = await prisma.operator.update({ where: { id }, data });

    return NextResponse.json({
      operator: {
        ...updated,
        intake: updated.intake as Record<string, unknown>,
        profile: updated.profile as Record<string, unknown>,
        nutrition: updated.nutrition as Record<string, unknown>,
        prs: updated.prs as unknown[],
        injuries: updated.injuries as unknown[],
        preferences: updated.preferences as Record<string, unknown>,
        workouts: updated.workouts as Record<string, unknown>,
        dayTags: updated.dayTags as Record<string, unknown>,
        sitrep: updated.sitrep as Record<string, unknown>,
        dailyBrief: updated.dailyBrief as Record<string, unknown>,
      },
    });
  } catch (error) {
    console.error('Failed to update operator:', error);
    return NextResponse.json({ error: 'Failed to update operator' }, { status: 500 });
  }
}
