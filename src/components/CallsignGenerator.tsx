'use client';

// CallsignGenerator — military-themed callsign picker for the
// onboarding flow. Replaces the plain "type a callsign" input with
// a generator that:
//   1. Click GENERATE → shows 2 random callsigns (round 1).
//   2. Click REGENERATE (one more time only) → shows 2 fresh
//      callsigns (round 2). Total: 4 options seen.
//   3. After 2 rounds, the regenerate button disappears.
//   4. WRITE OWN — at any point, swap to a plain text input for a
//      manual callsign. Same validation as the create-operator
//      endpoint (CALLSIGN_RE).
//
// Why two rounds: 4 options is enough for almost everyone to find one
// they like; unbounded regeneration becomes a procrastination trap.
// Manual fallback covers the rest.
//
// Generation strategy: pick from <PREFIX> · <CORE> pools and combine.
// Some patterns omit the prefix for short callsigns. Existing
// callsigns are filtered out client-side so we don't waste an option
// slot on a guaranteed-collision pick. The pools are intentionally on
// the small side (~30 prefixes × ~50 cores ≈ 1,500 combinations) —
// that's plenty for thousands of operators while keeping the vibe
// curated rather than random-string.

import { useState, useMemo } from 'react';

// Prefix pool — adjectives + colors + ranks. Keeps the tactical tone.
const PREFIXES = [
  'IRON', 'STORM', 'SHADOW', 'GHOST', 'ROGUE', 'SILENT', 'BLACK',
  'REAPER', 'STEEL', 'NIGHT', 'SAVAGE', 'PHANTOM', 'WICKED', 'FIERCE',
  'BLOOD', 'FROST', 'WRAITH', 'CRIMSON', 'SCORCH', 'TITAN', 'FERAL',
  'LONE', 'GRIM', 'COBALT', 'GRAVE', 'OMEGA', 'BLAZE', 'KILO', 'DELTA',
  'BRAVO',
];

// Core pool — predators, weapons, code words. Most callsigns end here.
const CORES = [
  'WOLF', 'VIPER', 'FALCON', 'RAVEN', 'COBRA', 'BEAR', 'EAGLE', 'HAWK',
  'JACKAL', 'HOUND', 'TIGER', 'BULL', 'RHINO', 'BUCK', 'PUMA', 'LYNX',
  'RECON', 'GUNNER', 'TRIGGER', 'BARREL', 'BAYONET', 'BLADE', 'SPEAR',
  'ARROW', 'TALON', 'STRIKE', 'FANG', 'DAGGER', 'SHIV', 'GAUNTLET',
  'WARDEN', 'RANGER', 'SCOUT', 'NOMAD', 'MARSHAL', 'OUTLAW', 'PALADIN',
  'SENTINEL', 'CHIEF', 'CHASE', 'HUNTER', 'TRACKER', 'STALKER',
  'SIX', 'ZERO', 'NINE', 'ELEVEN', 'PRIME', 'ECHO', 'FOXTROT', 'SIERRA',
];

// Single-word callsigns — no prefix. ~20% of generations will use this
// pattern (set by SOLO_PROBABILITY) so the output isn't all hyphenated
// pairs. Keep it short and punchy.
const SOLO_CORES = [
  'REAPER', 'PHANTOM', 'GUNNER', 'RANGER', 'OUTLAW', 'NOMAD', 'CHIEF',
  'MAVERICK', 'WARDEN', 'TALON', 'GHOST', 'WRAITH', 'SAVAGE', 'PALADIN',
  'STALKER', 'TRACKER', 'WIDOW', 'JINX', 'KING', 'CIPHER',
];

const SOLO_PROBABILITY = 0.2;
const CALLSIGN_RE = /^[A-Z0-9-]{2,20}$/;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a single candidate. Skips combinations longer than the
// 20-char DB limit. With pool sizes above this almost never trims —
// LONGEST + LONGEST = 'WARDEN-GAUNTLET' = 15 chars.
function generateOne(): string {
  if (Math.random() < SOLO_PROBABILITY) {
    return pick(SOLO_CORES);
  }
  let candidate = '';
  // Loop guard for the rare case combo > 20 chars (won't happen with
  // current pools, but cheap to protect against future pool growth).
  for (let i = 0; i < 8; i++) {
    candidate = `${pick(PREFIXES)}-${pick(CORES)}`;
    if (candidate.length <= 20) break;
  }
  return candidate;
}

// Generate `count` UNIQUE candidates that don't collide with `excluded`
// (existing callsigns) or with each other. excluded is normalized to
// uppercase before comparison since callsigns are stored uppercase.
function generateBatch(count: number, excluded: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // 50 attempts per slot is plenty given a 1,500+ combination space
  // and an excluded set that's almost certainly < 100 callsigns.
  for (let i = 0; i < count * 50 && out.length < count; i++) {
    const candidate = generateOne();
    if (seen.has(candidate)) continue;
    if (excluded.has(candidate.toUpperCase())) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  // Defensive fallback if we somehow couldn't fill — return what we
  // have plus a numeric suffix on a safe core. Only triggers if the
  // pool is exhausted or the excluded set is pathological.
  while (out.length < count) {
    const fallback = `${pick(SOLO_CORES)}-${Math.floor(Math.random() * 99)}`;
    if (!seen.has(fallback) && !excluded.has(fallback.toUpperCase())) {
      seen.add(fallback);
      out.push(fallback);
    }
  }
  return out;
}

interface Props {
  /** Current selected callsign. Empty string until the user picks. */
  value: string;
  /** Called whenever the selection changes (generator pick OR manual
   *  type). Parent stores this and passes it to the create-operator
   *  endpoint. */
  onChange: (callsign: string) => void;
  /** Existing callsigns to exclude from the generator. Pass the
   *  display-roster callsigns from OpsCenter; matched case-insensitively. */
  existingCallsigns: string[];
  /** Disable all interaction (e.g. while a submit is pending). */
  disabled?: boolean;
}

const MAX_ROUNDS = 2;

export default function CallsignGenerator({
  value, onChange, existingCallsigns, disabled,
}: Props) {
  // Memoize the excluded set so we don't rebuild it on every keystroke.
  // The roster doesn't change between renders unless the parent
  // refetches, so this is cheap.
  const excluded = useMemo(
    () => new Set(existingCallsigns.map((c) => c.toUpperCase())),
    [existingCallsigns],
  );

  // Generator state: which round we're on (0 = haven't pressed
  // generate yet) and the latest two options. Manual mode is a
  // separate switch — when on, the input replaces the generator.
  const [round, setRound] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const handleGenerate = () => {
    if (round >= MAX_ROUNDS) return;
    const batch = generateBatch(2, excluded);
    setOptions(batch);
    setRound((r) => r + 1);
  };

  const handlePick = (callsign: string) => {
    onChange(callsign);
  };

  const handleManualChange = (raw: string) => {
    const v = raw.toUpperCase();
    onChange(v);
    if (!v) {
      setManualError(null);
      return;
    }
    if (!CALLSIGN_RE.test(v)) {
      setManualError('2-20 chars, A-Z / 0-9 / hyphen only');
      return;
    }
    if (excluded.has(v)) {
      setManualError('Callsign already taken');
      return;
    }
    setManualError(null);
  };

  // ── Manual mode ────────────────────────────────────────────────
  if (manual) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <label style={{
            color: '#777', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px',
            letterSpacing: '2px', textTransform: 'uppercase',
          }}>
            CALLSIGN — MANUAL
          </label>
          <button
            type="button"
            onClick={() => { setManual(false); setManualError(null); }}
            disabled={disabled}
            style={ghostBtn}
          >
            ← BACK TO GENERATOR
          </button>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder="AMMON or IRON-WOLF"
          maxLength={20}
          disabled={disabled}
          style={{
            width: '100%', padding: '10px 12px',
            background: 'rgba(0,0,0,0.40)',
            border: `1px solid ${manualError ? 'rgba(255,68,68,0.40)' : 'rgba(255,255,255,0.08)'}`,
            color: '#ddd', fontFamily: '"Chakra Petch", sans-serif', fontSize: '13px',
            letterSpacing: '1px', outline: 'none',
          }}
        />
        {manualError && (
          <div style={{
            color: '#ff8888', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px',
          }}>
            ✕ {manualError}
          </div>
        )}
      </div>
    );
  }

  // ── Generator mode ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <label style={{
          color: '#777', fontFamily: '"Share Tech Mono", monospace', fontSize: '10px',
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          CALLSIGN
          {round > 0 && (
            <span style={{ marginLeft: '8px', color: '#555' }}>
              — ROUND {round}/{MAX_ROUNDS}
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setManual(true)}
          disabled={disabled}
          style={ghostBtn}
        >
          WRITE OWN →
        </button>
      </div>

      {round === 0 ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled}
          style={primaryBtn}
        >
          ⚡ GENERATE CALLSIGNS
        </button>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
          }}>
            {options.map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handlePick(opt)}
                  disabled={disabled}
                  style={{
                    padding: '14px 12px',
                    background: selected ? 'rgba(255,68,68,0.10)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selected ? 'rgba(255,68,68,0.50)' : 'rgba(255,255,255,0.06)'}`,
                    color: selected ? '#ff4444' : '#ddd',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '2px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selected ? '● ' : ''}{opt}
                </button>
              );
            })}
          </div>
          {round < MAX_ROUNDS ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={disabled}
              style={secondaryBtn}
            >
              ↻ REGENERATE — {MAX_ROUNDS - round} {MAX_ROUNDS - round === 1 ? 'TRY' : 'TRIES'} LEFT
            </button>
          ) : (
            <div style={{
              padding: '8px 12px', textAlign: 'center',
              color: '#666', fontFamily: '"Share Tech Mono", monospace', fontSize: '11px',
              letterSpacing: '1px',
            }}>
              NO MORE GENERATOR TRIES — PICK ABOVE OR <button
                type="button"
                onClick={() => setManual(true)}
                disabled={disabled}
                style={{ ...inlineLinkBtn, marginLeft: '4px' }}
              >WRITE YOUR OWN</button>
            </div>
          )}
        </>
      )}

      {value && !options.includes(value) && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(0,255,65,0.06)',
          border: '1px solid rgba(0,255,65,0.20)',
          color: '#5f5',
          fontFamily: '"Share Tech Mono", monospace', fontSize: '11px',
          letterSpacing: '1px',
        }}>
          ✓ SELECTED: {value}
        </div>
      )}
    </div>
  );
}

// Shared button styles — kept as exported constants so the two modes
// (generator + manual) stay visually consistent without duplicating
// the property bag.
const primaryBtn: React.CSSProperties = {
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
  border: 'none',
  color: '#fff',
  fontFamily: '"Orbitron", sans-serif',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '2px',
  cursor: 'pointer',
  boxShadow: '0 0 12px rgba(255,68,68,0.20)',
};
const secondaryBtn: React.CSSProperties = {
  padding: '10px 14px',
  background: 'rgba(255,68,68,0.06)',
  border: '1px solid rgba(255,68,68,0.20)',
  color: '#ff8888',
  fontFamily: '"Chakra Petch", sans-serif',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '1px',
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#888',
  fontFamily: '"Share Tech Mono", monospace',
  fontSize: '10px',
  letterSpacing: '1px',
  cursor: 'pointer',
};
const inlineLinkBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#ff8888',
  fontFamily: '"Share Tech Mono", monospace',
  fontSize: '11px',
  letterSpacing: '1px',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
};
