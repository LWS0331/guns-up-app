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
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
          background: '#0b0b0b',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#111',
          }}
        >
          <div
            style={{
              color: '#e7e7e7',
              fontFamily: 'monospace',
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: 10,
            }}
          >
            {title || 'EXERCISE DEMO'}
          </div>
          <button
            onClick={onClose}
            aria-label="Close video"
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '4px 10px',
              fontFamily: 'monospace',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            CLOSE ✕
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
          <div
            style={{
              padding: 28,
              color: '#e7e7e7',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <div style={{ marginBottom: 16, color: '#ffb547' }}>
              {source.kind === 'search'
                ? `No direct video on file. Search YouTube for "${source.searchQuery}".`
                : 'Video cannot be embedded in-app.'}
            </div>
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
              style={{
                display: 'inline-block',
                padding: '10px 18px',
                background: '#c9a227',
                color: '#111',
                borderRadius: 8,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textDecoration: 'none',
              }}
            >
              OPEN ON YOUTUBE ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
