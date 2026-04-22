'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders Gunny's markdown output (headings, bold, lists, tables, code).
// Accent defaults to the main-chat green. The side panel passes '#ffb800' (gold)
// to match its own brand palette.
type AccentPalette = {
  accent: string;
  accentBorder: string;
  accentBorderFaint: string;
  accentBg: string;
  accentShadow: string;
};

const paletteFor = (accent: string): AccentPalette => {
  if (accent === '#ffb800') {
    return {
      accent,
      accentBorder: 'rgba(255,184,0,0.3)',
      accentBorderFaint: 'rgba(255,184,0,0.08)',
      accentBg: 'rgba(255,184,0,0.06)',
      accentShadow: 'rgba(255,184,0,0.3)',
    };
  }
  return {
    accent,
    accentBorder: 'rgba(0,255,65,0.3)',
    accentBorderFaint: 'rgba(0,255,65,0.08)',
    accentBg: 'rgba(0,255,65,0.06)',
    accentShadow: 'rgba(0,255,65,0.3)',
  };
};

export const GunnyMarkdown: React.FC<{ text: string; accent?: string }> = ({ text, accent = '#00ff41' }) => {
  const p = paletteFor(accent);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <div style={{
            fontFamily: '"Orbitron", sans-serif', fontSize: '16px', fontWeight: 800,
            color: p.accent, letterSpacing: '2px', marginTop: '14px', marginBottom: '6px',
            textShadow: `0 0 6px ${p.accentShadow}`,
          }}>{children}</div>
        ),
        h2: ({ children }) => (
          <div style={{
            fontFamily: '"Orbitron", sans-serif', fontSize: '14px', fontWeight: 700,
            color: p.accent, letterSpacing: '1.5px', marginTop: '12px', marginBottom: '4px',
          }}>{children}</div>
        ),
        h3: ({ children }) => (
          <div style={{
            fontFamily: '"Share Tech Mono", monospace', fontSize: '13px', fontWeight: 700,
            color: '#facc15', letterSpacing: '1px', marginTop: '10px', marginBottom: '4px',
          }}>{children}</div>
        ),
        p: ({ children }) => (
          <p style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ color: '#facc15', fontWeight: 700 }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ color: '#9ca3af', fontStyle: 'italic' }}>{children}</em>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '10px 0' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontFamily: '"Share Tech Mono", monospace', fontSize: '13px',
              border: `1px solid ${p.accentBorder}`,
            }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead style={{ background: p.accentBg }}>{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th style={{
            padding: '6px 10px', textAlign: 'left',
            borderBottom: `1px solid ${p.accentBorder}`,
            color: p.accent, fontWeight: 700, letterSpacing: '1px',
          }}>{children}</th>
        ),
        td: ({ children }) => (
          <td style={{
            padding: '5px 10px', borderBottom: `1px solid ${p.accentBorderFaint}`,
            color: '#ccc',
          }}>{children}</td>
        ),
        code: ({ children }) => (
          <code style={{
            background: p.accentBg, color: '#facc15',
            padding: '1px 5px', fontFamily: '"Share Tech Mono", monospace',
            fontSize: '13px', borderRadius: 2,
          }}>{children}</code>
        ),
        hr: () => (
          <div style={{
            height: '1px', margin: '10px 0',
            background: `linear-gradient(90deg, transparent, ${p.accentBorder}, transparent)`,
          }} />
        ),
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: '2px solid #facc15', paddingLeft: '10px',
            margin: '8px 0', color: '#bbb', fontStyle: 'italic',
          }}>{children}</blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
};
