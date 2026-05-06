// POST /api/admin/create-operator
//
// Create a brand-new operator from scratch — for closed-beta sign-ups
// who weren't in the original seed. Bundles the three steps that would
// otherwise be: create row + set email + set password into one
// idempotent admin call.
//
// Why this exists: the regular registration endpoint (/api/auth/register)
// is locked until June 2026. Closed-beta users get added one-by-one as
// their emails come in. Until now we've been activating SEEDED operators
// via set-emails + set-password. This endpoint handles new operators
// that weren't pre-seeded.
//
// Auth: ADMIN_SECRET in `x-admin-secret` header.
//
// Body:
//   {
//     id: string,                  // e.g. "op-william"
//     name: string,                // e.g. "William Spengler"
//     callsign: string,            // e.g. "FOXHOUND" (uppercased)
//     email: string,               // unique
//     password: string,            // ≥ 8 chars
//     role?: 'client' | 'trainer', // default: 'client'
//     tier?: 'haiku' | 'sonnet' | 'opus' | 'white_glove',
//                                  // default: 'haiku' (free RECON)
//     trainerId?: string,          // default: 'op-ruben' (closed-beta default)
//     pin?: string,                // 4 digits, default: random
//     betaUser?: boolean,          // default: true
//     trainerNotes?: string,       // long-form coach-supplied protocol /
//                                  // notes (max 256KB). Surfaced in the
//                                  // TrainerDashboard + included in
//                                  // Gunny's prompt context.
//   }
//
// Response (success):
//   { ok: true, operator: { id, callsign, email, role, tier, trainerId } }
//
// Response (error):
//   { ok: false, error, reason } with 400/409/500 status
//
// Notes:
//   - id must start with "op-" and be lowercase alphanumeric + hyphens
//   - email is normalized to lowercase
//   - callsign is normalized to uppercase
//   - email collision returns 409 with the conflicting operator's id
//   - id collision returns 409
//   - password is bcrypt-hashed (cost 12), never echoed back
//   - all JSON fields (intake, profile, etc.) initialized to empty
//   - operator is automatically betaUser=true unless overridden

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const VALID_ROLES = new Set(['client', 'trainer']);
const VALID_TIERS = new Set(['haiku', 'sonnet', 'opus', 'white_glove']);
const ID_RE = /^op-[a-z0-9-]{2,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN_RE = /^[A-Z0-9-]{2,20}$/;
const PIN_RE = /^\d{4}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
// 256 KB ceiling on trainerNotes — large enough for a full multi-month
// hybrid programming protocol (the longest real-world payload we've seen
// is ~22 KB), small enough that a single record stays well below
// Postgres' practical TEXT row limits and any cron-driven export.
const MAX_TRAINER_NOTES_LENGTH = 256 * 1024;

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // === Validate required fields ===
    const id = String(body?.id || '').trim().toLowerCase();
    const name = String(body?.name || '').trim();
    const callsign = String(body?.callsign || '').trim().toUpperCase();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = body?.password;

    if (!ID_RE.test(id)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid id',
        reason: 'id must match pattern op-[a-z0-9-]{2,40} (e.g. "op-william")',
      }, { status: 400 });
    }
    if (!name || name.length < 2 || name.length > 100) {
      return NextResponse.json({
        ok: false,
        error: 'invalid name',
        reason: 'name must be 2-100 characters',
      }, { status: 400 });
    }
    if (!CALLSIGN_RE.test(callsign)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid callsign',
        reason: 'callsign must be 2-20 uppercase alphanumeric chars + hyphens',
      }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid email',
        reason: 'email must be a valid format',
      }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({
        ok: false,
        error: 'invalid password',
        reason: `password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
      }, { status: 400 });
    }

    // === Validate optional fields ===
    const role = String(body?.role || 'client');
    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid role',
        reason: `role must be one of: ${[...VALID_ROLES].join(', ')}`,
      }, { status: 400 });
    }

    const tier = String(body?.tier || 'haiku');
    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid tier',
        reason: `tier must be one of: ${[...VALID_TIERS].join(', ')}`,
      }, { status: 400 });
    }

    const trainerId = body?.trainerId === null
      ? null
      : String(body?.trainerId || 'op-ruben');
    const pin = body?.pin ? String(body.pin) : randomPin();
    if (!PIN_RE.test(pin)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid pin',
        reason: 'pin must be exactly 4 digits',
      }, { status: 400 });
    }
    const betaUser = body?.betaUser !== false;  // default true

    // === trainerNotes (optional long-form coach protocol) ===
    let trainerNotes: string | null = null;
    if (body?.trainerNotes != null) {
      if (typeof body.trainerNotes !== 'string') {
        return NextResponse.json({
          ok: false,
          error: 'invalid trainerNotes',
          reason: 'trainerNotes must be a string',
        }, { status: 400 });
      }
      if (body.trainerNotes.length > MAX_TRAINER_NOTES_LENGTH) {
        return NextResponse.json({
          ok: false,
          error: 'trainerNotes too large',
          reason: `trainerNotes must be ≤ ${MAX_TRAINER_NOTES_LENGTH} bytes (got ${body.trainerNotes.length})`,
        }, { status: 400 });
      }
      trainerNotes = body.trainerNotes;
    }

    // === Collision checks ===
    const idCollision = await prisma.operator.findUnique({ where: { id } });
    if (idCollision) {
      return NextResponse.json({
        ok: false,
        error: 'id collision',
        reason: `operator id ${id} already exists (callsign: ${idCollision.callsign})`,
      }, { status: 409 });
    }
    const emailCollision = await prisma.operator.findFirst({ where: { email } });
    if (emailCollision) {
      return NextResponse.json({
        ok: false,
        error: 'email collision',
        reason: `email ${email} already owned by ${emailCollision.id} (callsign: ${emailCollision.callsign})`,
      }, { status: 409 });
    }
    const callsignCollision = await prisma.operator.findFirst({ where: { callsign } });
    if (callsignCollision) {
      return NextResponse.json({
        ok: false,
        error: 'callsign collision',
        reason: `callsign ${callsign} already taken by ${callsignCollision.id}`,
      }, { status: 409 });
    }

    // === Trainer reference check ===
    if (trainerId) {
      const trainer = await prisma.operator.findUnique({
        where: { id: trainerId },
        select: { id: true, role: true },
      });
      if (!trainer) {
        return NextResponse.json({
          ok: false,
          error: 'trainer not found',
          reason: `trainerId ${trainerId} does not exist`,
        }, { status: 400 });
      }
      if (trainer.role !== 'trainer') {
        return NextResponse.json({
          ok: false,
          error: 'invalid trainer reference',
          reason: `${trainerId} is not a trainer (role=${trainer.role})`,
        }, { status: 400 });
      }
    }

    // === Create ===
    const passwordHash = await hashPassword(password);
    const created = await prisma.operator.create({
      data: {
        id,
        name,
        callsign,
        pin,
        email,
        passwordHash,
        role,
        tier,
        trainerId,
        betaUser,
        // Optional long-form coach protocol. Only set when caller passed
        // a string; null lets Prisma use the schema default (NULL).
        ...(trainerNotes !== null && { trainerNotes }),
        // Initialize all JSON columns to safe empties.
        intake: {},
        profile: {},
        nutrition: {},
        prs: [],
        injuries: [],
        preferences: {},
        workouts: {},
        dayTags: {},
        sitrep: {},
        dailyBrief: {},
        billing: {},
      },
    });

    return NextResponse.json({
      ok: true,
      operator: {
        id: created.id,
        name: created.name,
        callsign: created.callsign,
        email: created.email,
        role: created.role,
        tier: created.tier,
        trainerId: created.trainerId,
        betaUser: created.betaUser,
        trainerNotesLength: created.trainerNotes?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('[admin/create-operator] error', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to create operator',
      details: String(error),
    }, { status: 500 });
  }
}
