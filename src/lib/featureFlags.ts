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
