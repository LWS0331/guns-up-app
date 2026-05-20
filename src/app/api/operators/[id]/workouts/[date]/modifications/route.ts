import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import type { Workout } from '@/lib/types';
import {
  applyWorkoutModification,
  type WorkoutModification,
} from '@/lib/workoutModification';

// POST /api/operators/:id/workouts/:date/modifications
//
// Apply one or more surgical workout modifications to the workout on `date`.
// Unlike full PATCH /workouts (which overwrites the whole day's blocks),
// this PRESERVES workout.results — logged sets / weights / RPE survive.
// Block IDs are preserved across swaps so per-set logged results still map.
//
// Body: { modifications: WorkoutModification[] }
// Modification types accepted:
//   - swap_exercise:        replace an exercise block, preserving id+results
//   - add_block:            insert a new block after a named exercise
//   - remove_block:         delete a block by name / id
//   - update_prescription:  change prescription string on an existing block
//   - reorder_blocks:       reorder blocks by id list
//
// (prefill_weights is intentionally NOT accepted — it targets live planner
//  state, not the persisted workout object.)
//
// Auth: requireTrainerAuth + self/admin/trainer-of-target.
//
// Response: { ok, applied, skipped: [{type, reason}], workout }

interface AcceptedMod extends Omit<WorkoutModification, 'type'> {
  type: 'swap_exercise' | 'add_block' | 'remove_block' | 'update_prescription' | 'reorder_blocks';
}

const ACCEPTED_TYPES = new Set<string>([
  'swap_exercise',
  'add_block',
  'remove_block',
  'update_prescription',
  'reorder_blocks',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, date } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as { modifications?: unknown };
    if (!Array.isArray(body.modifications) || body.modifications.length === 0) {
      return NextResponse.json(
        { error: 'modifications array required (at least one entry)' },
        { status: 400 }
      );
    }
    if (body.modifications.length > 25) {
      return NextResponse.json(
        { error: 'too many modifications in one request (max 25)' },
        { status: 400 }
      );
    }

    // Validate each mod has an accepted type. The full schema is enforced
    // by applyWorkoutModification's discriminated union — we just gate the
    // entry to keep prefill_weights and garbage payloads out.
    const mods: AcceptedMod[] = [];
    for (const m of body.modifications as unknown[]) {
      if (!m || typeof m !== 'object') {
        return NextResponse.json({ error: 'each modification must be an object' }, { status: 400 });
      }
      const t = (m as { type?: unknown }).type;
      if (typeof t !== 'string' || !ACCEPTED_TYPES.has(t)) {
        return NextResponse.json(
          { error: `unsupported modification type: ${String(t)}` },
          { status: 400 }
        );
      }
      mods.push(m as AcceptedMod);
    }

    // Load + locate workout for the date
    const op = await prisma.operator.findUnique({
      where: { id },
      select: { workouts: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const allWorkouts = (op.workouts || {}) as Record<string, Workout>;
    const existing = allWorkouts[date];
    if (!existing) {
      return NextResponse.json(
        { error: `No workout on ${date} to modify` },
        { status: 404 }
      );
    }

    // Apply mods sequentially. Each call returns a fresh Workout +
    // changed flag + optional reason. Failed mods are collected for the
    // response so the caller can surface "I did 3 of 4, here's why one
    // skipped."
    let workout = existing;
    let applied = 0;
    const skipped: Array<{ type: string; reason: string }> = [];
    for (const m of mods) {
      const result = applyWorkoutModification(workout, m as WorkoutModification);
      workout = result.workout;
      if (result.changed) {
        applied++;
      } else {
        skipped.push({
          type: m.type,
          reason: result.reason || 'no_op',
        });
      }
    }

    if (applied === 0) {
      return NextResponse.json(
        { ok: false, applied: 0, skipped, workout: existing, error: 'no modifications applied' },
        { status: 422 }
      );
    }

    // Persist
    const nextWorkouts = { ...allWorkouts, [date]: workout };
    await prisma.operator.update({
      where: { id },
      data: { workouts: nextWorkouts as object },
    });

    return NextResponse.json({ ok: true, applied, skipped, workout });
  } catch (err) {
    console.error('[api/operators/:id/workouts/:date/modifications POST] failed:', err);
    return NextResponse.json(
      { error: 'Failed to apply workout modifications' },
      { status: 500 }
    );
  }
}
