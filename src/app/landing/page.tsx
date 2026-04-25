'use client';

// GUNS UP landing page — production port of the design-handoff prototype
// (gun-up-gunny-ai-website/project/Landing Page.html). Single-page marketing
// site: hero + HUD, ticker, four-pillar overview, Gunny demo, feature grid,
// tier pricing, trainer revenue calculator, founder section, FAQ, CTA, footer.
//
// Scope:
// - Client component because the revenue slider uses useState. Everything else
//   is static markup; fonts and CSS vars come from the module-scoped stylesheet
//   (landing.module.css) plus the global Google Fonts import already in
//   src/app/layout.tsx.
// - The design-time "tweaks" panel + parent postMessage edit-mode from the
//   prototype are intentionally NOT ported — they're only useful inside the
//   Claude Design viewer and would ship dead code.
// - CTAs point at "/" (the app's existing login screen) until a dedicated
//   /signup flow exists.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';
import FounderRotator, { RUBEN_SLIDES, BRITNEY_SLIDES } from './FounderRotator';
import { trackEvent } from '@/lib/analytics';

// Per-client monthly commission for Commander tier. Hard-coded in the design;
// if tier pricing moves, update lib/types.ts::TIER_CONFIGS and mirror here.
const COMMANDER_PER_CLIENT = 5.25;

// Wrapper for landing-CTA analytics. We always emit the same event name with
// a `cta` discriminator so the dashboards can group + filter without us
// having to register a separate event per button. Wrapped in try/catch
// because PostHog isn't init'd until /lib/analytics::initAnalytics has run
// at the app root, and a logged-out user hitting a static landing page
// may race that.
function trackLandingCta(cta: string, extra?: Record<string, unknown>) {
  try {
    trackEvent('landing_cta_click', { cta, ...(extra || {}) });
  } catch { /* analytics is best-effort; don't block navigation */ }
}

export default function LandingPage() {
  const [clients, setClients] = useState(50);
  const mrr = useMemo(() => (clients * COMMANDER_PER_CLIENT).toFixed(2), [clients]);

  return (
    <div className={styles.root}>
      {/* Full-screen CRT scanline + vignette overlays.
          Kept inside the landing page (not global) so the rest of the app
          isn't tinted when we add more non-landing routes later. */}
      <div className={styles.scanlines} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      {/* ========== NAV ========== */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <Image
              src="/logo-glow.png"
              alt="GUNS UP"
              width={22}
              height={22}
              className={styles.logoMark}
              priority
            />
            <span>GUNS UP</span>
          </div>
          <div className={styles.navStatus}>
            <span className="dot" />
            <span>SYS ONLINE · v4.2</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#arsenal">Arsenal</a>
            <a href="#gunny">Gunny AI</a>
            <a href="#tiers">Tiers</a>
            <a href="#trainers">Trainers</a>
            <a href="#founder">Founders</a>
            {/* MEMBER LOGIN — distinct from the primary "Deploy" CTA. Members
                returning to the site click here; the Deploy CTA is for new
                signups (currently routes to the same /login page until a
                separate /signup flow exists, but kept visually distinct so
                the pattern is in place when it does). */}
            <Link href="/login" className={styles.navLoginLink}>Member Login</Link>
          </div>
          <Link className={styles.navCta} href="/login">Deploy →</Link>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className={`${styles.hero} ${styles.gridBg}`}>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.heroMeta}>
              <span><b>//</b> CLASSIFIED · OPERATOR BRIEF 001</span>
              <span><b>//</b> v4.2 — APR 2026</span>
              <span><b>//</b> 200+ TRAINERS DEPLOYED</span>
            </div>

            <h1>
              <span>DISCIPLINE</span><br />
              <span className={styles.heroSlash}>/</span> <span>DEPLOYED.</span>
            </h1>

            <p className={styles.heroLede}>
              Military-precision fitness. AI-powered training. Your personal operator —
              {' '}<b>Gunny</b> — knows every rep, every meal, every PR, every injury.
              {' '}<b>No generic fitness chatbot.</b> A trained AI built from USMC discipline and 16 expert sources.
            </p>

            <div className={styles.heroCtas}>
              <Link
                className={`${styles.btn} ${styles.btnPrimary}`}
                href="/login"
                onClick={() => trackLandingCta('hero_deploy')}
              >
                DEPLOY OPERATOR <span className={styles.arrow}>→</span>
              </Link>
              {/* "REQUEST BRIEF" used to scroll to #gunny — moved to /contact
                  with subject pre-filled so visitors who want a real
                  conversation actually start one. */}
              <Link
                className={`${styles.btn} ${styles.btnSecondary}`}
                href="/contact?subject=brief"
                onClick={() => trackLandingCta('hero_brief')}
              >
                REQUEST BRIEF
              </Link>
            </div>

            <div className={`${styles.heroCreds} ${styles.bracket}`}>
              <span className="bl" /><span className="br" />
              <div>
                <div className={styles.credNum}>16</div>
                <div className={styles.credLbl}>Expert sources</div>
              </div>
              <div>
                <div className={styles.credNum}>24/7</div>
                <div className={styles.credLbl}>AI coverage</div>
              </div>
              <div>
                <div className={styles.credNum}>
                  8<span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>lbs</span>
                </div>
                <div className={styles.credLbl}>Avg lean gain · 12wk</div>
              </div>
            </div>
          </div>

          {/* Tactical HUD */}
          <div className={`${styles.hud} ${styles.bracket}`}>
            <span className="bl" /><span className="br" />
            <div className={styles.hudHead}>
              <span>OPERATOR PROFILE // RAMPAGE-07</span>
              <span className="live">LIVE</span>
            </div>
            <div className={styles.hudRow}><span className="k">Callsign</span><span className="v">RAMPAGE</span></div>
            <div className={styles.hudRow}><span className="k">Role</span><span className="v">Operator · Tier COMMANDER</span></div>
            <div className={styles.hudRow}><span className="k">Readiness</span><span className="v green">94% · HIGH</span></div>
            <div className={styles.hudRow}><span className="k">Streak</span><span className="v green">14 days</span></div>
            <div className={styles.hudRow}><span className="k">Injury Flag</span><span className="v amber">R. shoulder — no OHP</span></div>

            <div className={styles.hudSectionTitle}>Today&apos;s Directive</div>
            <div className={styles.hudRow}><span className="k">Split</span><span className="v">Upper A · Push focus</span></div>
            <div className={styles.hudRow}><span className="k">Target</span><span className="v green">Bench 230 × 4</span></div>
            <div className={styles.hudRow}><span className="k">Sub</span><span className="v">Landmine press / OHP</span></div>
            <div className={styles.hudRow}><span className="k">Macros</span><span className="v">2,840 / 220P / 290C / 75F</span></div>

            <div className={styles.hudChat}>
              <div className="from">GUNNY // INBOUND</div>
              <div className="msg">
                Morning, RAMPAGE. Last session you hit <b>225 × 5</b>. Plan calls for push today — let&apos;s take <b>230 × 4</b>. Landmine press in for OHP (shoulder). You&apos;re on a <b>6-day streak</b>. Don&apos;t break it.
                <span className={styles.caret} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SITREP TICKER ========== */}
      <div className={styles.sitrepStrip}>
        <div className={styles.ticker}>
          {/* Content repeated twice for seamless infinite scroll — the
              keyframe shifts by -50%, so the second copy slides into place
              as the first leaves. */}
          {Array.from({ length: 2 }).map((_, copy) => (
            <div key={copy} style={{ display: 'contents' }}>
              <span><b>[SITREP]</b> 12,482 workouts logged this week</span><span className="tickerDot">·</span>
              <span><b>[PR]</b> Deadlift 405 × 3 — OP. GHOST-11</span><span className="tickerDot">·</span>
              <span><b>[COMPLIANCE]</b> 87% protocol adherence · 30-day</span><span className="tickerDot">·</span>
              <span><b>[NUTRITION]</b> 4,918 meals logged · 24hr</span><span className="tickerDot">·</span>
              <span><b>[FIELD]</b> 16 expert sources · cited on every response</span><span className="tickerDot">·</span>
              <span><b>[GUNNY]</b> Avg response 1.4s · Claude Sonnet</span><span className="tickerDot">·</span>
              <span><b>[TRAINERS]</b> 218 active · 40% commission tier</span><span className="tickerDot">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========== PILLARS ========== */}
      <section id="arsenal" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>01 · Command Stack</span>
          <h2>Four modules.<br />One <em>operator</em> system.</h2>
          <p>Gunny AI doesn&apos;t stand alone. It operates on top of a complete tactical command center — intake, battle plan, planner, nutrition. Every module feeds the next.</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.pillars}>
            {[
              { num: '01', name: 'Gunny AI', sub: 'Your personal operator', desc: 'Claude Sonnet / Opus deployed with your full profile as context. Knows your SITREP, PRs, injuries, last 7 workouts, last 3 days of meals. Never generic.', left: '24/7 uptime', right: '1.4s avg reply' },
              { num: '02', name: 'Planner', sub: 'Daily Brief · adaptive workouts', desc: "Today's workout, scheduled per your battle plan. Injury-aware substitutions. RPE progression. PRs auto-detected. Voice-logged via push-to-talk.", left: 'Voice logging', right: 'Auto PR detect' },
              { num: '03', name: 'Nutrition', sub: 'Macros · meals · hydration', desc: "Macro targets pulled from SITREP. Meal log, hydration, supplements. Gunny compares today's intake to target in real time. Adjusts on the fly.", left: '4 macros', right: 'Sub tracking' },
              { num: '04', name: 'Intel Center', sub: 'Progress · analytics · charts', desc: 'Strength progression, compliance scores, HR zone gauges, streaks, leaderboards. Every PR, every meal, every day tag — auditable by you or your trainer.', left: '12 charts', right: 'COC access' },
            ].map((p) => {
              // Split each stat like "24/7 uptime" into number + label so Gunny's
              // accent color hits just the number, not the whole line.
              const splitStat = (s: string) => {
                const idx = s.indexOf(' ');
                return idx === -1 ? { num: s, rest: '' } : { num: s.slice(0, idx), rest: s.slice(idx) };
              };
              const l = splitStat(p.left);
              const r = splitStat(p.right);
              return (
                <article key={p.num} className={`${styles.pillar} ${styles.bracket}`}>
                  <span className="bl" /><span className="br" />
                  <div className={styles.pillarNum}>// {p.num}</div>
                  <div className={styles.pillarName}>{p.name}</div>
                  <div className={styles.pillarSub}>{p.sub}</div>
                  <p className={styles.pillarDesc}>{p.desc}</p>
                  <div className={styles.pillarStats}>
                    <span><b>{l.num}</b>{l.rest}</span>
                    <span><b>{r.num}</b>{r.rest}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== GUNNY DEMO ========== */}
      <section
        id="gunny"
        className={styles.section}
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,255,65,0.015), transparent)' }}
      >
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>02 · Gunny AI</span>
          <h2>Not a chatbot.<br />A <em>trained</em> operator.</h2>
          <p>Every message Gunny sends pulls from your complete operator context. Battle plan, workout history, meal log, PRs, injuries, milestones — all in the system prompt. Every response is yours, specific, earned.</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.gunnyDemo}>
            <div className={styles.gunnySide}>
              <h3>Context Gunny sees every message:</h3>
              <p>When you ask Gunny anything, the API route injects a structured context block built from your live Postgres data. This is a redacted view.</p>

              <div className={styles.gunnyContext}>
                <div className={styles.ctxTitle}>// OPERATOR_CONTEXT_BLOCK</div>
                <div className={styles.ctxGrid}>
                  {[
                    { k: 'Callsign', v: 'RAMPAGE' },
                    { k: 'Age / Wt', v: '34 · 192lb' },
                    { k: 'Split', v: 'UL 4-day' },
                    { k: 'SITREP', v: 'Active', tone: 'green' as const },
                    { k: 'Streak', v: '14 days', tone: 'green' as const },
                    { k: 'Last 7 wkts', v: 'Loaded' },
                    { k: 'Meals · 72h', v: '18 logged' },
                    { k: 'PRs', v: '12 total' },
                    { k: 'Injury', v: 'R. shoulder', tone: 'amber' as const },
                    { k: 'Macro hit', v: '88% / tgt' },
                    { k: 'Milestones', v: '2 / 5' },
                    { k: 'Trainer', v: 'Assigned' },
                  ].map((c) => (
                    <div key={c.k} className={styles.ctxItem}>
                      <div className="k">{c.k}</div>
                      <div className={`v ${c.tone || ''}`}>{c.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.label} style={{ marginTop: 20, marginBottom: 10 }}>
                // WHAT THIS UNLOCKS
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                &quot;What should I squat today?&quot; → Gunny references your PR, your progression, your restrictions. No guessing. No &quot;start with a weight you can handle.&quot;
              </p>
            </div>

            <div className={`${styles.chatWin} ${styles.bracket}`}>
              <span className="bl" /><span className="br" />
              <div className={styles.chatHead}>
                <span className="title">GUNNY // SIDE PANEL</span>
                <span>CLAUDE SONNET · 1.4s</span>
              </div>
              <div className={styles.chatBody}>
                <div className={`${styles.chatMsg} ${styles.chatMsgUser}`}>
                  Shoulder&apos;s still bugging me. Build me a push session for today.
                </div>
                <div className={`${styles.chatMsg} ${styles.chatMsgGunny}`}>
                  Read you. Pulling your <span className={styles.inlineRef}>SITREP</span> · <span className={styles.inlineRef}>injuries[]</span> · <span className={styles.inlineRef}>workouts[-7]</span>.<br /><br />
                  Last push was <b>Mon · 04/20</b> — bench <b>225 × 5</b>, incline DB <b>70 × 8</b>, tri rope <b>50 × 12</b>. Plan calls for progressive overload, so:
                  <br /><br />
                  <b>DIRECTIVE · PUSH A (45 min)</b><br />
                  A1. Landmine Press — 4 × 6 @ RPE 7 <span className={styles.inlineRef}>OHP sub</span><br />
                  A2. Incline DB Press — 4 × 8 @ 72.5lb<br />
                  B1. Flat DB Fly — 3 × 12 @ RPE 6 <span className={styles.inlineRef}>avoid end-range</span><br />
                  B2. Cable Tri Rope — 3 × 12 @ 52.5lb <span className={styles.inlineRef}>+2.5</span><br />
                  C. Lateral Raises — 2 × 15 light · pain-free only
                </div>
                <div className={`${styles.chatMsg} ${styles.chatMsgUser}`}>Macros?</div>
                <div className={`${styles.chatMsg} ${styles.chatMsgGunny}`}>
                  Target <b>2,840 cal / 220P / 290C / 75F</b>. You&apos;re at <b>1,620 cal · 142P</b> through lunch. Need <b>78g protein</b> + ~1,220 cal. 8oz sirloin + 1.5c jasmine rice + greens hits it clean. You&apos;re at 88% compliance this week — don&apos;t slip.
                  <span className={styles.caret} />
                </div>
              </div>
              <div className={styles.chatFoot}>
                <span className="prompt">» type message · or hold space to talk</span>
                <span>EN · SONNET</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== ARSENAL / FEATURE GRID ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>03 · Arsenal</span>
          <h2>Every module. <em>Field-tested.</em></h2>
          <p>The full load-out. Built for operators who&apos;ve tried the apps that don&apos;t work. Every feature earned its place.</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.featureGrid}>
            {[
              { code: 'F-01', title: 'Intake Assessment', desc: '48K lines of intake logic. One pass, then Gunny has everything — goals, equipment, fitness level, injuries, sleep, stress, diet, wearables.', wide: false },
              { code: 'F-02', title: 'SITREP / Battle Plan', desc: 'Your approved training program — split, progression strategy, deload protocol, nutrition plan, 30-day milestones. Referenced on every Gunny decision.', wide: false },
              { code: 'F-03', title: 'Daily Brief', desc: "Today's adaptive workout + compliance score + Gunny's note. Adjusts to readiness, injury status, yesterday's load. No blind program-following.", wide: false },
              { code: 'F-04', title: 'Voice Push-to-Talk Logging', desc: 'Hold space. Call the set. "Bench 225 times 5, RPE 8." Gunny parses, logs, writes back confirmation. Built for the gym floor, not the couch.', wide: true },
              { code: 'F-05', title: 'Injury-Aware Programming', desc: 'Injury restrictions flow into every workout build. OHP on a bad shoulder? Landmine press, auto-subbed, with a note on why. Never programs past a documented restriction.', wide: true },
              { code: 'F-06', title: 'Auto PR Detection', desc: 'Hit a new best? System flags it, tags the lift type (strength / consistency / endurance / milestone), logs the date. Gunny references PRs when prescribing weight.', wide: false },
              { code: 'F-07', title: 'Macro + Meal Log', desc: 'Targets pulled from SITREP. Log meals fast. See today vs. target. Gunny pulls the last 3 days when you ask for food guidance.', wide: false },
              { code: 'F-08', title: 'Wearable Sync', desc: 'Connect Apple Watch, Garmin, Whoop, Oura. HR zone gauge live during sessions. Recovery + sleep metrics feed the Daily Brief.', wide: false },
              { code: 'F-09', title: 'Intel Center', desc: 'Progress charts, strength curves, compliance over time, streak history, day tags. Audit your own work. Your trainer sees it too.', wide: false },
              { code: 'F-10', title: 'Chain of Command', desc: 'Trainer Dashboard + COC view. Coach your roster. See every operator\u2019s compliance, PRs, injuries, daily briefs. Leave trainer notes Gunny reads.', wide: false },
              { code: 'F-11', title: 'Leaderboards + Tags', desc: 'Compete across your unit. Day tags flag hard days, missed days, wins. A paper trail of discipline, or the lack of it.', wide: false },
              { code: 'F-12', title: 'PWA + Offline Capable', desc: 'Install to home screen. Service worker auto-updates. Works on gym Wi-Fi or cellular dead zones. Multi-language (EN / ES). Next.js + Postgres + Claude API.', wide: true },
              { code: 'F-13', title: 'Tactical Radio + Social Feed', desc: 'Unit comms. Drop a clip, a lift, a win. Coach replies. Squad reacts. Accountability without the ad-driven feed.', wide: true },
            ].map((f) => (
              <div key={f.code} className={`${styles.feat} ${f.wide ? styles.featWide : ''}`}>
                <div className={styles.featCode}>{f.code}</div>
                <div className={styles.featTitle}>{f.title}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TIERS ========== */}
      <section id="tiers" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>04 · Deployment Tiers</span>
          <h2>Pick your <em>ordnance</em>.</h2>
          <p>Four tiers. Same app. Different AI depth. Pay monthly or lock in annual and save 17%. Every tier unlocks Gunny — heavier tiers unlock deeper context + more powerful models.</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.tiers}>
            {[
              // `key` matches operator.tier + lib/stripe.ts::TIER_PRICES so the
              // CTA can hand it straight to /api/stripe/checkout. See the
              // tier-CTA Link href below for the routing contract.
              { key: 'haiku', name: 'RECON', model: '// CLAUDE HAIKU', price: '$2', mo: '/mo', annual: '$19.92 annual · save $4', feats: ['Core Gunny AI (Haiku)', 'Full Planner + logging', 'Macro tracking', 'Profile-only context', 'Community feed'], cta: 'Enlist', featured: false },
              { key: 'sonnet', name: 'OPERATOR', model: '// CLAUDE SONNET', price: '$5', mo: '/mo', annual: '$49.80 annual · save $10', feats: ['Everything in RECON', 'Gunny with Sonnet brain', 'SITREP battle plan', 'Workout history context', 'Injury-aware sub engine'], cta: 'Deploy', featured: false },
              { key: 'opus', name: 'COMMANDER', model: '// CLAUDE OPUS', price: '$15', mo: '/mo', annual: '$149.40 annual · save $30', feats: ['Everything in OPERATOR', 'Gunny with Opus brain', 'Full nutrition context (72h)', 'Voice PTT + transcription', 'Wearable sync + HR zones', 'Priority Gunny response'], cta: 'Command', featured: true, badge: 'Most Deployed' },
              { key: 'white_glove', name: 'WARFIGHTER', model: '// OPUS · WHITE GLOVE', price: '$49', mo: '.99/mo', annual: '$499.90 annual · save $100', feats: ['Everything in COMMANDER', 'Human trainer assignment', 'Weekly custom brief', 'Trainer note pipeline → Gunny', 'Beta feature access', 'Priority onboarding'], cta: 'Suit Up', featured: false },
            ].map((t) => (
              <article
                key={t.name}
                className={`${styles.tier} ${styles.bracket} ${t.featured ? styles.tierFeatured : ''}`}
              >
                <span className="bl" /><span className="br" />
                {t.featured && t.badge && <div className={styles.tierBadge}>{t.badge}</div>}
                <div className={styles.tierName}>{t.name}</div>
                <div className={styles.tierModel}>{t.model}</div>
                <div className={styles.tierPrice}>
                  {t.price}<span className="mo">{t.mo}</span>
                </div>
                <div className={styles.tierAnnual}>{t.annual}</div>
                <ul className={styles.tierFeats}>
                  {t.feats.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <Link
                  className={styles.tierCta}
                  // Tier CTA → /login carrying tier + cycle. After the user
                  // authenticates, /login posts to /api/stripe/checkout with
                  // these params and redirects to the Stripe-hosted checkout
                  // session. If they're already logged in, /login auto-bounces
                  // to / which honors the same params.
                  href={`/login?tier=${t.key}&cycle=monthly`}
                  onClick={() => trackLandingCta('tier_select', { tier: t.key })}
                >
                  {t.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TRAINERS ========== */}
      <section
        id="trainers"
        className={styles.section}
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,255,65,0.02))' }}
      >
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>05 · For Trainers</span>
          <h2>Your clients deserve Gunny.<br />You deserve to <em>get paid</em>.</h2>
          <p>Onboard your roster in 10 minutes. Every client pays their own subscription. You take a cut — every month, forever. No exclusivity. No lock-in.</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.trainerWrap}>
            <div className={styles.trainerCopy}>
              <h3>Transparent math.<br />Direct deposit.</h3>
              <p>Commission pays on the full subscription — monthly or annual, pro-rated. Rank up as your roster grows and your cut grows with you.</p>

              <div className={`${styles.rankBonuses} ${styles.bracket}`}>
                <span className="bl" /><span className="br" />
                <span className={styles.label}>// Rank Bonus Program</span>
                <div className={styles.rankList}>
                  {[
                    { tier: '10 CLIENTS', desc: 'First milestone · cumulative with tier rate', bonus: '+2%' },
                    { tier: '25 CLIENTS', desc: 'Sustained rate bump', bonus: '+4%' },
                    { tier: '50 CLIENTS', desc: 'Partner status · exclusive drops', bonus: '+5%' },
                  ].map((r) => (
                    <div key={r.tier} className={styles.rankRow}>
                      <span className="tierLbl">{r.tier}</span>
                      <span className="desc">{r.desc}</span>
                      <span className="bonus">{r.bonus}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${styles.revTable} ${styles.bracket}`}>
              <span className="bl" /><span className="br" />
              <div className={styles.revHead}>
                <span>Tier</span><span>Client Pays</span><span>Your Cut</span><span>Per Client</span>
              </div>
              {[
                { tn: 'Recon', pays: '$2.00 / mo', cut: '25%', earn: '$0.50' },
                { tn: 'Operator', pays: '$5.00 / mo', cut: '30%', earn: '$1.50' },
                { tn: 'Commander', pays: '$15.00 / mo', cut: '35%', earn: '$5.25' },
                { tn: 'Warfighter', pays: '$49.99 / mo', cut: '40%', earn: '$19.99' },
              ].map((r) => (
                <div key={r.tn} className={styles.revRow}>
                  <span className="tn">{r.tn}</span>
                  <span>{r.pays}</span>
                  <span className="cut">{r.cut}</span>
                  <span className="earn">{r.earn}</span>
                </div>
              ))}

              <div className={styles.revCalc}>
                <div>
                  <div className="unit">Clients</div>
                  <div className="num">{clients}</div>
                </div>
                <div className="op">×</div>
                <div>
                  <div className="unit">Commander cut</div>
                  <div className="num">${COMMANDER_PER_CLIENT.toFixed(2)}</div>
                </div>
                <div className="op">=</div>
                <div className="res">
                  <div className="unit">MRR</div>
                  <div className="num">${mrr}</div>
                </div>
              </div>
              <div className={styles.revSliderWrap}>
                <input
                  type="range"
                  min={10}
                  max={200}
                  value={clients}
                  onChange={(e) => setClients(parseInt(e.target.value, 10))}
                  aria-label="Number of clients"
                />
                <span>// drag to scale · 10 → 200 clients</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 60, textAlign: 'center' }}>
            {/* Both trainer CTAs route to /contact with subject=trainer until
                a dedicated trainer-application flow exists. The one-pager
                button used to be a dead `#` anchor — now it triggers the same
                contact form so we capture the lead instead of dropping it. */}
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href="/contact?subject=trainer"
              onClick={() => trackLandingCta('trainer_apply')}
            >
              APPLY AS TRAINER <span className={styles.arrow}>→</span>
            </Link>
            <Link
              className={`${styles.btn} ${styles.btnSecondary}`}
              href="/contact?subject=trainer"
              style={{ marginLeft: 10 }}
              onClick={() => trackLandingCta('trainer_one_pager')}
            >
              DOWNLOAD ONE-PAGER
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOUNDERS ==========
           v4.2 update: section is now plural ("Founders") and renders
           BOTH co-founders — Ruben (engineering / USMC) + Britney
           (programming / athlete operations) — separated by a tactical
           divider. Britney's block uses .founderReverse so the rotator
           sits on the right and her content on the left, alternating
           the visual rhythm. Both rotators are the same component,
           parameterized via the `slides` prop. */}
      <section id="founder" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>06 · Founders</span>
          <h2>Two operators.<br />One <em>mission</em>.</h2>
          <p>Guns Up wasn&apos;t built in a boardroom. It was built by two people who lived on the wrong side of generic programming — and decided to engineer the system they wished they&apos;d had.</p>
        </div>
        <div className={styles.sectionWrap}>
          {/* ── Founder #1 · Ruben ── */}
          <div className={styles.founder}>
            <FounderRotator slides={RUBEN_SLIDES} ariaLabel="Ruben — career eras" />
            <div className={styles.founderContent}>
              <span className={styles.label}>// 01 · Founder&apos;s brief</span>
              <div className={styles.founderQuote}>
                &quot;Every fitness app I tried was built by marketers. <span className="green">This one</span> was built by an operator.&quot;
              </div>
              <p className={styles.founderBio}>
                Guns Up was built by a former USMC non-commissioned officer and a roster of certified trainers tired of generic programming. Every claim we make is cited. Every protocol is field-tested. Every decision Gunny makes is grounded in your specific profile — not the average user. That&apos;s the whole difference. Built alongside my wife and co-founder, Britney, between gym sessions and bedtime stories — this is a family operation, raising three kids while we ship.
              </p>
              <div className={styles.founderSig}>
                <b>// RUBEN</b> · Co-Founder · USMC NCO · CPT<br />
                <b>// GUNS UP FITNESS</b> · Engineering · Claude API integration · 2026
              </div>
            </div>
          </div>

          {/* Divider between the two co-founder briefs. ◆ glyphs in
              green, mono uppercase label, hairlines fade to/from green
              at the center. */}
          <div className={styles.foundersDivider}>
            <span className={styles.dot}>◆</span>
            <span>// 02 · Co-Founder · Brief</span>
            <span className={styles.dot}>◆</span>
          </div>

          {/* ── Co-Founder #2 · Britney ── (.founderReverse swaps the
              column order so the rotator is on the right) */}
          <div className={`${styles.founder} ${styles.founderReverse}`}>
            <FounderRotator slides={BRITNEY_SLIDES} ariaLabel="Britney — career eras" />
            <div className={styles.founderContent}>
              <span className={styles.label}>// 02 · Co-Founder&apos;s brief</span>
              <div className={styles.founderQuote}>
                &quot;Strong women build <span className="green">stronger systems</span>. We engineered Gunny to meet every athlete where she trains — and take her where she&apos;s going.&quot;
              </div>
              <p className={styles.founderBio}>
                Britney is a lifelong competitor — WPSL athlete, Spartan Race World Championship qualifier, NPC Figure competitor. She&apos;s spent two decades in real prep cycles: cutting for stage, peaking for races, rehabbing injuries between seasons. Every protocol Gunny runs for hypertrophy, conditioning, and contest prep was pressure-tested against her training log first. If it doesn&apos;t work for an athlete in week-9 of prep, it doesn&apos;t ship. She&apos;s also raising three kids with her husband and co-founder, Ruben — Guns Up is the family business, built in the margins between school runs and PR attempts.
              </p>
              <div className={styles.founderSig}>
                <b>// BRITNEY</b> · Co-Founder · NPC Women&apos;s Figure · Spartan Elite<br />
                <b>// GUNS UP FITNESS</b> · Programming · Athlete operations · 2026
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>07 · Intel</span>
          <h2>Common <em>queries</em>.</h2>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.faq}>
            {[
              { q: 'Is my data private?', a: 'Yes. Your operator profile lives in encrypted Postgres. Context sent to Claude is scoped per-call and never retained for model training. You own your data — export or delete at any time.' },
              { q: 'Do I need a trainer?', a: 'No. Every tier stands alone. If you want a human in the loop, WARFIGHTER includes one. RECON through COMMANDER run you solo with Gunny.' },
              { q: 'What equipment do I need?', a: "Whatever you've got. Intake captures your full equipment list — full gym, home rack, hotel room, bodyweight only. Gunny programs to what you have." },
              { q: 'How is this different from ChatGPT?', a: 'ChatGPT has no memory of your PRs, injuries, or plan. Gunny injects your complete operator context on every call. Ask the same question to both — watch what happens.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans are month-to-month. Annual plans are annual. Your data exports on request, your login stays, your logs are yours.' },
              { q: 'Which wearables work?', a: 'Apple Watch, Garmin, Whoop, Oura, Polar. HR zones feed live into the Daily Brief. Manual logging works without a device too.' },
            ].map((f) => (
              <div key={f.q} className={styles.faqItem}>
                <div className={styles.faqQ}>{f.q}</div>
                <div className={styles.faqA}>{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA BLOCK ========== */}
      <section id="cta" className={styles.section}>
        <div className={styles.sectionWrap} style={{ paddingBottom: 80, paddingTop: 40 }}>
          <div className={`${styles.ctaBlock} ${styles.bracket}`}>
            <span className="bl" /><span className="br" />
            <span className={styles.eyebrow}>// Final orders</span>
            <h2>You&apos;ve read the brief.<br /><em>Deploy, operator.</em></h2>
            <p>Start at $2/month. Gunny goes live the moment your intake is complete. 30-day milestones tracked from day one.</p>
            <div className="btns">
              <Link
                className={`${styles.btn} ${styles.btnPrimary}`}
                href="/login"
                onClick={() => trackLandingCta('final_deploy')}
              >
                DEPLOY NOW <span className={styles.arrow}>→</span>
              </Link>
              <a
                className={`${styles.btn} ${styles.btnSecondary}`}
                href="#gunny"
                onClick={() => trackLandingCta('final_see_gunny')}
              >
                SEE GUNNY IN ACTION
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <div className={styles.footCol}>
            <div className={styles.navBrand} style={{ marginBottom: 10 }}>
              <Image src="/logo-glow.png" alt="GUNS UP" width={22} height={22} className={styles.logoMark} />
              <span>GUNS UP</span>
            </div>
            <p className={styles.footDesc}>
              Military-precision fitness. AI-powered training. Built on Claude · Next.js · Postgres. Deployed on Railway.
            </p>
          </div>
          <div className={styles.footCol}>
            <h5>Command</h5>
            <a href="#arsenal">Arsenal</a>
            <a href="#gunny">Gunny AI</a>
            <a href="#tiers">Tiers</a>
            <a href="#founder">Founders</a>
          </div>
          <div className={styles.footCol}>
            <h5>For Trainers</h5>
            <a href="#trainers">Revenue Share</a>
            <a href="#trainers">Rank Bonuses</a>
            <Link href="/contact?subject=trainer">Apply</Link>
            <Link href="/contact?subject=trainer">Marketing Playbook</Link>
          </div>
          <div className={styles.footCol}>
            <h5>Intel</h5>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact?subject=beta">Beta Program</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div className={styles.footBottom}>
          <span>© 2026 GUNS UP FITNESS · All rights earned.</span>
          <span className="status">// SYS ONLINE · v4.2 · RAILWAY · APR 2026</span>
        </div>
      </footer>
    </div>
  );
}
