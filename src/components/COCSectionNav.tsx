'use client';

// COCSectionNav — sticky horizontal jump-link bar for the COC tab.
//
// WS1 (May 2026). Before this, the COC tab was a long vertical scroll
// (operator banner → hero stats → weekly overview → PRs → readiness →
// notification settings → leaderboard → achievements → squad feed →
// beta feedback → footer) with no in-page navigation. Operators
// reported they "didn't know features were there" — leaderboard and
// achievements live well below the fold on mobile and don't show
// without deliberate scroll. This nav surfaces them as taps.
//
// Design:
//   - Sticky directly under the top app bar (top: 56 to clear the
//     existing nav). On mobile uses backdrop-blur so content scrolling
//     beneath it stays legible without a hard color seam.
//   - Horizontal scroll on overflow — never wraps. Tap targets
//     stay big (~34px tap height).
//   - Each chip = a section anchor on the page. Tap scrolls to it
//     with smooth-scroll + sets a brief :focus-visible-style highlight
//     so the user's eye lands on the right place.
//   - Conditional sections (FEEDBACK only for beta users) get skipped
//     via the `sections` prop — the caller controls the list.

import React from 'react';
import { useLanguage } from '@/lib/i18n';

export interface COCNavSection {
  id: string;
  /** i18n key for the label, e.g. 'coc.nav.readiness'. Fallback used when missing. */
  labelKey: string;
  /** Hex accent (matches the section's own header color so the chip ties to the destination). */
  accent: string;
}

interface COCSectionNavProps {
  sections: COCNavSection[];
}

export default function COCSectionNav({ sections }: COCSectionNavProps) {
  const { t } = useLanguage();

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // AppShell's scroll container is <main style="overflow: auto">,
    // NOT the window. window.scrollTo() no-ops in that case, which is
    // why the v1 implementation pulsed the destination but never
    // actually moved. scrollIntoView walks up to the nearest scrolling
    // ancestor regardless of whether that's window or a div, so it
    // works in both shapes. The destination div's scroll-margin-top
    // handles the offset for the sticky nav + top bar (set in
    // AppShell.tsx where each anchor div is rendered).
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Brief amber pulse so the user's eye lands. Cleared after 1.2s.
    el.classList.add('coc-section-flash');
    window.setTimeout(() => el.classList.remove('coc-section-flash'), 1200);
  };

  if (!sections || sections.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes coc-section-flash {
          0%   { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0); }
          30%  { box-shadow: 0 0 0 3px rgba(0, 255, 65, 0.45); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 65, 0); }
        }
        .coc-section-flash {
          animation: coc-section-flash 1.2s ease-out;
          border-radius: 4px;
        }
        .coc-nav-scroll::-webkit-scrollbar {
          height: 0;
        }
      `}</style>
      <div
        role="navigation"
        aria-label="Command Center sections"
        style={{
          position: 'sticky',
          // top is relative to the scrolling ancestor's viewport — and
          // that's <main>, not window. <main> already starts below the
          // app's top bar, so top: 0 here means "stick at the top of
          // the scroll viewport." Using a non-zero offset would leave
          // a dead band of content visible above the nav as the user
          // scrolls.
          top: 0,
          zIndex: 30,
          marginBottom: 16,
          marginLeft: -16,
          marginRight: -16,
          padding: '8px 16px',
          background: 'rgba(5, 10, 5, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0, 255, 65, 0.18)',
        }}
      >
        <div
          className="coc-nav-scroll"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: 2,
          }}
        >
          {sections.map((s) => {
            const label = t(s.labelKey) || s.labelKey.split('.').pop()?.toUpperCase() || s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  background: `${s.accent}14`,
                  border: `1px solid ${s.accent}55`,
                  color: s.accent,
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  borderRadius: 3,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${s.accent}28`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${s.accent}14`;
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
