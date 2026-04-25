'use client';

// Founder Rotator — reusable photo-rotation component for the Founders
// section. Originally specced for one founder (Ruben); the v4.2 update
// added a second co-founder (Britney) with her own three-era rotator,
// so the slide list moved from a hardcoded const to a `slides` prop.
//
// Spec (from design-handoff README §9):
// - 4:5 portrait slot, 3 background-image slides, all rendered in B&W
//   (grayscale + low saturation).
// - Auto-cycles every 5 s. Click any progress segment to jump and reset
//   the cycle. Glitch transition between slides (RGB jitter + scanline bars).
// - Per-slide HUD: top bar with red blinking REC indicator, geo coords,
//   live UTC clock; bottom bar with ERA label + year + caption + 3-segment
//   progress bar.
// - Layered effects (in z-index order): gridlines (4) → crosshair + reticle
//   sweep (5) → scan band (6) → CRT scanlines (7) → vignette (8) → glitch
//   overlay (9) → HUD chrome (10).
//
// All visual styling lives in landing.module.css under a
// `.founderRotator` block. This component owns the state machine
// (currentIndex, autoRotate timer, live clock, glitch retrigger) and
// delegates everything decorative to CSS.

import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

export interface RotatorSlide {
  era: string;       // big label, e.g. "MILITARY"
  year: string;      // "2008 · USMC"
  caption: string;   // "DEPLOYED · OEF"
  coord: string;     // "34.5°N / 69.1°E"
  src: string;       // public path
  alt: string;
}

export interface FounderRotatorProps {
  /** The three eras to cycle through. Component re-derives layout from
   *  the array length, but the canonical design spec is exactly 3 slides
   *  (one per era) — the progress bar's segment count and the auto-cycle
   *  cadence both assume 3. */
  slides: RotatorSlide[];
  /** ARIA label for the rotator container. Defaults to a generic
   *  "Founder photo rotator" but should be overridden per founder
   *  (e.g. "Ruben — career eras") so screen readers announce who's in
   *  the photos. */
  ariaLabel?: string;
}

// ─── Default slide set: Ruben (founder #1) ─────────────────────────
// Kept exported so the page can pass them in explicitly without
// re-declaring; also lets the component render a sensible default when
// used without props (e.g. in Storybook / smoke tests).
export const RUBEN_SLIDES: RotatorSlide[] = [
  {
    era: 'MILITARY',
    year: '2008 · USMC',
    caption: 'DEPLOYED · OEF',
    coord: '34.5°N / 69.1°E',
    src: '/founder-military.jpg',
    alt: 'Ruben on deployment, USMC, 2008',
  },
  {
    era: 'CROSSFIT',
    year: '2015 · COMPETITOR',
    caption: 'REGIONALS · RX',
    coord: '39.7°N / 104.9°W',
    src: '/founder-crossfit.jpg',
    alt: 'Ruben competing in CrossFit, 2015',
  },
  {
    era: 'BODYBUILDING',
    year: '2022 · NPC',
    caption: 'STAGE · CLASSIC PHYSIQUE',
    coord: '33.4°N / 112.0°W',
    src: '/founder-bodybuilding.jpg',
    alt: 'Ruben competing in NPC bodybuilding, 2022',
  },
];

// ─── Co-founder slide set: Britney (founder #2) ────────────────────
// Soccer (WPSL) → Spartan World Championships → NPC Women's Figure.
// Coordinates picked from the canonical handoff: Fresno-area for
// WPSL, Lake Tahoe for the 2018 Spartan Worlds, Phoenix for NPC.
export const BRITNEY_SLIDES: RotatorSlide[] = [
  {
    era: 'SOCCER',
    year: '2014 · WPSL',
    caption: 'MIDFIELD · PRO-AM',
    coord: '36.7°N / 119.7°W',
    src: '/cofounder-soccer.jpg',
    alt: "Britney playing WPSL midfield, 2014",
  },
  {
    era: 'SPARTAN',
    year: '2018 · WORLD CHAMPIONSHIP',
    caption: 'LAKE TAHOE · ELITE',
    coord: '39.0°N / 120.0°W',
    src: '/cofounder-spartan.jpg',
    alt: "Britney at the 2018 Spartan World Championship, Lake Tahoe",
  },
  {
    era: 'FIGURE',
    year: '2024 · NPC',
    caption: "STAGE · WOMEN'S FIGURE",
    coord: '33.4°N / 112.0°W',
    src: '/cofounder-bodybuilding.jpg',
    alt: "Britney competing in NPC Women's Figure, 2024",
  },
];

const ROTATE_MS = 5000;
const CLOCK_MS = 1000;

// UTC clock formatter — HH:MM:SS Z. Used in the top HUD bar so the photo
// chrome feels live rather than a static composition.
function formatUtc(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} Z`;
}

export default function FounderRotator({
  slides = RUBEN_SLIDES,
  ariaLabel = 'Founder photo rotator',
}: FounderRotatorProps = { slides: RUBEN_SLIDES }) {
  const [index, setIndex] = useState(0);
  const [glitchKey, setGlitchKey] = useState(0); // bumped each transition to retrigger keyframes
  const [now, setNow] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live UTC clock. Initialized in an effect (not useState init) so SSR
  // doesn't hydrate a different value than the client picks on mount.
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  // Auto-rotate. Cleared + re-armed whenever the user clicks a segment so
  // the timer doesn't fire 200 ms after a manual jump.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
      setGlitchKey((k) => k + 1);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index, slides.length]); // re-arm on manual jumps too (jump bumps index)

  const jumpTo = (i: number) => {
    if (i === index) return;
    setIndex(i);
    setGlitchKey((k) => k + 1);
  };

  const slide = slides[index];

  return (
    <div className={`${styles.founderRotator} ${styles.bracket}`} aria-label={ariaLabel}>
      <span className="bl" /><span className="br" />

      {/* Slides — all three are mounted at once; .active controls visibility
          via opacity + transform so the cross-fade + zoom is GPU-only.
          Photos are <img> rather than CSS background-image so the alt text
          is still announceable to screen readers. */}
      {slides.map((s, i) => (
        <div
          key={s.src}
          className={`${styles.frSlide} ${i === index ? styles.frSlideActive : ''}`}
          data-era={s.era}
          aria-hidden={i !== index}
        >
          <img src={s.src} alt={s.alt} className={styles.frSlideImg} draggable={false} />
        </div>
      ))}

      {/* Decorative overlays. None of these need DOM updates per slide; they
          just live above the photo and below the HUD chrome. */}
      <div className={styles.frGridlines} aria-hidden />
      <div className={styles.frCrosshair} aria-hidden />
      <div className={styles.frReticleSweep} aria-hidden />
      <div className={styles.frScan} aria-hidden />
      <div className={styles.frVignette} aria-hidden />

      {/* Glitch overlay re-triggers via key bump so the keyframe restarts
          on every transition, not just the first one. */}
      <div key={glitchKey} className={styles.frGlitch} aria-hidden />

      {/* HUD top: red blinking REC dot, geo coords, live UTC clock. */}
      <div className={styles.frHudTop}>
        <span className={styles.frRec}>
          <span className={styles.frRecDot} /> REC
        </span>
        <span className={styles.frCoord}>{slide.coord}</span>
        {/* Suppress hydration warning because the clock differs by render
            timestamp; we accept that and only render the value once `now`
            is set client-side. */}
        <span className={styles.frClock} suppressHydrationWarning>
          {now ? formatUtc(now) : '—'}
        </span>
      </div>

      {/* HUD bottom: ERA label + year + caption + 3-segment progress bar. */}
      <div className={styles.frHudBottom}>
        <div className={styles.frEraLine}>
          <span className={styles.frEraLabel}>ERA :: {slide.era}</span>
          <span className={styles.frYear}>{slide.year}</span>
        </div>
        <div className={styles.frCaption}>{slide.caption}</div>
        <div className={styles.frProgress} role="tablist" aria-label="Founder eras">
          {slides.map((s, i) => (
            <button
              type="button"
              key={s.era}
              role="tab"
              aria-selected={i === index}
              aria-label={`${s.era} ${s.year}`}
              onClick={() => jumpTo(i)}
              className={`${styles.frSegment} ${i === index ? styles.frSegmentActive : ''} ${i < index ? styles.frSegmentDone : ''}`}
            >
              {/* The fill bar inside is keyed off the glitchKey so the
                  CSS animation restarts in lockstep with the auto-cycle. */}
              {i === index && <span key={glitchKey} className={styles.frSegmentFill} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
