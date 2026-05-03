'use client';

// Thin client wrapper around the IG-DM <a> tags on the /early-access
// page. Reason: the page itself is a server component for fast TTFB
// (mostly static marketing copy). PostHog is browser-only, so we
// can't `trackEvent` from the page directly. Wrapping the four IG-DM
// links here lets each one fire EARLY_ACCESS_IG_CLICK on click without
// turning the whole page into a client component.
//
// initAnalytics is called from EarlyAccessChat's mount effect (the
// chat is always rendered on /early-access, so it bootstraps
// PostHog before any CTA can be clicked). trackEvent here just
// captures the click — if init never ran, it silently no-ops, which
// is the desired fail-soft behavior on a marketing page.

import type { ReactNode } from 'react';
import { trackEvent, EVENTS } from '@/lib/analytics';

interface Props {
  /** IG deep-link URL — typically `https://ig.me/m/gunnyai_fit` for a
   *  pre-composed DM, or `https://instagram.com/gunnyai_fit` for the
   *  profile page. */
  href: string;
  /** Discriminator for the click event. Maps to the `cta` property
   *  on EARLY_ACCESS_IG_CLICK. Use sparingly — adding a new value
   *  means updating PostHog dashboards too. */
  cta: 'commander' | 'warfighter' | 'ops_helper' | 'closed_box';
  /** Set when the click is from a tier-specific CTA. Lets PostHog
   *  segment by intended tier without inferring from `cta` alone. */
  tier?: 'commander' | 'warfighter';
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export default function EarlyAccessIgCta({
  href,
  cta,
  tier,
  ariaLabel,
  className,
  children,
}: Props) {
  const onClick = () => {
    trackEvent(EVENTS.EARLY_ACCESS_IG_CLICK, {
      cta,
      ...(tier && { tier }),
    });
  };

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
