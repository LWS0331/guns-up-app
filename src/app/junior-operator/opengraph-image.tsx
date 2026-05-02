// Dynamic OG image for /junior-operator. Next.js generates a 1200x630
// PNG at request time using next/og's ImageResponse — no static asset
// to keep in sync with copy. Crawlers (Twitter, Slack, Discord, IG, FB)
// hit /junior-operator/opengraph-image automatically because the file
// is named per the App Router convention.
//
// Why dynamic: the headline + stats may rotate as the wave-01 framing
// matures (e.g. "Wave 02" copy when wave 01 closes). Re-running a
// design tool every time is friction; this regenerates from JSX on
// every cache miss.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'Junior Operator — Sport-specific training for ages 10-18 | Gunny AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#030303',
          color: '#e0e0e0',
          padding: 64,
          // Subtle terminal grid texture matching the live page.
          backgroundImage:
            'linear-gradient(rgba(0,255,65,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: '#00ff41',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          <div style={{ width: 30, height: 2, background: '#00ff41', boxShadow: '0 0 8px #00ff41' }} />
          // Junior Operator · Ages 10–18
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 108,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: -2,
            lineHeight: 1,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          <div style={{ display: 'flex' }}>
            <span>TRAIN&nbsp;</span>
            <span style={{ color: '#00ff41' }}>BIOLOGICAL</span>
          </div>
          <div>AGE.</div>
        </div>

        {/* Sub */}
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#a0a0a0',
            lineHeight: 1.4,
            maxWidth: 980,
            marginBottom: 'auto',
          }}
        >
          Sport-specific training protocol for young athletes. Biological-age
          caps. FIFA 11+ warm-up. Coach-built.
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: 'flex',
            gap: 1,
            background: 'rgba(0,255,65,0.18)',
            border: '1px solid rgba(0,255,65,0.18)',
            marginBottom: 24,
          }}
        >
          {[
            { num: '↓48%', lbl: 'OVERALL INJURIES' },
            { num: '↓74%', lbl: 'SEVERE INJURIES' },
            { num: '≤AGE', lbl: 'WEEKLY HOURS CAP' },
          ].map((s) => (
            <div
              key={s.lbl}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: '#030303',
                padding: '20px 28px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: '#00ff41',
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: '#707070',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {s.lbl}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom — brand + URL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 18,
            borderTop: '1px solid rgba(0,255,65,0.18)',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: 2,
            }}
          >
            GUNNY AI
            <span style={{ color: '#707070', fontWeight: 400, marginLeft: 12 }}>
              · GUNS UP FITNESS
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              color: '#00ff41',
              letterSpacing: 1,
            }}
          >
            gunnyai.fit/junior-operator
          </div>
        </div>
      </div>
    ),
    size,
  );
}
