// POST /api/admin/create-operator
//
// Create a brand-new operator from scratch — for closed-beta sign-ups
// who weren't in the original seed. Bundles the steps that would
// otherwise be: create row + set email + set password + set trial
// promo + attach trainer protocol into one idempotent admin call.
//
// Why this exists: the regular registration endpoint (/api/auth/register)
// is locked until June 2026. Closed-beta + manually-onboarded users
// (Instagram-DM intake) get added one-by-one as their emails come in.
// The OpsCenter ONBOARDING tab is the UI on top of this endpoint.
//
// Auth: either
//   - ADMIN_SECRET in `x-admin-secret` header (CLI / curl path), OR
//   - authenticated session whose operatorId is in OPS_CENTER_ACCESS
//     (the OpsCenter ONBOARDING tab — Ruben + Britney by default).
//
// Body:
//   {
//     // === REQUIRED ===
//     name: string,                // e.g. "William Spengler"
//     email: string,               // unique, normalized to lowercase
//
//     // === COMMONLY OVERRIDDEN ===
//     id?: string,                 // op-<slug>; auto-derived from name if omitted
//     callsign?: string,           // 2-20 char uppercase; auto-derived from name if omitted
//     password?: string,           // ≥ 8 chars; auto-generated 16-char URL-safe if omitted
//     role?: 'client' | 'trainer', // default: 'client'
//     tier?: 'haiku' | 'sonnet' | 'opus' | 'white_glove',
//                                  // default: 'opus' (COMMANDER) when trialDays>0,
//                                  // else 'haiku' (free RECON)
//     trainerId?: string,          // default: 'op-ruben'
//     pin?: string,                // 4 digits, default: random
//     betaUser?: boolean,          // default: true
//
//     // === TRIAL ===
//     // The OpsCenter ONBOARDING tab defaults every new client to a
//     // 14-day COMMANDER trial. When trialDays > 0:
//     //   - tier is set to trialTier (defaults to 'opus' = COMMANDER)
//     //   - promoActive is set to true
//     //   - promoType is set to 'trial_<tier>_<days>d' (e.g. 'trial_opus_14d')
//     //   - promoExpiry is set to ISO date <now> + trialDays
//     // When the trial expires, /api/auth/me surfaces trialExpired:true
//     // and the AppShell banner prompts the operator to pick a tier.
//     trialDays?: number,          // 0 = no trial (default); 1-90 = trial length
//     trialTier?: 'sonnet' | 'opus' | 'white_glove',
//                                  // tier they get DURING the trial
//                                  // (default: 'opus' = COMMANDER)
//
//     // === COACH-SUPPLIED PROTOCOL ===
//     trainerNotes?: string,       // long-form protocol/notes (max 256KB).
//                                  // Surfaced in TrainerDashboard + Gunny prompt.
//   }
//
// Response (success):
//   { ok: true,
//     operator: { id, name, callsign, email, role, tier, trainerId,
//                 betaUser, promoActive, promoType, promoExpiry,
//                 trainerNotesLength },
//     // password is ONLY echoed when the caller did NOT supply one
//     // (so the trainer can DM it to the new operator). When the
//     // caller supplied a password, it's not echoed back.
//     generatedPassword?: string,
//   }
//
// Response (error):
//   { ok: false, error, reason } with 400/409/500 status

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getAuthOperator } from '@/lib/authMiddleware';
import { OPS_CENTER_ACCESS } from '@/lib/types';

const VALID_ROLES = new Set(['client', 'trainer']);
const VALID_TIERS = new Set(['haiku', 'sonnet', 'opus', 'white_glove']);
const VALID_TRIAL_TIERS = new Set(['sonnet', 'opus', 'white_glove']);
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
const MAX_TRIAL_DAYS = 90;

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// 16-char URL-safe password — ~95 bits of entropy, no shell-quoting
// hazards (no quotes, backslashes, or shell-meta chars). Trainer DMs
// this to the new operator after onboarding.
function generateSecurePassword(): string {
  return randomBytes(12)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 16);
}

// Derive a slug-id from a name: "Ammon Morrison" → "op-ammon".
// Falls back to the second name token if the first is too short, and
// to "op-user" if neither token survives normalization.
function suggestId(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    if (tok.length >= 2 && tok.length <= 38) return `op-${tok}`;
  }
  return 'op-user';
}

// Derive a callsign from a name: "Ammon Morrison" → "AMMON".
// Same fallback chain as suggestId. Caller resolves collisions by
// appending an integer suffix.
function suggestCallsign(name: string): string {
  const tokens = name
    .toUpperCase()
    .replace(/[^A-Z\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    if (tok.length >= 2 && tok.length <= 18) return tok;
  }
  return 'OPERATOR';
}

// Append a numeric suffix until the candidate is unique. Caps at 99
// attempts so a malformed loop can't lock the request thread.
async function findFreeId(base: string): Promise<string | null> {
  if (!(await prisma.operator.findUnique({ where: { id: base } }))) return base;
  for (let n = 1; n <= 99; n++) {
    const candidate = `${base}-${n}`;
    if (candidate.length > 43) break;
    if (!(await prisma.operator.findUnique({ where: { id: candidate } }))) {
      return candidate;
    }
  }
  return null;
}

async function findFreeCallsign(base: string): Promise<string | null> {
  if (!(await prisma.operator.findFirst({ where: { callsign: base } }))) return base;
  for (let n = 1; n <= 99; n++) {
    const candidate = `${base}${n}`;
    if (candidate.length > 20) break;
    if (!(await prisma.operator.findFirst({ where: { callsign: candidate } }))) {
      return candidate;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Auth path 1: x-admin-secret header (CLI / curl).
  const secret = req.headers.get('x-admin-secret');
  const secretMatches =
    !!process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET;

  // Auth path 2: authenticated session whose operatorId is in
  // OPS_CENTER_ACCESS. Lets the OpsCenter ONBOARDING tab call this
  // endpoint with the session cookie/JWT instead of needing the admin
  // to paste the secret into a form field.
  let sessionAuthorized = false;
  if (!secretMatches) {
    const authData = getAuthOperator(req);
    if (authData && OPS_CENTER_ACCESS.includes(authData.operatorId)) {
      sessionAuthorized = true;
    }
  }

  if (!secretMatches && !sessionAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // === Required: name + email ===
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!name || name.length < 2 || name.length > 100) {
      return NextResponse.json({
        ok: false,
        error: 'invalid name',
        reason: 'name must be 2-100 characters',
      }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid email',
        reason: 'email must be a valid format',
      }, { status: 400 });
    }

    // === Email collision (cheap; check before deriving id/callsign) ===
    const emailCollision = await prisma.operator.findFirst({ where: { email } });
    if (emailCollision) {
      return NextResponse.json({
        ok: false,
        error: 'email collision',
        reason: `email ${email} already owned by ${emailCollision.id} (callsign: ${emailCollision.callsign})`,
      }, { status: 409 });
    }

    // === id (auto-derive from name if not supplied) ===
    let id = String(body?.id || '').trim().toLowerCase();
    if (!id) {
      const suggested = suggestId(name);
      const free = await findFreeId(suggested);
      if (!free) {
        return NextResponse.json({
          ok: false,
          error: 'id derivation failed',
          reason: `could not find a free id derived from "${name}" — supply id explicitly`,
        }, { status: 400 });
      }
      id = free;
    } else {
      if (!ID_RE.test(id)) {
        return NextResponse.json({
          ok: false,
          error: 'invalid id',
          reason: 'id must match pattern op-[a-z0-9-]{2,40} (e.g. "op-william")',
        }, { status: 400 });
      }
      const idCollision = await prisma.operator.findUnique({ where: { id } });
      if (idCollision) {
        return NextResponse.json({
          ok: false,
          error: 'id collision',
          reason: `operator id ${id} already exists (callsign: ${idCollision.callsign})`,
        }, { status: 409 });
      }
    }

    // === callsign (auto-derive from name if not supplied) ===
    let callsign = String(body?.callsign || '').trim().toUpperCase();
    if (!callsign) {
      const suggested = suggestCallsign(name);
      const free = await findFreeCallsign(suggested);
      if (!free) {
        return NextResponse.json({
          ok: false,
          error: 'callsign derivation failed',
          reason: `could not find a free callsign derived from "${name}" — supply callsign explicitly`,
        }, { status: 400 });
      }
      callsign = free;
    } else {
      if (!CALLSIGN_RE.test(callsign)) {
        return NextResponse.json({
          ok: false,
          error: 'invalid callsign',
          reason: 'callsign must be 2-20 uppercase alphanumeric chars + hyphens',
        }, { status: 400 });
      }
      const callsignCollision = await prisma.operator.findFirst({ where: { callsign } });
      if (callsignCollision) {
        return NextResponse.json({
          ok: false,
          error: 'callsign collision',
          reason: `callsign ${callsign} already taken by ${callsignCollision.id}`,
        }, { status: 409 });
      }
    }

    // === password (auto-generate if not supplied; echo back when generated) ===
    let password: string;
    let passwordWasGenerated = false;
    if (body?.password == null) {
      password = generateSecurePassword();
      passwordWasGenerated = true;
    } else {
      if (typeof body.password !== 'string') {
        return NextResponse.json({
          ok: false,
          error: 'invalid password',
          reason: 'password must be a string',
        }, { status: 400 });
      }
      if (body.password.length < MIN_PASSWORD_LENGTH || body.password.length > MAX_PASSWORD_LENGTH) {
        return NextResponse.json({
          ok: false,
          error: 'invalid password',
          reason: `password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`,
        }, { status: 400 });
      }
      password = body.password;
    }

    // === Optional: role / trainerId / pin / betaUser ===
    const role = String(body?.role || 'client');
    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid role',
        reason: `role must be one of: ${[...VALID_ROLES].join(', ')}`,
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

    // === Trial config ===
    // trialDays: 0 disables. 1-90 sets a trial. trialTier defaults to
    // 'opus' (COMMANDER) since that's the OpsCenter ONBOARDING default —
    // give them the most-loaded experience for 14 days, then prompt to
    // pick OPERATOR / COMMANDER / RECON.
    let trialDays = 0;
    if (body?.trialDays != null) {
      const n = Number(body.trialDays);
      if (!Number.isFinite(n) || n < 0 || n > MAX_TRIAL_DAYS) {
        return NextResponse.json({
          ok: false,
          error: 'invalid trialDays',
          reason: `trialDays must be a number between 0 and ${MAX_TRIAL_DAYS}`,
        }, { status: 400 });
      }
      trialDays = Math.floor(n);
    }
    const trialTier = String(body?.trialTier || 'opus');
    if (trialDays > 0 && !VALID_TRIAL_TIERS.has(trialTier)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid trialTier',
        reason: `trialTier must be one of: ${[...VALID_TRIAL_TIERS].join(', ')}`,
      }, { status: 400 });
    }

    // tier: when trial is active, tier IS the trialTier. Otherwise
    // accept caller-supplied tier (default haiku = free RECON).
    const tier = trialDays > 0
      ? trialTier
      : String(body?.tier || 'haiku');
    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json({
        ok: false,
        error: 'invalid tier',
        reason: `tier must be one of: ${[...VALID_TIERS].join(', ')}`,
      }, { status: 400 });
    }

    // promo* fields drive the trial-expiry banner via /api/auth/me.
    let promoActive = false;
    let promoType: string | null = null;
    let promoExpiry: string | null = null;
    if (trialDays > 0) {
      promoActive = true;
      promoType = `trial_${trialTier}_${trialDays}d`;
      const expiry = new Date();
      expiry.setUTCDate(expiry.getUTCDate() + trialDays);
      // Schema stores promoExpiry as ISO date YYYY-MM-DD. Use UTC date
      // boundary so a trial set "today" expires at end-of-day in UTC.
      promoExpiry = expiry.toISOString().slice(0, 10);
    }

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
        promoActive,
        promoType,
        promoExpiry,
        // Optional long-form coach protocol. Only set when caller passed
        // a string; otherwise let Prisma use schema default (NULL).
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
        promoActive: created.promoActive,
        promoType: created.promoType,
        promoExpiry: created.promoExpiry,
        trainerNotesLength: created.trainerNotes?.length ?? 0,
      },
      // Only echo the password when WE generated it (so the trainer can
      // DM it). If the caller supplied one, they already have it.
      ...(passwordWasGenerated && { generatedPassword: password }),
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
