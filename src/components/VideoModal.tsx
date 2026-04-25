'use client';

import React, { useEffect } from 'react';
import { convertToEmbedUrl } from '@/lib/videoUrl';

interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

/**
 * In-app video player modal.
 * - Embeds YouTube videos via iframe (no redirect).
 * - Falls back to "Open in YouTube" button for search URLs / unembeddable links.
 * - Locks body scroll while open, closes on ESC.
 * - Respects mobile safe-areas and allows fullscreen.
 */
export default function VideoModal({ open, onClose, url, title }: VideoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const source = convertToEmbedUrl(url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Exercise demo video'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
      }}
    >
      {/* Modal panel — uses .ds-card.bracket for the canonical
          tactical surface treatment. The 14px radius here is the
          one explicit handoff exception (rare 14px radius for
          interactive surfaces, matching .ds-gunny-fab). */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="ds-card bracket elevated"
        style={{
          width: '100%',
          maxWidth: 960,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <span className="bl" />
        <span className="br" />

        <div
          className="row-between"
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-green-soft)',
            background: 'var(--bg-elevated)',
          }}
        >
          <div
            className="t-eyebrow"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: 10,
            }}
          >
            {title || 'Exercise Demo'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="btn btn-ghost btn-sm"
            style={{ minHeight: 32, padding: '4px 10px' }}
          >
            Close ✕
          </button>
        </div>

        {source.kind === 'youtube' && source.embedUrl ? (
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
            <iframe
              src={source.embedUrl}
              title={title || 'Exercise demo'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
            />
          </div>
        ) : (
          // Fallback panel — search query / unembeddable link. Uses
          // amber tone since this is a "heads up, partial result"
          // signal rather than a hard error.
          <div
            style={{
              padding: 28,
              textAlign: 'center',
            }}
          >
            <p className="t-body-sm" style={{ color: 'var(--amber)', marginBottom: 16 }}>
              {source.kind === 'search'
                ? `No direct video on file. Search YouTube for "${source.searchQuery}".`
                : 'Video cannot be embedded in-app.'}
            </p>
            <a
              href={
                source.kind === 'search'
                  ? source.originalUrl
                  : source.kind === 'unknown'
                  ? source.originalUrl
                  : url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-amber"
              style={{ display: 'inline-flex' }}
            >
              Open on YouTube ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
