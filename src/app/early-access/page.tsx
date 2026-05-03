// /early-access — single-page landing for the May 2026 Instagram-reel
// campaign. 20 total seats: 15 COMMANDER + 5 WARFIGHTER. Pricing here
// matches the Master Plan v3 (NOT the live /landing, which still shows
// v2 prices pending the pricing-v3 handoff).
//
// Onboarding is fully manual via Instagram DM — no form, no DB, no
// notification email plumbing. Visitor reads the pitch → taps a tier
// CTA → IG opens to a fresh DM with @gunnyai_fit → Ruben handles the
// onboarding by hand and sends a Stripe link within 24 hours.
//
// Why not a form? Speed. The first 20 are all hands-on anyway, so a
// form just adds a step that filters out conversational intent. IG DM
// is where the founder already lives; the page just routes traffic
// there.
//
// When the campaign closes (or all seats fill), flip CAMPAIGN_OPEN
// below to false and ship — the closed state takes over.

import styles from './early-access.module.css';
import EarlyAccessChat from './EarlyAccessChat';

// Toggle to false when the campaign closes or all 20 seats fill.
const CAMPAIGN_OPEN = true;

const COMMANDER_TOTAL = 15;
const WARFIGHTER_TOTAL = 5;

// ig.me/m/<handle> deep-links straight into a fresh DM compose with
// the recipient pre-filled — works on iOS, Android, and web. Falling
// back to the profile URL would require an extra tap.
const IG_DM_URL = 'https://ig.me/m/gunnyai_fit';
const IG_PROFILE_URL = 'https://instagram.com/gunnyai_fit';

export const metadata = {
  title: 'GUNS UP · Early Access',
  description:
    'Founder-direct early access to GUNS UP COMMANDER and WARFIGHTER tiers. 20 seats. Limited release.',
};

export default function EarlyAccessPage() {
  return (
    <main className={styles.main}>
      {/* Background grid overlay */}
      <div className={styles.gridBg} aria-hidden="true" />

      <div className={styles.container}>
        {/* Brand header */}
        <header className={styles.brandHeader}>
          <span className={styles.brandMark}>GUNS UP //</span>
          <span className={styles.brandStatus}>
            <span className={styles.dot} /> SYS ONLINE
          </span>
        </header>

        {/* Eyebrow */}
        <div className={styles.eyebrow}>
          // CLASSIFIED · EARLY ACCESS · MAY 2026
        </div>

        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.title}>
            38 ng/dL.
            <br />
            <span className={styles.titleAccent}>Flagged in 12 seconds.</span>
          </h1>

          <p className={styles.lede}>
            My T came back at 38. Gunny pulled the labs against my training
            load and sleep data, built a 6-week protocol, and added it to
            my planner before I finished my coffee.{' '}
            <strong>
              This is what AI fitness coaching is supposed to look like
            </strong>{' '}
            — when the model is Claude Opus and it has your full operator
            context.
          </p>

          <p className={styles.ledeSecondary}>
            I&apos;m opening 20 seats. Then I close it. No reopen.
          </p>
        </section>

        {/* Seat grid — static cohort sizes (no live counter; intake is
            via IG DM). Flip CAMPAIGN_OPEN to false when filled. */}
        <section className={styles.seatGrid}>
          <article className={styles.seatCard}>
            <div className={styles.seatLabel}>// TIER 03</div>
            <div className={styles.seatName}>COMMANDER</div>
            <div className={styles.seatPrice}>
              $39.99
              <span className={styles.seatPriceUnit}>/mo</span>
            </div>
            <ul className={styles.seatFeats}>
              <li>Sonnet brain · unlimited</li>
              <li>$15/mo Opus credits included</li>
              <li>Voice PTT + wearable sync</li>
              <li>Full 72h nutrition context</li>
              <li>Priority response queue</li>
            </ul>
            <div className={styles.seatCounter}>
              <span className={styles.seatCounterNum}>{COMMANDER_TOTAL}</span>
              <span className={styles.seatCounterLabel}>
                seats · founding cohort
              </span>
            </div>
          </article>

          <article
            className={`${styles.seatCard} ${styles.seatCardFeatured}`}
          >
            <div className={styles.seatBadge}>CONCIERGE</div>
            <div className={styles.seatLabel}>// TIER 04</div>
            <div className={styles.seatName}>WARFIGHTER</div>
            <div className={styles.seatPrice}>
              $149
              <span className={styles.seatPriceUnit}>/mo</span>
            </div>
            <ul className={styles.seatFeats}>
              <li>Everything in COMMANDER</li>
              <li>Unlimited Opus access</li>
              <li>
                <strong>Monthly 1:1 with Ruben</strong>
              </li>
              <li>Concierge programming review</li>
              <li>Beta feature access</li>
            </ul>
            <div className={styles.seatCounter}>
              <span className={styles.seatCounterNum}>{WARFIGHTER_TOTAL}</span>
              <span className={styles.seatCounterLabel}>
                seats · founding cohort
              </span>
            </div>
          </article>
        </section>

        {/* CTA section — IG DM intake */}
        <section className={styles.ctaSection}>
          {CAMPAIGN_OPEN ? (
            <>
              <div className={styles.ctaHead}>
                <span className={styles.eyebrow}>// RESERVE YOUR SEAT</span>
                <p className={styles.ctaLede}>
                  Onboarding is hands-on for the first 20. Tap below, send
                  one DM, I send back a Stripe link within 24 hours.
                </p>
              </div>

              <div className={styles.ctaGrid}>
                <a
                  className={styles.ctaPrimary}
                  href={IG_DM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Instagram DM and reserve a COMMANDER seat"
                >
                  <span className={styles.ctaTier}>
                    DM &ldquo;COMMANDER&rdquo;
                  </span>
                  <span className={styles.ctaPrice}>$39.99 / mo</span>
                  <span className={styles.ctaArrow} aria-hidden="true">
                    →
                  </span>
                </a>
                <a
                  className={`${styles.ctaPrimary} ${styles.ctaPrimaryAccent}`}
                  href={IG_DM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Instagram DM and reserve a WARFIGHTER seat"
                >
                  <span className={styles.ctaTier}>
                    DM &ldquo;WARFIGHTER&rdquo;
                  </span>
                  <span className={styles.ctaPrice}>$149 / mo</span>
                  <span className={styles.ctaArrow} aria-hidden="true">
                    →
                  </span>
                </a>
              </div>

              <p className={styles.ctaHelper}>
                Not sure which tier? DM <strong>&ldquo;OPS&rdquo;</strong> to{' '}
                <a
                  href={IG_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @gunnyai_fit
                </a>{' '}
                — I&apos;ll help you pick.
              </p>
            </>
          ) : (
            <div className={styles.closedBox}>
              <div className={styles.closedTitle}>// EARLY ACCESS · CLOSED</div>
              <p>
                All 20 seats are reserved. The next intake window opens after
                the v3 platform launch. Want a heads-up? DM{' '}
                <a
                  href={IG_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @gunnyai_fit
                </a>
                .
              </p>
            </div>
          )}
        </section>

        {/* Founder credibility strip */}
        <section className={styles.credStrip}>
          <div className={styles.credLabel}>// BUILT BY</div>
          <div className={styles.credList}>
            <span>USMC 0331 Machine Gunner · 3/4 Marines</span>
            <span className={styles.credDot}>·</span>
            <span>NASM CPT</span>
            <span className={styles.credDot}>·</span>
            <span>ISSA CPT</span>
            <span className={styles.credDot}>·</span>
            <span>CrossFit L1</span>
            <span className={styles.credDot}>·</span>
            <span>OPEX Coaching</span>
          </div>
        </section>

        {/* Mini FAQ */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqTitle}>// COMMON QUERIES</h2>
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <div className={styles.faqQ}>What happens after I DM?</div>
              <div className={styles.faqA}>
                I reply within 24 hours with a Stripe link to lock in your
                seat. If I take longer than that, your spot is held —
                I&apos;m one person doing this manually for the first 20.
              </div>
            </div>
            <div className={styles.faqItem}>
              <div className={styles.faqQ}>
                What if I want WARFIGHTER but it&apos;s full?
              </div>
              <div className={styles.faqA}>
                Take COMMANDER instead, or ask me for the WARFIGHTER
                waitlist. When WARFIGHTER reopens it&apos;s at the public
                $149 rate — founding cohort price doesn&apos;t reset.
              </div>
            </div>
            <div className={styles.faqItem}>
              <div className={styles.faqQ}>Can I cancel?</div>
              <div className={styles.faqA}>
                Anytime. Monthly billing, month-to-month, your data exports
                on request. The early access price is locked for as long as
                your account stays active.
              </div>
            </div>
            <div className={styles.faqItem}>
              <div className={styles.faqQ}>Why so few seats?</div>
              <div className={styles.faqA}>
                I&apos;d rather over-deliver to 20 than under-deliver to 200.
                Especially WARFIGHTER — that&apos;s a real 1:1 with me every
                month. Five is the most I can sustain right now.
              </div>
            </div>
          </div>
        </section>

        {/* Gunny-Lite chat — long-tail Q&A, 2-message cap then IG DM */}
        <EarlyAccessChat />

        {/* Disclaimer */}
        <footer className={styles.footer}>
          <p className={styles.disclaimer}>
            Gunny is an AI fitness coach, not a medical provider. See a
            physician for hormone, medication, or medical concerns. GUNS UP
            does not diagnose, treat, prevent, or cure any condition.
          </p>
          <p className={styles.copyright}>
            © 2026 GUNS UP FITNESS · All rights earned.
          </p>
        </footer>
      </div>
    </main>
  );
}
