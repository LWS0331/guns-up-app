'use client';

// WhatsNewModal — full-screen "What's New" overlay shown to operators
// on first login after a feature ships.
//
// STANDING SHIPPING ORDER: every feature add (not bug fix) gets one
// announcement entry in src/data/announcements.ts. AppShell fetches
// /api/announcements/current on mount and renders this modal when
// an unseen entry comes back.
//
// UX:
//   - Full-screen scrim (cannot accidentally tap-out)
//   - Tag chip → headline → body → optional bullet list → CTA
//   - CTA actions are routed via the onActionClick prop. AppShell
//     decides what to do with each action key (open picker, open
//     billing, etc.) so the modal stays presentation-only.
//   - Dismiss writes lastSeenAnnouncementId server-side BEFORE the
//     modal closes — so a network failure means the user sees it
//     again next session (which is the right failure mode; better
//     to show twice than miss entirely).

import React, { useState } from 'react';
import type { Announcement, AnnouncementAction } from '@/data/announcements';
import { getAuthToken } from '@/lib/authClient';

interface WhatsNewModalProps {
  announcement: Announcement;
  onClose: () => void;
  onActionClick?: (action: AnnouncementAction) => void;
}

export default function WhatsNewModal({
  announcement,
  onClose,
  onActionClick,
}: WhatsNewModalProps) {
  const [dismissing, setDismissing] = useState(false);
  const accent = announcement.accent || '#00ff41';

  const handleDismiss = async (afterDismiss?: () => void) => {
    if (dismissing) return;
    setDismissing(true);
    try {
      const token = getAuthToken();
      await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ announcementId: announcement.id }),
      });
    } catch (err) {
      // Silent failure — the modal still closes. If the server
      // didn't get the dismiss, the user just sees the same modal
      // on next session, which is acceptable.
      console.warn('[whats-new] dismiss failed:', err);
    }
    if (afterDismiss) afterDismiss();
    onClose();
  };

  const handleCta = () => {
    if (!announcement.cta) return;
    handleDismiss(() => {
      if (onActionClick && announcement.cta) {
        onActionClick(announcement.cta.action);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 540,
          width: '100%',
          padding: 36,
          background: '#0a0a0a',
          border: `2px solid ${accent}`,
          borderRadius: 6,
          boxShadow: `0 0 80px ${accent}33`,
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Bracket corners — matches landing page aesthetic */}
        <span style={{
          position: 'absolute', top: -1, left: -1, width: 14, height: 14,
          borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`,
        }} />
        <span style={{
          position: 'absolute', top: -1, right: -1, width: 14, height: 14,
          borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`,
        }} />
        <span style={{
          position: 'absolute', bottom: -1, left: -1, width: 14, height: 14,
          borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`,
        }} />
        <span style={{
          position: 'absolute', bottom: -1, right: -1, width: 14, height: 14,
          borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}`,
        }} />

        {/* Tag chip */}
        <div
          style={{
            display: 'inline-block',
            padding: '5px 14px',
            border: `1px solid ${accent}`,
            color: accent,
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            letterSpacing: 3,
            marginBottom: 22,
            borderRadius: 3,
            fontWeight: 700,
          }}
        >
          {announcement.tag}
        </div>

        {/* Title */}
        <h1
          id="whats-new-title"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 24,
            color: '#fff',
            letterSpacing: 1.5,
            margin: '0 0 14px',
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          {announcement.title}
        </h1>

        {/* Body */}
        <p
          style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 13,
            color: '#bbb',
            lineHeight: 1.65,
            margin: '0 0 20px',
          }}
        >
          {announcement.body}
        </p>

        {/* Optional bullet list */}
        {announcement.bullets && announcement.bullets.length > 0 && (
          <ul
            style={{
              textAlign: 'left',
              listStyle: 'none',
              padding: 0,
              margin: '0 0 26px',
              display: 'inline-block',
            }}
          >
            {announcement.bullets.map((b, i) => (
              <li
                key={i}
                style={{
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: 12,
                  color: '#aaa',
                  lineHeight: 1.6,
                  padding: '5px 0 5px 18px',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 5,
                    color: accent,
                    fontWeight: 800,
                  }}
                >
                  ▸
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}

        {/* Action row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 6,
          }}
        >
          {announcement.cta ? (
            <>
              <button
                type="button"
                onClick={handleCta}
                disabled={dismissing}
                style={{
                  padding: '12px 26px',
                  background: accent,
                  color: '#0a0a0a',
                  border: 'none',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 2,
                  cursor: dismissing ? 'wait' : 'pointer',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                }}
              >
                {announcement.cta.label}
              </button>
              <button
                type="button"
                onClick={() => handleDismiss()}
                disabled={dismissing}
                style={{
                  padding: '12px 18px',
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 11,
                  letterSpacing: 1.5,
                  cursor: dismissing ? 'wait' : 'pointer',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                }}
              >
                Maybe Later
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleDismiss()}
              disabled={dismissing}
              style={{
                padding: '12px 26px',
                background: accent,
                color: '#0a0a0a',
                border: 'none',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                cursor: dismissing ? 'wait' : 'pointer',
                textTransform: 'uppercase',
                borderRadius: 4,
              }}
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
