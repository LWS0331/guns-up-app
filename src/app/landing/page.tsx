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
//
// i18n (Phase 5): all marketing copy now goes through `useLanguage().t()`.
// Spanish translations live in src/lib/i18n.tsx under `// ─── Landing ───`.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';
import FounderRotator, { RUBEN_SLIDES, BRITNEY_SLIDES } from './FounderRotator';
import { trackEvent } from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n';

// Per-client monthly commission for the Commander tier (drives the
// landing-page revenue calculator). Pricing v1.0 (Apr 2026) lowered
// Commander's trainer share from 35% → 20% — $14.99 × 20% = $3.00.
// If tier pricing moves, update lib/types.ts::TIER_CONFIGS and mirror here.
const COMMANDER_PER_CLIENT = 3.00;

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
  const { t } = useLanguage();
  const [clients, setClients] = useState(50);
  const mrr = useMemo(() => (clients * COMMANDER_PER_CLIENT).toFixed(2), [clients]);

  // Pillars — `key` references resolve via t(). Stats are split (number + label)
  // so Gunny's accent color hits just the number, not the whole line.
  const pillars: Array<{ num: string; key: 'p1' | 'p2' | 'p3' | 'p4' }> = [
    { num: '01', key: 'p1' },
    { num: '02', key: 'p2' },
    { num: '03', key: 'p3' },
    { num: '04', key: 'p4' },
  ];

  // Arsenal feature grid — `wide` controls .featWide layout.
  const features: Array<{ code: string; key: string; wide: boolean }> = [
    { code: 'F-01', key: 'f01', wide: false },
    { code: 'F-02', key: 'f02', wide: false },
    { code: 'F-03', key: 'f03', wide: false },
    { code: 'F-04', key: 'f04', wide: true },
    { code: 'F-05', key: 'f05', wide: true },
    { code: 'F-06', key: 'f06', wide: false },
    { code: 'F-07', key: 'f07', wide: false },
    { code: 'F-08', key: 'f08', wide: false },
    { code: 'F-09', key: 'f09', wide: false },
    { code: 'F-10', key: 'f10', wide: false },
    { code: 'F-11', key: 'f11', wide: false },
    { code: 'F-12', key: 'f12', wide: true },
    { code: 'F-13', key: 'f13', wide: true },
  ];

  // Tier ordnance — `key` matches operator.tier + lib/stripe.ts::TIER_PRICES so the
  // CTA can hand it straight to /api/stripe/checkout. Pricing v2.0 (Apr 2026):
  // RECON now FREE with hard caps (30 chats/24h, 5 workout gens/7d). Apple IAP
  // path for OPERATOR; COMMANDER + WARFIGHTER are Stripe web-only to protect
  // trainer revenue share. Don't drift these without updating
  // lib/stripe.ts::TIER_PRICES first.
  const tiers: Array<{
    key: string;
    nsKey: 'recon' | 'operator' | 'commander' | 'warfighter';
    price: string;
    showMo: boolean;
    featCount: number;
    featured: boolean;
  }> = [
    { key: 'haiku',       nsKey: 'recon',      price: 'FREE', showMo: false, featCount: 6, featured: false },
    { key: 'sonnet',      nsKey: 'operator',   price: '$9',   showMo: true,  featCount: 6, featured: false },
    { key: 'opus',        nsKey: 'commander',  price: '$14',  showMo: true,  featCount: 7, featured: true },
    { key: 'white_glove', nsKey: 'warfighter', price: '$49',  showMo: true,  featCount: 7, featured: false },
  ];
  // FREE label is i18n-driven for RECON
  const reconPriceLabel = t('landing.tiers.recon.price');

  // Revenue table — same layout in both languages, content from t().
  const revRows = [
    { tn: t('landing.trainers.rev.recon_name'),      pays: t('landing.trainers.rev.recon_pays'),      cut: t('landing.trainers.rev.dash'),               earn: t('landing.trainers.rev.dash') },
    { tn: t('landing.trainers.rev.operator_name'),   pays: t('landing.trainers.rev.operator_pays'),   cut: t('landing.trainers.rev.dash'),               earn: t('landing.trainers.rev.operator_earn') },
    { tn: t('landing.trainers.rev.commander_name'),  pays: t('landing.trainers.rev.commander_pays'),  cut: t('landing.trainers.rev.commander_cut'),      earn: t('landing.trainers.rev.commander_earn') },
    { tn: t('landing.trainers.rev.warfighter_name'), pays: t('landing.trainers.rev.warfighter_pays'), cut: t('landing.trainers.rev.warfighter_cut'),     earn: t('landing.trainers.rev.warfighter_earn') },
  ];

  // Rank bonuses
  const ranks = [
    { tier: t('landing.trainers.rank10_tier'), desc: t('landing.trainers.rank10_desc'), bonus: t('landing.trainers.rank10_bonus') },
    { tier: t('landing.trainers.rank25_tier'), desc: t('landing.trainers.rank25_desc'), bonus: t('landing.trainers.rank25_bonus') },
    { tier: t('landing.trainers.rank50_tier'), desc: t('landing.trainers.rank50_desc'), bonus: t('landing.trainers.rank50_bonus') },
  ];

  // FAQ list
  const faqs = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
    { q: t('landing.faq.q6'), a: t('landing.faq.a6') },
  ];

  // Operator context block (Gunny demo) — keys + values pulled from t().
  // Some values stay locale-independent (callsign, dates, raw weights);
  // others (e.g. "Active"/"Activo", "Loaded"/"Cargados") flip with the
  // language toggle.
  const ctx: Array<{ k: string; v: string; tone?: 'green' | 'amber' }> = [
    { k: t('landing.gunny.ctx.callsign'),   v: 'RAMPAGE' },
    { k: t('landing.gunny.ctx.age_wt'),     v: '34 · 192lb' },
    { k: t('landing.gunny.ctx.split'),      v: 'UL 4-day' },
    { k: t('landing.gunny.ctx.sitrep'),     v: t('landing.gunny.ctx.sitrep_v'),     tone: 'green' },
    { k: t('landing.gunny.ctx.streak'),     v: t('landing.gunny.ctx.streak_v'),     tone: 'green' },
    { k: t('landing.gunny.ctx.last7'),      v: t('landing.gunny.ctx.last7_v') },
    { k: t('landing.gunny.ctx.meals'),      v: t('landing.gunny.ctx.meals_v') },
    { k: t('landing.gunny.ctx.prs'),        v: t('landing.gunny.ctx.prs_v') },
    { k: t('landing.gunny.ctx.injury'),     v: t('landing.gunny.ctx.injury_v'),     tone: 'amber' },
    { k: t('landing.gunny.ctx.macro_hit'),  v: t('landing.gunny.ctx.macro_hit_v') },
    { k: t('landing.gunny.ctx.milestones'), v: t('landing.gunny.ctx.milestones_v') },
    { k: t('landing.gunny.ctx.trainer'),    v: t('landing.gunny.ctx.trainer_v') },
  ];

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
            <span>{t('landing.nav.sys_online')}</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#arsenal">{t('landing.nav.arsenal')}</a>
            <a href="#gunny">{t('landing.nav.gunny')}</a>
            <a href="#tiers">{t('landing.nav.tiers')}</a>
            <a href="#trainers">{t('landing.nav.trainers')}</a>
            <a href="#founder">{t('landing.nav.founders')}</a>
            {/* MEMBER LOGIN — distinct from the primary "Deploy" CTA. Members
                returning to the site click here; the Deploy CTA is for new
                signups (currently routes to the same /login page until a
                separate /signup flow exists, but kept visually distinct so
                the pattern is in place when it does). */}
            <Link href="/login" className={styles.navLoginLink}>{t('landing.nav.member_login')}</Link>
          </div>
          <Link className={styles.navCta} href="/login">{t('landing.nav.deploy')}</Link>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className={`${styles.hero} ${styles.gridBg}`}>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.heroMeta}>
              <span><b>//</b> {t('landing.hero.meta_classified').replace(/^\/\/\s*/, '')}</span>
              <span><b>//</b> {t('landing.hero.meta_version').replace(/^\/\/\s*/, '')}</span>
              <span><b>//</b> {t('landing.hero.meta_trainers').replace(/^\/\/\s*/, '')}</span>
            </div>

            <h1>
              <span>{t('landing.hero.title_1')}</span><br />
              <span className={styles.heroSlash}>/</span> <span>{t('landing.hero.title_2')}</span>
            </h1>

            <p className={styles.heroLede}>
              {t('landing.hero.lede')}
              {' '}<b>{t('landing.hero.lede_gunny')}</b> {t('landing.hero.lede_knows')}
              {' '}<b>{t('landing.hero.lede_no_chatbot')}</b> {t('landing.hero.lede_trained')}
            </p>

            <div className={styles.heroCtas}>
              <Link
                className={`${styles.btn} ${styles.btnPrimary}`}
                href="/login"
                onClick={() => trackLandingCta('hero_deploy')}
              >
                {t('landing.hero.cta_deploy')} <span className={styles.arrow}>→</span>
              </Link>
              {/* SEE TIERS — drives the secondary hero CTA into the tier
                  grid in the same page instead of a contact form. The point
                  of the landing page is to convert; the four tiers ARE the
                  brief. /contact remains for legitimate trainer/beta/legal
                  outreach below. */}
              <Link
                className={`${styles.btn} ${styles.btnSecondary}`}
                href="#tiers"
                onClick={() => trackLandingCta('hero_see_tiers')}
              >
                {t('landing.hero.cta_see_tiers')}
              </Link>
            </div>

            <div className={`${styles.heroCreds} ${styles.bracket}`}>
              <span className="bl" /><span className="br" />
              <div>
                <div className={styles.credNum}>16</div>
                <div className={styles.credLbl}>{t('landing.hero.cred_sources')}</div>
              </div>
              <div>
                <div className={styles.credNum}>24/7</div>
                <div className={styles.credLbl}>{t('landing.hero.cred_coverage')}</div>
              </div>
              <div>
                <div className={styles.credNum}>
                  8<span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>lbs</span>
                </div>
                <div className={styles.credLbl}>{t('landing.hero.cred_lean_gain')}</div>
              </div>
            </div>
          </div>

          {/* Tactical HUD */}
          <div className={`${styles.hud} ${styles.bracket}`}>
            <span className="bl" /><span className="br" />
            <div className={styles.hudHead}>
              <span>{t('landing.hud.profile_header')}</span>
              <span className="live">{t('landing.hud.live')}</span>
            </div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.callsign')}</span><span className="v">{t('landing.hud.callsign_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.role')}</span><span className="v">{t('landing.hud.role_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.readiness')}</span><span className="v green">{t('landing.hud.readiness_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.streak')}</span><span className="v green">{t('landing.hud.streak_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.injury')}</span><span className="v amber">{t('landing.hud.injury_val')}</span></div>

            <div className={styles.hudSectionTitle}>{t('landing.hud.directive')}</div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.split')}</span><span className="v">{t('landing.hud.split_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.target')}</span><span className="v green">{t('landing.hud.target_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.sub')}</span><span className="v">{t('landing.hud.sub_val')}</span></div>
            <div className={styles.hudRow}><span className="k">{t('landing.hud.macros')}</span><span className="v">{t('landing.hud.macros_val')}</span></div>

            <div className={styles.hudChat}>
              <div className="from">{t('landing.hud.chat_from')}</div>
              <div className="msg">
                {t('landing.hud.chat_msg_pre')} <b>{t('landing.hud.chat_msg_set1')}</b>{t('landing.hud.chat_msg_mid')} <b>{t('landing.hud.chat_msg_set2')}</b>{t('landing.hud.chat_msg_after')} <b>{t('landing.hud.chat_msg_streak')}</b>{t('landing.hud.chat_msg_end')}
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
              <span><b>[SITREP]</b> {t('landing.ticker.sitrep').replace(/^\[SITREP\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[PR]</b> {t('landing.ticker.pr').replace(/^\[PR\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[COMPLIANCE]</b> {t('landing.ticker.compliance').replace(/^\[(COMPLIANCE|CUMPLIMIENTO)\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[NUTRITION]</b> {t('landing.ticker.nutrition').replace(/^\[(NUTRITION|NUTRICIÓN)\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[FIELD]</b> {t('landing.ticker.field').replace(/^\[(FIELD|CAMPO)\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[GUNNY]</b> {t('landing.ticker.gunny').replace(/^\[GUNNY\]\s*/, '')}</span><span className="tickerDot">·</span>
              <span><b>[TRAINERS]</b> {t('landing.ticker.trainers').replace(/^\[(TRAINERS|ENTRENADORES)\]\s*/, '')}</span><span className="tickerDot">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========== PILLARS ========== */}
      <section id="arsenal" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('landing.pillars.eyebrow')}</span>
          <h2>{t('landing.pillars.title_1')}<br />{t('landing.pillars.title_2')} <em>{t('landing.pillars.title_em')}</em> {t('landing.pillars.title_3')}</h2>
          <p>{t('landing.pillars.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.pillars}>
            {pillars.map((p) => {
              // Split each stat like "24/7 uptime" into number + label so Gunny's
              // accent color hits just the number, not the whole line.
              const splitStat = (s: string) => {
                const idx = s.indexOf(' ');
                return idx === -1 ? { num: s, rest: '' } : { num: s.slice(0, idx), rest: s.slice(idx) };
              };
              const l = splitStat(t(`landing.pillars.${p.key}.left`));
              const r = splitStat(t(`landing.pillars.${p.key}.right`));
              return (
                <article key={p.num} className={`${styles.pillar} ${styles.bracket}`}>
                  <span className="bl" /><span className="br" />
                  <div className={styles.pillarNum}>// {p.num}</div>
                  <div className={styles.pillarName}>{t(`landing.pillars.${p.key}.name`)}</div>
                  <div className={styles.pillarSub}>{t(`landing.pillars.${p.key}.sub`)}</div>
                  <p className={styles.pillarDesc}>{t(`landing.pillars.${p.key}.desc`)}</p>
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
          <span className={styles.eyebrow}>{t('landing.gunny.eyebrow')}</span>
          <h2>{t('landing.gunny.title_1')}<br />{t('landing.gunny.title_2')} <em>{t('landing.gunny.title_em')}</em> {t('landing.gunny.title_3')}</h2>
          <p>{t('landing.gunny.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.gunnyDemo}>
            <div className={styles.gunnySide}>
              <h3>{t('landing.gunny.context_h3')}</h3>
              <p>{t('landing.gunny.context_p')}</p>

              <div className={styles.gunnyContext}>
                <div className={styles.ctxTitle}>{t('landing.gunny.ctx_title')}</div>
                <div className={styles.ctxGrid}>
                  {ctx.map((c) => (
                    <div key={c.k} className={styles.ctxItem}>
                      <div className="k">{c.k}</div>
                      <div className={`v ${c.tone || ''}`}>{c.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.label} style={{ marginTop: 20, marginBottom: 10 }}>
                {t('landing.gunny.unlocks_label')}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {t('landing.gunny.unlocks_p')}
              </p>
            </div>

            <div className={`${styles.chatWin} ${styles.bracket}`}>
              <span className="bl" /><span className="br" />
              <div className={styles.chatHead}>
                <span className="title">{t('landing.gunny.chat_title')}</span>
                <span>{t('landing.gunny.chat_meta')}</span>
              </div>
              <div className={styles.chatBody}>
                <div className={`${styles.chatMsg} ${styles.chatMsgUser}`}>
                  {t('landing.gunny.chat_user1')}
                </div>
                <div className={`${styles.chatMsg} ${styles.chatMsgGunny}`}>
                  {t('landing.gunny.chat_reply1.lead')} <span className={styles.inlineRef}>SITREP</span> · <span className={styles.inlineRef}>injuries[]</span> · <span className={styles.inlineRef}>workouts[-7]</span>.<br /><br />
                  {t('landing.gunny.chat_reply1.last_push_pre')} <b>{t('landing.gunny.chat_reply1.last_push_date')}</b> {t('landing.gunny.chat_reply1.last_push_post')} <b>{t('landing.gunny.chat_reply1.bench_set')}</b>{t('landing.gunny.chat_reply1.incline_pre')} <b>{t('landing.gunny.chat_reply1.incline_set')}</b>{t('landing.gunny.chat_reply1.tri_pre')} <b>{t('landing.gunny.chat_reply1.tri_set')}</b>{t('landing.gunny.chat_reply1.tri_post')}
                  <br /><br />
                  <b>{t('landing.gunny.chat_reply1.directive')}</b><br />
                  {t('landing.gunny.chat_reply1.a1')} <span className={styles.inlineRef}>{t('landing.gunny.chat_reply1.a1_ref')}</span><br />
                  {t('landing.gunny.chat_reply1.a2')}<br />
                  {t('landing.gunny.chat_reply1.b1')} <span className={styles.inlineRef}>{t('landing.gunny.chat_reply1.b1_ref')}</span><br />
                  {t('landing.gunny.chat_reply1.b2')} <span className={styles.inlineRef}>{t('landing.gunny.chat_reply1.b2_ref')}</span><br />
                  {t('landing.gunny.chat_reply1.c')}
                </div>
                <div className={`${styles.chatMsg} ${styles.chatMsgUser}`}>{t('landing.gunny.chat_macros')}</div>
                <div className={`${styles.chatMsg} ${styles.chatMsgGunny}`}>
                  {t('landing.gunny.chat_reply2.target_pre')} <b>{t('landing.gunny.chat_reply2.target_val')}</b>{t('landing.gunny.chat_reply2.youre_at_pre')} <b>{t('landing.gunny.chat_reply2.youre_at_val')}</b> {t('landing.gunny.chat_reply2.youre_at_post')} <b>{t('landing.gunny.chat_reply2.need_val')}</b> {t('landing.gunny.chat_reply2.need_post')}
                  <span className={styles.caret} />
                </div>
              </div>
              <div className={styles.chatFoot}>
                <span className="prompt">{t('landing.gunny.chat_foot_prompt')}</span>
                <span>{t('landing.gunny.chat_foot_meta')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== ARSENAL / FEATURE GRID ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('landing.arsenal.eyebrow')}</span>
          <h2>{t('landing.arsenal.title_1')} <em>{t('landing.arsenal.title_em')}</em></h2>
          <p>{t('landing.arsenal.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.featureGrid}>
            {features.map((f) => (
              <div key={f.code} className={`${styles.feat} ${f.wide ? styles.featWide : ''}`}>
                <div className={styles.featCode}>{f.code}</div>
                <div className={styles.featTitle}>{t(`landing.arsenal.${f.key}.title`)}</div>
                <div className={styles.featDesc}>{t(`landing.arsenal.${f.key}.desc`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TIERS ========== */}
      <section id="tiers" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('landing.tiers.eyebrow')}</span>
          <h2>{t('landing.tiers.title_1')} <em>{t('landing.tiers.title_em')}</em>{t('landing.tiers.title_2')}</h2>
          <p>{t('landing.tiers.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.tiers}>
            {tiers.map((tier) => {
              const feats: string[] = [];
              for (let i = 1; i <= tier.featCount; i++) {
                feats.push(t(`landing.tiers.${tier.nsKey}.feat${i}`));
              }
              const price = tier.nsKey === 'recon' ? reconPriceLabel : tier.price;
              return (
                <article
                  key={tier.key}
                  className={`${styles.tier} ${styles.bracket} ${tier.featured ? styles.tierFeatured : ''}`}
                >
                  <span className="bl" /><span className="br" />
                  {tier.featured && <div className={styles.tierBadge}>{t('landing.tiers.commander.badge')}</div>}
                  <div className={styles.tierName}>{t(`landing.tiers.${tier.nsKey}.name`)}</div>
                  <div className={styles.tierModel}>{t(`landing.tiers.${tier.nsKey}.model`)}</div>
                  <div className={styles.tierPrice}>
                    {price}<span className="mo">{tier.showMo ? t('landing.tiers.mo_suffix') : ''}</span>
                  </div>
                  <div className={styles.tierAnnual}>{t(`landing.tiers.${tier.nsKey}.annual`)}</div>
                  <ul className={styles.tierFeats}>
                    {feats.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  <Link
                    className={styles.tierCta}
                    // Tier CTA → /login carrying tier + cycle. After the user
                    // authenticates, /login posts to /api/stripe/checkout with
                    // these params and redirects to the Stripe-hosted checkout
                    // session. If they're already logged in, /login auto-bounces
                    // to / which honors the same params.
                    href={`/login?tier=${tier.key}&cycle=monthly`}
                    onClick={() => trackLandingCta('tier_select', { tier: tier.key })}
                  >
                    {t(`landing.tiers.${tier.nsKey}.cta`)}
                  </Link>
                </article>
              );
            })}
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
          <span className={styles.eyebrow}>{t('landing.trainers.eyebrow')}</span>
          <h2>{t('landing.trainers.title_1')}<br />{t('landing.trainers.title_2')} <em>{t('landing.trainers.title_em')}</em>{t('landing.trainers.title_3')}</h2>
          <p>{t('landing.trainers.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.trainerWrap}>
            <div className={styles.trainerCopy}>
              <h3>{t('landing.trainers.copy_h3_1')}<br />{t('landing.trainers.copy_h3_2')}</h3>
              <p>{t('landing.trainers.copy_p')}</p>

              <div className={`${styles.rankBonuses} ${styles.bracket}`}>
                <span className="bl" /><span className="br" />
                <span className={styles.label}>{t('landing.trainers.rank_label')}</span>
                <div className={styles.rankList}>
                  {ranks.map((r) => (
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
                <span>{t('landing.trainers.rev.col_tier')}</span>
                <span>{t('landing.trainers.rev.col_pays')}</span>
                <span>{t('landing.trainers.rev.col_cut')}</span>
                <span>{t('landing.trainers.rev.col_per_client')}</span>
              </div>
              {revRows.map((r) => (
                <div key={r.tn} className={styles.revRow}>
                  <span className="tn">{r.tn}</span>
                  <span>{r.pays}</span>
                  <span className="cut">{r.cut}</span>
                  <span className="earn">{r.earn}</span>
                </div>
              ))}

              <div className={styles.revCalc}>
                <div>
                  <div className="unit">{t('landing.trainers.calc.clients')}</div>
                  <div className="num">{clients}</div>
                </div>
                <div className="op">×</div>
                <div>
                  <div className="unit">{t('landing.trainers.calc.commander_cut')}</div>
                  <div className="num">${COMMANDER_PER_CLIENT.toFixed(2)}</div>
                </div>
                <div className="op">=</div>
                <div className="res">
                  <div className="unit">{t('landing.trainers.calc.mrr')}</div>
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
                  aria-label={t('landing.trainers.calc.slider_label')}
                />
                <span>{t('landing.trainers.calc.slider_helper')}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 60, textAlign: 'center' }}>
            {/* APPLY AS TRAINER routes to /trainer-apply — a structured,
                gated application that lands in the TrainerApplication DB
                queue (NOT inbox-based contact form). Selectivity by design:
                applications are reviewed manually, no auto-acceptance, no
                self-serve Stripe checkout for trainers.
                One-pager still routes to /contact?subject=trainer until a
                real PDF asset exists to download. */}
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href="/trainer-apply"
              onClick={() => trackLandingCta('trainer_apply')}
            >
              {t('landing.trainers.cta_apply')} <span className={styles.arrow}>→</span>
            </Link>
            <Link
              className={`${styles.btn} ${styles.btnSecondary}`}
              href="/contact?subject=trainer"
              style={{ marginLeft: 10 }}
              onClick={() => trackLandingCta('trainer_one_pager')}
            >
              {t('landing.trainers.cta_one_pager')}
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
          <span className={styles.eyebrow}>{t('landing.founders.eyebrow')}</span>
          <h2>{t('landing.founders.title_1')}<br />{t('landing.founders.title_2')} <em>{t('landing.founders.title_em')}</em>{t('landing.founders.title_3')}</h2>
          <p>{t('landing.founders.lede')}</p>
        </div>
        <div className={styles.sectionWrap}>
          {/* ── Founder #1 · Ruben ── */}
          <div className={styles.founder}>
            <FounderRotator slides={RUBEN_SLIDES} ariaLabel={t('landing.founders.aria_ruben')} />
            <div className={styles.founderContent}>
              <span className={styles.label}>{t('landing.founders.r1_label')}</span>
              <div className={styles.founderQuote}>
                {t('landing.founders.r1_quote_pre')} <span className="green">{t('landing.founders.r1_quote_em')}</span> {t('landing.founders.r1_quote_post')}
              </div>
              <p className={styles.founderBio}>
                {t('landing.founders.r1_bio')}
              </p>
              <div className={styles.founderSig}>
                <b>{t('landing.founders.r1_sig_l1')}</b><br />
                <b>{t('landing.founders.r1_sig_l2')}</b>
              </div>
            </div>
          </div>

          {/* Divider between the two co-founder briefs. ◆ glyphs in
              green, mono uppercase label, hairlines fade to/from green
              at the center. */}
          <div className={styles.foundersDivider}>
            <span className={styles.dot}>◆</span>
            <span>{t('landing.founders.divider_label')}</span>
            <span className={styles.dot}>◆</span>
          </div>

          {/* ── Co-Founder #2 · Britney ── (.founderReverse swaps the
              column order so the rotator is on the right) */}
          <div className={`${styles.founder} ${styles.founderReverse}`}>
            <FounderRotator slides={BRITNEY_SLIDES} ariaLabel={t('landing.founders.aria_britney')} />
            <div className={styles.founderContent}>
              <span className={styles.label}>{t('landing.founders.r2_label')}</span>
              <div className={styles.founderQuote}>
                {t('landing.founders.r2_quote_pre')} <span className="green">{t('landing.founders.r2_quote_em')}</span>{t('landing.founders.r2_quote_post')}
              </div>
              <p className={styles.founderBio}>
                {t('landing.founders.r2_bio')}
              </p>
              <div className={styles.founderSig}>
                <b>{t('landing.founders.r2_sig_l1')}</b><br />
                <b>{t('landing.founders.r2_sig_l2')}</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('landing.faq.eyebrow')}</span>
          <h2>{t('landing.faq.title_1')} <em>{t('landing.faq.title_em')}</em>{t('landing.faq.title_2')}</h2>
        </div>
        <div className={styles.sectionWrap}>
          <div className={styles.faq}>
            {faqs.map((f) => (
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
            <span className={styles.eyebrow}>{t('landing.cta.eyebrow')}</span>
            <h2>{t('landing.cta.title_1')}<br /><em>{t('landing.cta.title_em')}</em></h2>
            <p>{t('landing.cta.lede')}</p>
            <div className="btns">
              <Link
                className={`${styles.btn} ${styles.btnPrimary}`}
                href="/login"
                onClick={() => trackLandingCta('final_deploy')}
              >
                {t('landing.cta.deploy_now')} <span className={styles.arrow}>→</span>
              </Link>
              <a
                className={`${styles.btn} ${styles.btnSecondary}`}
                href="#gunny"
                onClick={() => trackLandingCta('final_see_gunny')}
              >
                {t('landing.cta.see_gunny')}
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
              {t('landing.footer.desc')}
            </p>
          </div>
          <div className={styles.footCol}>
            <h5>{t('landing.footer.command')}</h5>
            <a href="#arsenal">{t('landing.nav.arsenal')}</a>
            <a href="#gunny">{t('landing.nav.gunny')}</a>
            <a href="#tiers">{t('landing.nav.tiers')}</a>
            <a href="#founder">{t('landing.nav.founders')}</a>
          </div>
          <div className={styles.footCol}>
            <h5>{t('landing.footer.for_trainers')}</h5>
            <a href="#trainers">{t('landing.footer.revenue_share')}</a>
            <a href="#trainers">{t('landing.footer.rank_bonuses')}</a>
            <Link href="/trainer-apply">{t('landing.footer.apply')}</Link>
            <Link href="/contact?subject=trainer">{t('landing.footer.marketing_playbook')}</Link>
          </div>
          <div className={styles.footCol}>
            <h5>{t('landing.footer.intel')}</h5>
            <Link href="/privacy">{t('landing.footer.privacy')}</Link>
            <Link href="/terms">{t('landing.footer.terms')}</Link>
            <Link href="/contact?subject=beta">{t('landing.footer.beta_program')}</Link>
            <Link href="/contact">{t('landing.footer.contact')}</Link>
          </div>
        </div>
        <div className={styles.footBottom}>
          <span>{t('landing.footer.copyright')}</span>
          <span className="status">{t('landing.footer.status')}</span>
        </div>
      </footer>
    </div>
  );
}
