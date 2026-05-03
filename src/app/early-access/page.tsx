// /early-access — temporary single-page landing for the May 2026
// Instagram reel campaign. 20 total seats: 15 COMMANDER + 5 WARFIGHTER.
// Pricing here matches the Master Plan v3 (NOT the live /landing,
// which still shows v2 prices pending the pricing-v3 handoff).
//
// Flow: visitor reserves a seat → /api/early-access POST → row in
// EarlyAccessReservation → email to founder inbox → Ruben follows up
// manually with Stripe checkout link.
//
// This page is server-rendered with `force-dynamic` so the seat
// counter is fresh on every load. After the campaign ends (or all
// 20 seats reserved), update CAMPAIGN_OPEN below to false to render
// the closed state.

import { prisma } from '@/lib/db';
import EarlyAccessForm from './EarlyAccessForm';
import styles from './early-access.module.css';

// Toggle to false when the campaign closes or all 20 seats fill.
const CAMPAIGN_OPEN = true;

const COMMANDER_TOTAL = 15;
const WARFIGHTER_TOTAL = 5;

interface SeatCounts {
  commanderRemaining: number;
  warfighterRemaining: number;
  closed: boolean;
}

async function getSeatCounts(): Promise<SeatCounts> {
  try {
    const [commanderTaken, warfighterTaken] = await Promise.all([
      prisma.earlyAccessReservation.count({
        where: { tier: 'commander', status: { in: ['reserved', 'onboarded'] } },
      }),
      prisma.earlyAccessReservation.count({
        where: { tier: 'warfighter', status: { in: ['reserved', 'onboarded'] } },
      }),
    ]);
    const commanderRemaining = Math.max(0, COMMANDER_TOTAL - commanderTaken);
    const warfighterRemaining = Math.max(0, WARFIGHTER_TOTAL - warfighterTaken);
    const closed = commanderRemaining === 0 && warfighterRemaining === 0;
    return { commanderRemaining, warfighterRemaining, closed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[early-access] seat count failed:', err);
    // On DB error, optimistically show seats available so we don't
    // block legitimate reservations. If the API fails on submit, the
    // user gets a clear error then.
    return {
      commanderRemaining: COMMANDER_TOTAL,
      warfighterRemaining: WARFIGHTER_TOTAL,
      closed: false,
    };
  }
}

export const metadata = {
  title: 'GUNS UP · Early Access',
  description:
    'Founder-direct early access to GUNS UP COMMANDER and WARFIGHTER tiers. 20 seats. Limited release.',
};

// Force dynamic rendering so seat counts are fresh on every page load.
export const dynamic = 'force-dynamic';

export default async function EarlyAccessPage() {
  const seats = await getSeatCounts();
  const fullyClosed = !CAMPAIGN_OPEN || seats.closed;

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

        {/* Seat counter */}
        <section className={styles.seatGrid}>
          <article
            className={`${styles.seatCard} ${
              seats.commanderRemaining === 0 ? styles.seatCardSold : ''
            }`}
          >
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
              {seats.commanderRemaining > 0 ? (
                <>
                  <span className={styles.seatCounterNum}>
                    {seats.commanderRemaining}
                  </span>
                  <span className={styles.seatCounterLabel}>
                    of {COMMANDER_TOTAL} seats remaining
                  </span>
                </>
              ) : (
                <span className={styles.seatCounterClosed}>SEATS FILLED</span>
              )}
            </div>
          </article>

          <article
            className={`${styles.seatCard} ${styles.seatCardFeatured} ${
              seats.warfighterRemaining === 0 ? styles.seatCardSold : ''
            }`}
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
              {seats.warfighterRemaining > 0 ? (
                <>
                  <span className={styles.seatCounterNum}>
                    {seats.warfighterRemaining}
                  </span>
                  <span className={styles.seatCounterLabel}>
                    of {WARFIGHTER_TOTAL} seats remaining
                  </span>
                </>
              ) : (
                <span className={styles.seatCounterClosed}>SEATS FILLED</span>
              )}
            </div>
          </article>
        </section>

        {/* Form / closed state */}
        <section className={styles.formSection}>
          {fullyClosed ? (
            <div className={styles.closedBox}>
              <div className={styles.closedTitle}>// EARLY ACCESS · CLOSED</div>
              <p>
                All 20 seats are reserved. The next intake window opens after
                the v3 platform launch. Want a heads-up?{' '}
                <a href="/contact?subject=early-access-waitlist">
                  Drop me a line
                </a>
                .
              </p>
            </div>
          ) : (
            <EarlyAccessForm
              commanderAvailable={seats.commanderRemaining > 0}
              warfighterAvailable={seats.warfighterRemaining > 0}
            />
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
              <div className={styles.faqQ}>What happens after I reserve?</div>
              <div className={styles.faqA}>
                I email you within 24 hours with a Stripe link to lock in
                your seat. If I take longer than that, your spot is held —
                I&apos;m one person doing this manually for the first 20.
              </div>
            </div>
            <div className={styles.faqItem}>
              <div className={styles.faqQ}>
                What if I want WARFIGHTER but it&apos;s full?
              </div>
              <div className={styles.faqA}>
                Reserve COMMANDER instead, or hit the contact form for the
                waitlist. WARFIGHTER reopens later — but at the public $149
                rate. Founding cohort price doesn&apos;t reset.
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
