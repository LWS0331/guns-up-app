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
    // Third-attempt fix for "chips flicker but don't scroll." The
    // previous attempts used window.scrollTo (wrong container) then
    // scrollIntoView (was no-op'ing inside <main>, likely because
    // gu-scalable applies CSS `zoom` and that confuses the browser's
    // scroll API for that container in some engines).
    //
    // This walks up the DOM to find the nearest ancestor with
    // overflow-y: auto|scroll AND actual overflowing content (some
    // wrappers have overflow:auto but aren't scrolling). Then scrolls
    // THAT container directly via scrollTo on a computed offset —
    // works regardless of what scroll API quirks exist.
    let parent: HTMLElement | null = el.parentElement;
    let scrollContainer: HTMLElement | null = null;
    while (parent && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const oy = style.overflowY;
      if (
        (oy === 'auto' || oy === 'scroll') &&
        parent.scrollHeight > parent.clientHeight
      ) {
        scrollContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // elRect.top is relative to viewport; containerRect.top tells us
      // where the scroll container's viewport starts. Their delta is
      // how far the element is from the container top in the current
      // scroll position. Add scrollTop to get the absolute target,
      // subtract 72 to clear the sticky nav.
      const target = elRect.top - containerRect.top + scrollContainer.scrollTop - 72;
      scrollContainer.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    } else {
      // Fallback: try scrollIntoView, then window.scrollTo
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        const y = el.getBoundingClientRect().top + window.pageYOffset - 72;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    // Brief green pulse so the user's eye lands. Cleared after 1.2s.
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
          // top: 0 — relative to the scrolling ancestor (<main>). The
          // app top bar isn't inside main, so main's viewport starts
          // right below it; top: 0 docks the nav directly under the
          // bar with no dead-band gap.
          top: 0,
          zIndex: 30,
          // Full bleed within <main>. The previous version used
          // marginLeft/Right: -16 to extend past a presumed parent
          // padding, but main has no horizontal padding — so the
          // negative margin pushed the nav 16px past the viewport
          // edges, which made it look "floating and not flowing."
          marginBottom: 16,
          padding: '8px 14px',
          // Near-opaque background so the operator banner pixels
          // behind don't bleed through and make the chips hard to
          // read while sticky. Backdrop blur still helps when content
          // scrolls under it.
          background: '#0a0f0a',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0, 255, 65, 0.25)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
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
