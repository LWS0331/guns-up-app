// Self-report readiness scoring — the graceful fallback when no
// objective wearable signals are available.
//
// Both the autoregulation engine (src/lib/readiness.ts) and the
// recovery readout (api/gunny/recovery-readout) lean on this so a
// missing / disconnected wearable degrades to the operator's own
// check-in (dailyReadiness[today]) or stored profile sliders instead of
// blanking the recommendation entirely. Pure + synchronous so it's
// unit-testable without a DB.
//
// Scale handling: `stress`, `readiness`, and `energy` are 1-10 sliders.
// `sleep` is stored as hours on profile (0-24) but as a quality-ish
// value on some check-ins; both land in a similar bucket for typical
// nights (5-9), so we normalize it on a /10-style curve — good enough
// for a coarse self-report signal, and consistent with how the
// recovery readout already surfaced profile.sleep as "/10".

export interface SelfReportInputs {
  /** Hours slept, or a 1-10 quality value. Normalized on a /10 curve. */
  sleep?: number | null;
  /** 1-10 perceived stress — higher is worse. */
  stress?: number | null;
  /** 1-10 self-rated readiness. */
  readiness?: number | null;
  /** 1-10 energy. */
  energy?: number | null;
}

export interface SelfReportSignal {
  key: 'readiness' | 'sleep' | 'stress' | 'energy';
  label: string;
  /** Human-readable value, e.g. "7/10". */
  value: string;
  /** Normalized 0-1 contribution (1 = best). */
  norm: number;
  signal: 'good' | 'warn' | 'bad';
}

export interface SelfReportResult {
  /** True when at least one usable self-report field was present. */
  usable: boolean;
  /** 0-100 composite (mean of available normalized signals × 100). */
  score: number;
  signals: SelfReportSignal[];
}

function num(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function signalFor(norm: number): 'good' | 'warn' | 'bad' {
  return norm >= 0.7 ? 'good' : norm >= 0.5 ? 'warn' : 'bad';
}

/**
 * Compute a 0-100 self-report readiness composite from whatever subset
 * of sliders is present. Returns `usable: false` when nothing scorable
 * was supplied so callers can fall through to a deeper fallback.
 */
export function computeSelfReportScore(input: SelfReportInputs): SelfReportResult {
  const signals: SelfReportSignal[] = [];

  const readiness = num(input.readiness);
  if (readiness != null) {
    const norm = clamp01(readiness / 10);
    signals.push({
      key: 'readiness',
      label: 'Self-rated readiness',
      value: `${readiness}/10`,
      norm,
      signal: signalFor(norm),
    });
  }

  const sleep = num(input.sleep);
  if (sleep != null) {
    // Treat on a /10 curve; hours (5-9) and quality (1-10) both land
    // sensibly here. Cap at 1 so a 9h night doesn't over-weight.
    const norm = clamp01(sleep / 9);
    signals.push({
      key: 'sleep',
      label: 'Sleep (self-report)',
      value: sleep > 12 ? `${sleep}` : sleep <= 10 && Number.isInteger(sleep) ? `${sleep}/10` : `${sleep.toFixed(1)}h`,
      norm,
      signal: signalFor(norm),
    });
  }

  const stress = num(input.stress);
  if (stress != null) {
    // High stress = low readiness. 1 → 1.0, 10 → 0.0.
    const norm = clamp01((10 - stress) / 9);
    signals.push({
      key: 'stress',
      label: 'Stress level',
      value: `${stress}/10`,
      norm,
      signal: signalFor(norm),
    });
  }

  const energy = num(input.energy);
  if (energy != null) {
    const norm = clamp01(energy / 10);
    signals.push({
      key: 'energy',
      label: 'Energy',
      value: `${energy}/10`,
      norm,
      signal: signalFor(norm),
    });
  }

  if (signals.length === 0) {
    return { usable: false, score: 0, signals: [] };
  }

  const mean = signals.reduce((s, f) => s + f.norm, 0) / signals.length;
  return { usable: true, score: Math.round(mean * 100), signals };
}

/**
 * Pull self-report inputs from an operator record: today's check-in
 * (dailyReadiness[today]) takes precedence over the stored profile
 * sliders. Returns the merged inputs + which source supplied them.
 */
export function readSelfReportInputs(
  operator: { profile?: unknown; intake?: unknown; dailyReadiness?: unknown } | null | undefined,
  today: string,
): { inputs: SelfReportInputs; source: 'check_in' | 'profile' | 'none' } {
  if (!operator) return { inputs: {}, source: 'none' };

  const readiness = (operator.dailyReadiness || {}) as Record<string, unknown>;
  const entry = readiness[today] as Record<string, unknown> | undefined;
  if (entry && typeof entry === 'object') {
    const inputs: SelfReportInputs = {
      sleep: num(entry.sleep),
      stress: num(entry.stress),
      readiness: num(entry.readiness),
      energy: num(entry.energy),
    };
    if (inputs.sleep != null || inputs.stress != null || inputs.readiness != null || inputs.energy != null) {
      return { inputs, source: 'check_in' };
    }
  }

  const profile = (operator.profile || {}) as Record<string, unknown>;
  const intake = (operator.intake || {}) as Record<string, unknown>;
  const inputs: SelfReportInputs = {
    sleep: num(profile.sleep) ?? num(intake.sleepQuality),
    stress: num(profile.stress) ?? num(intake.stressLevel),
    readiness: num(profile.readiness),
  };
  if (inputs.sleep != null || inputs.stress != null || inputs.readiness != null) {
    return { inputs, source: 'profile' };
  }

  return { inputs: {}, source: 'none' };
}
