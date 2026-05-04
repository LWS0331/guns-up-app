// Feature flags — runtime gates for partially-rolled-out features.
//
// Pattern: each flag has a small read helper. Client surfaces use
// NEXT_PUBLIC_* vars (Next.js inlines those into the bundle); server
// surfaces use the unprefixed var so we can flip server-only behavior
// without rebuilding the client.
//
// Default = false / disabled. Production rollout: set both vars in
// Railway env, redeploy, verify the surfaces appear, then promote
// junior accounts. Rollback is instant — unset the var.

// ─── JUNIOR_OPERATOR_ENABLED ──────────────────────────────────────────────
//
// Gates the entire Junior Operator program (10–18 yr soccer athletes).
// When false, all junior-specific UI surfaces are hidden and junior
// operators fall through to the adult Gunny prompt + intake. When true,
// JuniorIntakeForm replaces IntakeForm for isJunior=true accounts,
// JuniorPRBoard replaces PRBoard, ParentDashboard surfaces in Command
// Center for adults with juniors in their parentIds, and the safety event
// logger writes detected pain/concussion keywords to juniorSafety.events.
//
// The Gunny route itself ALSO checks this flag — when false, junior
// operators get the adult SYSTEM_PROMPT instead of SOCCER_YOUTH_PROMPT.
// That's intentional: with the flag off, the junior coaching surface is
// truly inert in production.

export function isJuniorOperatorEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_JUNIOR_OPERATOR_ENABLED === 'true';
}

export function isJuniorOperatorEnabledServer(): boolean {
  return (
    process.env.JUNIOR_OPERATOR_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_JUNIOR_OPERATOR_ENABLED === 'true'
  );
}

// ─── TRAINER_APPLICATIONS_OPEN ──────────────────────────────────────────
//
// Trainer applications gate. When false, /trainer-apply renders a
// "coming soon" screen instead of the application form.
//
// Flip to true only when the Certified GUNS UP Trainer licensing
// agreement is finalized by counsel and the new pricing/license
// model is ready for public marketing.
export const TRAINER_APPLICATIONS_OPEN: boolean =
  process.env.NEXT_PUBLIC_TRAINER_APPLICATIONS_OPEN === 'true';

// ─── MODEL_AUTOROUTE_ENABLED ────────────────────────────────────────────
//
// Per-query model auto-routing in /api/gunny. When false (default), the
// route uses the strict tier→fixed-model mapping in src/lib/models.ts.
// When true, src/lib/modelRouter.ts classifies each user message and
// picks the cheapest model that respects the operator's tier ceiling
// (with a hard floor at Opus for WARFIGHTER and a hard pin at Haiku for
// RECON).
//
// Server-only flag — the routing decision is made on the server and
// the client is never told which model was chosen.
//
// Rollback is instant: unset MODEL_AUTOROUTE_ENABLED in env, redeploy
// (or hot-reload). The route checks the flag per request, so flips take
// effect on the next chat turn.
export function isModelAutorouteEnabledServer(): boolean {
  return process.env.MODEL_AUTOROUTE_ENABLED === 'true';
}

// ─── REGISTRATION_OPEN ──────────────────────────────────────────────────
//
// Public sign-up gate. When false, the LoginScreen REGISTER button
// surfaces a "closed beta" explainer modal instead of switching to the
// register form. When true, REGISTER toggles the form so a new visitor
// can create an account.
//
// CLIENT FLAG ONLY — the server-side /api/auth/register endpoint has
// its own gate that reads `process.env.REGISTRATION_OPEN === '1'`.
// Both must be flipped together for sign-up to work end-to-end:
//   - Railway env: REGISTRATION_OPEN=1
//   - Railway env: NEXT_PUBLIC_REGISTRATION_OPEN=true
// If only the client flag is set, users see the form but every submit
// 403s with "Registration closed". If only the server flag is set, the
// form is unreachable from the UI.
//
// Default = false (closed-beta era). Pricing v3 + Stripe wired
// (May 2026) → time to flip both ON. Until env vars are set, the modal
// still shows and the landing CTAs effectively dead-end at /login.
export const REGISTRATION_OPEN: boolean =
  process.env.NEXT_PUBLIC_REGISTRATION_OPEN === 'true';
