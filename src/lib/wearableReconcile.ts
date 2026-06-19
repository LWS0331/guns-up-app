// Webhook-independent wearable reconcile (Issue #202).
//
// The connection state for an operator is normally created only by the
// Vital `provider.connection.created` webhook. If that webhook is missed
// (misconfigured secret/URL, transient outage), the operator is stranded
// at `connections: []` with no app-side recovery — /sync even 404s
// ("No wearables connected"). This module reconciles the local
// WearableConnection rows against Vital's own connected-providers truth
// so a reconnect self-heals without depending on the webhook.
//
// The planning step is pure (no SDK, no DB) so it's unit-testable; the
// route applies the plan and the SDK calls live in the route.

/** A connected provider as reported by Vital's getConnectedProviders. */
export interface VitalProviderStatus {
  slug: string;
  name: string;
  /** Vital reports "connected" or "error". */
  status: string;
}

/** The subset of a WearableConnection row the planner needs. */
export interface ExistingConnRow {
  id: string;
  provider: string;
  active: boolean;
}

export interface ReconcilePlan {
  /** Providers connected at Vital that need a row created or reactivated. */
  activate: { provider: string; name: string; existingId: string | null }[];
  /** Local active rows whose provider is no longer connected at Vital. */
  deactivate: { id: string; provider: string }[];
}

function isConnected(status: string | null | undefined): boolean {
  return typeof status === 'string' && status.toLowerCase() === 'connected';
}

/**
 * Diff Vital's connected providers against the local connection rows and
 * return the create/reactivate/deactivate plan. Pure.
 *
 * - A Vital provider with status "connected" that has no active local row
 *   → activate (reactivate the existing row when present, else create).
 * - A local active row whose provider is NOT connected at Vital (gone, or
 *   in "error" status) → deactivate.
 *
 * Provider slugs are compared case-insensitively; the canonical (Vital)
 * slug/name is preserved for writes.
 */
export function planWearableReconcile(
  vitalProviders: VitalProviderStatus[],
  existingRows: ExistingConnRow[],
): ReconcilePlan {
  const connected = vitalProviders.filter((p) => p.slug && isConnected(p.status));
  const connectedSlugs = new Set(connected.map((p) => p.slug.toLowerCase()));

  const rowBySlug = new Map<string, ExistingConnRow>();
  for (const r of existingRows) {
    if (r.provider) rowBySlug.set(r.provider.toLowerCase(), r);
  }

  const activate: ReconcilePlan['activate'] = [];
  for (const p of connected) {
    const existing = rowBySlug.get(p.slug.toLowerCase());
    if (!existing) {
      activate.push({ provider: p.slug, name: p.name, existingId: null });
    } else if (!existing.active) {
      activate.push({ provider: p.slug, name: p.name, existingId: existing.id });
    }
    // existing && active → already correct, no-op
  }

  const deactivate: ReconcilePlan['deactivate'] = [];
  for (const r of existingRows) {
    if (r.active && !connectedSlugs.has(r.provider.toLowerCase())) {
      deactivate.push({ id: r.id, provider: r.provider });
    }
  }

  return { activate, deactivate };
}
