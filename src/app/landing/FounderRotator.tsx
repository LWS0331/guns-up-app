'use client';

// Founder Rotator — the photo-rotation centerpiece of the Origin section.
//
// Spec (from design-handoff README §9):
// - 4:5 portrait slot, 3 background-image slides (military → crossfit →
//   bodybuilding), all rendered in B&W (grayscale + low saturation).
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

interface Slide {
  era: string;       // big label, e.g. "MILITARY"
  year: string;      // "2008"
  caption: string;   // "USMC · DEPLOYED · OEF"
  coord: string;     // "34.5°N / 69.1°E"
  src: string;       // public path
  alt: string;
}

const SLIDES: Slide[] = [
  {
    era: 'MILITARY',
    year: '2008',
    caption: 'USMC · DEPLOYED · OEF',
    coord: '34.5°N / 69.1°E',
    src: '/founder-military.jpg',
    alt: 'Founder on deployment, USMC, 2008',
  },
  {
    era: 'CROSSFIT',
    year: '2015',
    caption: 'COMPETITOR · REGIONALS · RX',
    coord: '39.7°N / 104.9°W',
    src: '/founder-crossfit.jpg',
    alt: 'Founder competing in CrossFit, 2015',
  },
  {
    era: 'BODYBUILDING',
    year: '2022',
    caption: 'NPC · STAGE · CLASSIC PHYSIQUE',
    coord: '33.4°N / 112.0°W',
    src: '/founder-bodybuilding.jpg',
    alt: 'Founder competing in NPC bodybuilding, 2022',
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

export default function FounderRotator() {
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
      setIndex((i) => (i + 1) % SLIDES.length);
      setGlitchKey((k) => k + 1);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index]); // re-arm on manual jumps too (jump bumps index)

  const jumpTo = (i: number) => {
    if (i === index) return;
    setIndex(i);
    setGlitchKey((k) => k + 1);
  };

  const slide = SLIDES[index];

  return (
    <div className={`${styles.founderRotator} ${styles.bracket}`} aria-label="Founder photo rotator">
      <span className="bl" /><span className="br" />

      {/* Slides — all three are mounted at once; .active controls visibility
          via opacity + transform so the cross-fade + zoom is GPU-only.
          Photos are <img> rather than CSS background-image so the alt text
          is still announceable to screen readers. */}
      {SLIDES.map((s, i) => (
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
          {SLIDES.map((s, i) => (
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
