// /design-system — living style guide for the GUNS UP design language.
//
// Every utility class shipped in src/styles/design-system.css gets shown
// here with its expected JSX usage. Engineers refactoring a screen and
// designers reviewing tokens both hit this page first instead of guessing
// from the README.
//
// This page intentionally stays a server component (no 'use client') —
// it's static content. If a section needs interactivity later (e.g. live
// token tweaking), wrap that one section in a client island, not the
// whole page. Keeps the render cheap and the route prerendered.
//
// Sourced from design_handoff_app_redesign/README.md + app-system.css.
// When the design system grows, add the new utility class here in the
// same shape: a Section header + a label/example pair so it's both
// browseable and copy-pasteable.

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'Living style guide for GUNS UP utility classes and design tokens.',
  // No-index — this is internal tooling, not for search engines.
  robots: { index: false, follow: false },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 16,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--border-green-soft)',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </code>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 className="t-display-l" style={{ marginBottom: 14, color: 'var(--green)' }}>
        {title}
      </h2>
      <div className="ds-card bracket elevated">
        <span className="bl" />
        <span className="br" />
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 18px 64px',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div className="screen-head" style={{ marginBottom: 28 }}>
        <div className="crumb">
          <b>//</b> Internal &nbsp;<span style={{ color: 'var(--text-dim)' }}>/</span>&nbsp; Design System
        </div>
        <h1>
          GUNS UP <em>Style Guide</em>
        </h1>
        <div className="sub">
          Tokens + utility classes ported from the App Redesign handoff. Reference, don&apos;t reinvent.
        </div>
      </div>

      <p className="t-body-sm" style={{ marginBottom: 28 }}>
        Every utility class in <code className="t-mono-sm">src/styles/design-system.css</code> is
        demonstrated below. To use any of these in a screen, just apply the className —
        no module imports needed. See the file header for usage rules and the README in
        the handoff bundle for the full design rationale.
      </p>

      {/* Type scale */}
      <Section title="Type scale">
        <Row label=".t-display-xl">
          <div className="t-display-xl">Display XL</div>
        </Row>
        <Row label=".t-display-l">
          <div className="t-display-l">Display L</div>
        </Row>
        <Row label=".t-display-m">
          <div className="t-display-m">Display M</div>
        </Row>
        <Row label=".t-eyebrow">
          <span className="t-eyebrow">Section eyebrow</span>
        </Row>
        <Row label=".t-eyebrow.amber">
          <span className="t-eyebrow amber">Amber variant</span>
        </Row>
        <Row label=".t-label">
          <span className="t-label">Form label</span>
        </Row>
        <Row label=".t-body">
          <p className="t-body">
            Body copy. 14px Chakra Petch, 1.55 line-height. Use this for the bulk of paragraph text.
          </p>
        </Row>
        <Row label=".t-body-sm">
          <p className="t-body-sm">
            Smaller body. Secondary copy default color, 13px / 1.5.
          </p>
        </Row>
        <Row label=".t-mono-sm">
          <span className="t-mono-sm">11px mono · timestamps · metadata</span>
        </Row>
        <Row label=".t-mono-data">
          <span className="t-mono-data">13:42:08 · 2026-04-24 · 225×8</span>
        </Row>
        <Row label=".t-num-display">
          <span className="t-num-display">42</span>
        </Row>
        <Row label=".t-num-large">
          <span className="t-num-large">1,247</span>
        </Row>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <Row label=".btn.btn-primary">
          <button className="btn btn-primary">Primary</button>
        </Row>
        <Row label=".btn.btn-secondary">
          <button className="btn btn-secondary">Secondary</button>
        </Row>
        <Row label=".btn.btn-ghost">
          <button className="btn btn-ghost">Ghost</button>
        </Row>
        <Row label=".btn.btn-amber">
          <button className="btn btn-amber">Amber</button>
        </Row>
        <Row label=".btn.btn-danger">
          <button className="btn btn-danger">Danger</button>
        </Row>
        <Row label=".btn.btn-danger-outline">
          <button className="btn btn-danger-outline">Danger Outline</button>
        </Row>
        <Row label="+ .btn-sm">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm">Small Primary</button>
            <button className="btn btn-amber btn-sm">Small Amber</button>
            <button className="btn btn-ghost btn-sm">Small Ghost</button>
          </div>
        </Row>
        <Row label="+ .btn-block">
          <button className="btn btn-primary btn-block">Block (full-width)</button>
        </Row>
        <Row label="disabled">
          <button className="btn btn-primary" disabled>
            Disabled
          </button>
        </Row>
      </Section>

      {/* Cards / brackets */}
      <Section title="Cards + brackets">
        <Row label=".ds-card">
          <div className="ds-card">Default card · soft green border, no brackets.</div>
        </Row>
        <Row label="+ .bracket">
          <div className="ds-card bracket">
            <span className="bl" />
            <span className="br" />
            With corner brackets · don&apos;t forget the .bl + .br helper spans.
          </div>
        </Row>
        <Row label="+ .elevated">
          <div className="ds-card bracket elevated">
            <span className="bl" />
            <span className="br" />
            Elevated card · subtle green wash and stronger border.
          </div>
        </Row>
        <Row label="+ .amber-tone">
          <div className="ds-card bracket amber amber-tone">
            <span className="bl" />
            <span className="br" />
            <span className="t-eyebrow amber">// Daily Brief</span>
            <p className="t-body-sm" style={{ marginTop: 6 }}>
              Use amber-tone for warm/in-progress callouts (warmups, daily briefs, warnings).
            </p>
          </div>
        </Row>
        <Row label="+ .danger-tone">
          <div className="ds-card bracket danger danger-tone">
            <span className="bl" />
            <span className="br" />
            <span className="t-eyebrow danger">// Active Injury</span>
            <p className="t-body-sm" style={{ marginTop: 6 }}>
              Danger-tone is reserved for injuries, errors, and destructive confirmations.
            </p>
          </div>
        </Row>
      </Section>

      {/* Chips */}
      <Section title="Chips">
        <Row label=".chip">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="chip">Default</span>
            <span className="chip green">Green</span>
            <span className="chip amber">Amber</span>
            <span className="chip danger">Danger</span>
          </div>
        </Row>
        <Row label="with .chip-x">
          <span className="chip green">
            barbell <span className="chip-x">×</span>
          </span>
        </Row>
      </Section>

      {/* Segmented + subtabs */}
      <Section title="Segmented control + subtabs">
        <Row label=".segmented">
          <div className="segmented">
            <button className="seg">Month</button>
            <button className="seg">Week</button>
            <button className="seg active">Day</button>
            <button className="seg" style={{ borderColor: 'var(--border-green-strong)', color: 'var(--green)' }}>
              Today
            </button>
          </div>
        </Row>
        <Row label=".subtabs">
          <div className="subtabs" style={{ borderBottomColor: 'transparent' }}>
            <button>Profile</button>
            <button className="active">Nutrition</button>
            <button>PR Board</button>
            <button>Analytics</button>
            <button>Injuries</button>
          </div>
        </Row>
      </Section>

      {/* Chrome — TopBar + TabBar + GunnyFab demos. These are the
          full-width app chrome elements used by AppShell. Showing them
          here as scoped previews (not full-viewport) so they sit inline
          with the rest of the style guide. */}
      <Section title="App chrome — TopBar / TabBar / GunnyFab">
        <Row label=".ds-topbar">
          <div className="ds-topbar" style={{ position: 'static' }}>
            <div className="ds-topbar-brand">
              <span
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-block',
                  background: 'radial-gradient(circle, rgba(0,255,65,0.6), rgba(0,255,65,0.05) 70%)',
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 0 4px rgba(0,255,65,0.5))',
                }}
              />
              <div className="stack">
                <span className="t1">GUNS UP</span>
                <span className="t2">RAMPAGE</span>
              </div>
            </div>
            <button className="ds-topbar-callsign">
              <span className="dot" />
              RAMPAGE
            </button>
          </div>
        </Row>

        <Row label=".ds-tabbar">
          <div
            className="ds-tabbar"
            style={{
              position: 'static',
              padding: '8px 0 6px',
              borderTop: '1px solid var(--border-green)',
              borderBottom: '1px solid var(--border-green-soft)',
            }}
          >
            <button className="active">
              <span style={{ fontSize: 22 }}>◆</span>
              <span className="lbl">COC</span>
            </button>
            <button>
              <span style={{ fontSize: 22 }}>▦</span>
              <span className="lbl">Planner</span>
            </button>
            <button className="gunny-tab">
              <span className="gunny-icon-wrap">
                <span
                  className="gunny-icon"
                  style={{
                    background: 'radial-gradient(circle, rgba(0,255,65,0.9), rgba(0,255,65,0.1))',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'inline-block',
                  }}
                />
              </span>
              <span className="lbl">Gunny</span>
            </button>
            <button>
              <span style={{ fontSize: 22 }}>◈</span>
              <span className="lbl">Intel</span>
            </button>
            <button>
              <span style={{ fontSize: 22 }}>⬡</span>
              <span className="lbl">Ops</span>
            </button>
          </div>
        </Row>

        <Row label=".ds-gunny-fab">
          <div
            style={{
              position: 'relative',
              padding: '20px 14px',
              border: '1px dashed var(--border-green-soft)',
              minHeight: 80,
            }}
          >
            <button className="ds-gunny-fab show" style={{ position: 'static' }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              GUNNY
            </button>
          </div>
        </Row>
      </Section>

      {/* Form */}
      <Section title="Form fields">
        <div className="field-row" style={{ marginBottom: 4 }}>
          <div className="field">
            <label htmlFor="ds-name">Callsign</label>
            <input id="ds-name" className="ds-input" type="text" placeholder="RAMPAGE-07" />
          </div>
          <div className="field">
            <label htmlFor="ds-email">Comms</label>
            <input id="ds-email" className="ds-input" type="email" placeholder="you@email.com" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ds-msg">Message</label>
          <textarea id="ds-msg" className="ds-textarea" placeholder="Drop a signal…" />
        </div>
        <div className="field">
          <label htmlFor="ds-sel">Subject</label>
          <select id="ds-sel" className="ds-select" defaultValue="brief">
            <option value="brief">Request a brief</option>
            <option value="trainer">Trainer · revenue share</option>
            <option value="beta">Beta · early access</option>
          </select>
        </div>
      </Section>

      {/* Progress bars */}
      <Section title="Progress bars">
        <Row label=".bar (default)">
          <div className="bar">
            <span style={{ width: '64%' }} />
          </div>
        </Row>
        <Row label=".bar.amber">
          <div className="bar amber">
            <span style={{ width: '38%' }} />
          </div>
        </Row>
        <Row label=".bar.danger">
          <div className="bar danger">
            <span style={{ width: '12%' }} />
          </div>
        </Row>
      </Section>

      {/* Status pills */}
      <Section title="Status pills">
        <Row label=".status-pill.ok">
          <span className="status-pill ok">Active</span>
        </Row>
        <Row label=".status-pill.danger">
          <span className="status-pill danger">Injury</span>
        </Row>
        <Row label=".status-pill.ghost">
          <span className="status-pill ghost">Inactive</span>
        </Row>
      </Section>

      {/* Color tokens */}
      <Section title="Color tokens">
        {[
          { name: '--green', hex: '#00ff41' },
          { name: '--green-bright', hex: '#00e639' },
          { name: '--amber', hex: '#ff8c00' },
          { name: '--warn', hex: '#ffb800' },
          { name: '--danger', hex: '#ff4444' },
          { name: '--bg-base', hex: '#030303' },
          { name: '--bg-card', hex: '#0a0a0a' },
          { name: '--text-bright', hex: '#ffffff' },
          { name: '--text-primary', hex: '#e0e0e0' },
          { name: '--text-secondary', hex: '#a0a0a0' },
          { name: '--text-tertiary', hex: '#707070' },
          { name: '--text-dim', hex: '#4a4a4a' },
        ].map((tok) => (
          <Row key={tok.name} label={tok.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid var(--border-green-soft)',
                  background: `var(${tok.name})`,
                }}
              />
              <span className="t-mono-sm">{tok.hex}</span>
            </div>
          </Row>
        ))}
      </Section>

      <p className="t-mono-sm" style={{ marginTop: 32, color: 'var(--text-dim)' }}>
        Source: <code>src/styles/design-system.css</code>. To extend, add the token or class
        there first, then drop a demo Row into this page.
      </p>
      <p className="t-mono-sm" style={{ marginTop: 8 }}>
        <Link href="/" style={{ color: 'var(--green)' }}>
          ← Back to landing
        </Link>
      </p>
    </main>
  );
}
