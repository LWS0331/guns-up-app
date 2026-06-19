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
 * Flatten Vital's getConnectedProviders response into a flat provider list.
 *
 * The SDK types the resolved value as
 * `Record<string, ClientFacingProviderWithStatus[]>` (await yields the raw
 * record — HttpResponsePromise extends Promise<T>, no `.data` wrapper).
 * We parse DEFENSIVELY so a response-shape change degrades to "no
 * providers" rather than producing malformed rows: an empty list makes the
 * planner a no-op (nothing to activate, and deactivate only fires for rows
 * it can prove are gone — see the route), instead of silently classifying
 * every real connection as "deactivate".
 *
 * Pure (no SDK, no DB) so the runtime-shape glue the route depends on is
 * unit-testable without mocking Vital.
 */
export function parseConnectedProviders(resp: unknown): VitalProviderStatus[] {
  if (!resp || typeof resp !== 'object') return [];
  const out: VitalProviderStatus[] = [];
  for (const value of Object.values(resp as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue; // skip non-array top-level values
    for (const p of value) {
      if (!p || typeof p !== 'object') continue;
      const rec = p as Record<string, unknown>;
      if (typeof rec.slug !== 'string' || !rec.slug) continue;
      out.push({
        slug: rec.slug,
        name: typeof rec.name === 'string' ? rec.name : rec.slug,
        status: typeof rec.status === 'string' ? rec.status : '',
      });
    }
  }
  return out;
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
