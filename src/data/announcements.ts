// What's New — release announcements shown to operators on first
// login after a feature ships.
//
// STANDING SHIPPING ORDER (April 2026, Ruben):
//   "Every time there's an update the users on their next login see a
//    full screen alert that gives them a quick update about the new
//    feature. This does not apply to bug fixes — only feature adds."
//
// Architecture:
//   - Static array (this file) — no DB migration, version-controlled
//     announcements ship with the binary
//   - Each operator's `preferences.lastSeenAnnouncementId` tracks which
//     entry they've dismissed (existing JSON column, no schema change)
//   - GET /api/announcements/current returns the most recent entry the
//     operator hasn't seen, or null
//   - POST /api/announcements/dismiss writes their lastSeenAnnouncementId
//   - WhatsNewModal in AppShell renders on app load when an unseen
//     announcement comes back
//
// AUTHOR'S CHECKLIST when adding a new entry:
//   [ ] BUG FIX? — DON'T add an announcement (per standing order)
//   [ ] Append at the END of the array (newest last)
//   [ ] `id` is stable forever — picks up where users last dismissed
//   [ ] `publishedAt` is when this ships, ISO 8601
//   [ ] Keep `title` under 40 chars; `body` under 240 chars
//   [ ] If the announcement should drive an action (e.g. open a
//       picker), wire `cta.action` to one of the AppShell-known
//       action keys (`open_persona_picker`, `open_intake`, etc.)
//   [ ] Test by clearing your operator's lastSeenAnnouncementId in DB,
//       reloading the app, confirming the modal fires

export type AnnouncementAction =
  | 'open_persona_picker'      // routes to PersonaPicker as standalone
  | 'open_intake'              // routes to IntakeForm
  | 'open_billing'             // opens BillingPanel
  | 'open_wearable_connect'    // opens wearable hub
  | 'dismiss_only';            // CTA just closes the modal

export interface AnnouncementCta {
  label: string;
  action: AnnouncementAction;
}

export interface Announcement {
  /** Stable forever — used to track who has seen what. */
  id: string;
  /** ISO 8601 when this shipped. Sort key for "most recent unseen". */
  publishedAt: string;
  /** Tier label rendered above the headline (e.g. "NEW FEATURE"). */
  tag: string;
  /** Headline. ≤ 40 chars. */
  title: string;
  /** Body copy. ≤ 240 chars. */
  body: string;
  /** Optional bullet points after body. Each ≤ 80 chars. */
  bullets?: string[];
  /** Optional CTA — null = just a Got It dismiss. */
  cta?: AnnouncementCta;
  /** Hex accent color used for the modal border + CTA. */
  accent?: string;
}

// ════════════════════════════════════════════════════════════════════
// THE LIST — append new entries at the bottom
// ════════════════════════════════════════════════════════════════════

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'persona-launch-2026-04-30',
    publishedAt: '2026-04-30',
    tag: 'NEW · PICK YOUR COACH',
    title: 'Four coaches. One platform. Pick yours.',
    body: 'Gunny has company. Three new AI coaches join the roster — different voices, same standard. Pick the one that matches how you train best.',
    bullets: [
      'GUNNY — Marine DI, command voice (the standard you know)',
      'RAVEN — Marine officer, laconic, surgical',
      'BUCK — Marine NCO, conversational, explains the why',
      'COACH — youth specialist, ages 10-18 only',
    ],
    cta: {
      label: 'PICK YOUR COACH',
      action: 'open_persona_picker',
    },
    accent: '#00ff41',
  },
];

/**
 * Return the most recent announcement the operator hasn't dismissed.
 * Sorts by publishedAt descending and returns the first one whose id
 * is later than the operator's lastSeenAnnouncementId.
 */
export function getNextUnseenAnnouncement(
  lastSeenAnnouncementId?: string,
): Announcement | null {
  // Sort descending by publishedAt so newest is first.
  const sorted = [...ANNOUNCEMENTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  if (sorted.length === 0) return null;

  // No prior dismissal → show the newest one.
  if (!lastSeenAnnouncementId) return sorted[0];

  // Find the index of the last-seen announcement in the sorted list.
  // Anything BEFORE that index in sorted (i.e. newer) hasn't been seen.
  const seenIdx = sorted.findIndex(a => a.id === lastSeenAnnouncementId);
  if (seenIdx === -1) {
    // Last-seen id isn't in the list (renamed / removed) — show newest.
    return sorted[0];
  }
  // seenIdx === 0 means they've already dismissed the newest → nothing to show.
  if (seenIdx === 0) return null;
  // Otherwise, return the next-newer entry (sorted[seenIdx - 1]).
  return sorted[seenIdx - 1];
}
