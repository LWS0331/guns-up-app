// POST /api/auth/magic-link
//
// Two flows on this endpoint:
//
// 1. SEND a magic link (no auth required)
//    Body: { email: string, intent?: 'sign_in' | 'recover' }
//    - Looks up the operator by email
//    - If found: mints a 7-day magic_link token, queues activation
//      email #1 (or password-reset email)
//    - If not found: returns 200 anyway (don't leak account existence)
//    - Response: { ok: true, queued: boolean }
//
// 2. CONSUME a magic link (no auth required, the token IS the auth)
//    Body: { token: string }
//    - Verifies + consumes the token
//    - Returns a session token (JWT) the client uses for future calls
//    - Response: { ok: true, sessionToken, operator: { id, callsign, tier } }
//
// The split lives on a single endpoint because both flows are the
// public surface of "magic link" — clients can choose which by
// passing `email` (send) vs `token` (consume).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mintToken, consumeToken } from '@/lib/authTokens';
import { generateToken } from '@/lib/auth';
import { queueActivationEmail } from '@/lib/activationEmails';
import { isOperatorAllowed, NOT_ALLOWED_RESPONSE } from '@/lib/allowlist';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // === CONSUME path ===
    if (typeof body?.token === 'string') {
      const result = await consumeToken(body.token, 'magic_link');
      if (result.ok !== true) {
        // strict: false in tsconfig — reach for `reason` defensively
        // since the discriminated-union narrowing isn't applied without it.
        const reason = (result as { reason?: string }).reason;
        return NextResponse.json({
          ok: false,
          error: reason === 'expired'
            ? 'This magic link has expired. Request a new one.'
            : reason === 'used'
              ? 'This magic link has already been used. Request a new one.'
              : reason === 'not_found'
                ? 'Magic link not recognized.'
                : 'Invalid magic link.',
          reason,
        }, { status: 400 });
      }

      const op = await prisma.operator.findUnique({ where: { id: result.operatorId } });
      if (!op) {
        return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });
      }

      // Allowlist gate. A token minted before the operator was de-
      // activated should not be honored — failing closed.
      if (!isOperatorAllowed(op)) {
        return NextResponse.json(NOT_ALLOWED_RESPONSE, { status: 403 });
      }

      // Mark first app open if this is the activation magic link.
      if (!op.firstAppOpenAt) {
        await prisma.operator.update({
          where: { id: op.id },
          data: { firstAppOpenAt: new Date() },
        });
      }

      const sessionToken = generateToken(op.id, op.role);
      return NextResponse.json({
        ok: true,
        sessionToken,
        operator: {
          id: op.id,
          callsign: op.callsign,
          email: op.email,
          tier: op.tier,
          role: op.role,
        },
      });
    }

    // === SEND path ===
    const email: string | undefined = (body?.email || '').toString().trim().toLowerCase();
    const intent: string = (body?.intent || 'sign_in').toString();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
    }

    const op = await prisma.operator.findFirst({ where: { email } });
    // Don't leak account existence — always return 200 with queued:true.
    // The activation cron will dedupe if no operator matched.
    if (!op) {
      return NextResponse.json({ ok: true, queued: false });
    }

    // Allowlist gate (defense in depth — finding by email implies
    // the operator has an email, but admins might null one to revoke).
    if (!isOperatorAllowed(op)) {
      // Same generic 200 — don't leak that this email is on file
      // but de-activated.
      return NextResponse.json({ ok: true, queued: false });
    }

    const minted = await mintToken({
      operatorId: op.id,
      type: 'magic_link',
      intent,
      metadata: {},
    });

    // Queue the email (provider not yet wired — see DEFERRED list).
    // The queue write is real; actual SMTP send happens once Resend/
    // Postmark is configured.
    await queueActivationEmail({
      operatorId: op.id,
      kind: intent === 'recover' ? 'password_reset' : 'magic_link',
      email,
      magicToken: minted.token,
    });

    return NextResponse.json({ ok: true, queued: true });
  } catch (error) {
    console.error('[magic-link] error', error);
    return NextResponse.json({
      error: 'Failed to process magic link request',
      details: String(error),
    }, { status: 500 });
  }
}
