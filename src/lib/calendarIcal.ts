// iCal-URL parsing + fetch — Phase 2 of the calendar rollout.
//
// Apple Calendar, Outlook (and anything else that publishes a public
// .ics / webcal URL) can be subscribed to without OAuth. The operator
// pastes the URL into the app and we fetch + parse it on the same
// cadence as the Google sync, dropping events into the same
// CalendarConnection.syncData shape so the rest of the pipeline
// (calendarSignals.getCalendarSignals → renderCalendarForPrompt →
// dailyOpsGenerator) is provider-agnostic.
//
// SSRF protection: this module fetches an operator-controlled URL
// from the server. Without guards a malicious operator could point
// us at metadata endpoints (169.254.169.254 — cloud IMDS), our own
// internal services, or other private hosts. The guards below:
//   1. Force https (or webcal://, which we rewrite to https://)
//   2. Block hostnames that resolve to loopback / link-local /
//      RFC1918 / shared-CG-NAT / unique-local-IPv6 ranges
//   3. Cap response body at 5 MB and connect/read timeout at 10s
//
// What we do NOT do (yet):
//   - RRULE expansion. Most public .ics feeds publish a window of
//     expanded instances rather than master+rrule, so the common case
//     works without expansion. A future Phase 2.1 can wire in
//     node-ical's rrule expansion or rrule.js directly.
//   - EXDATE / RDATE / overrides. Same rationale.
//   - VTODO / VJOURNAL — only VEVENT is consumed.

import { promises as dns } from 'node:dns';
// node-ical re-exports `parseICS` as a sync parser. We don't use its
// `fromURL` helper because we want our own fetch with SSRF guards.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import ical from 'node-ical';

export const ICAL_SYNC_WINDOW_DAYS = 7;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export interface NormalizedIcalEvent {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

export interface IcalFetchResult {
  events: NormalizedIcalEvent[];
  /** Inclusive ISO timestamp for the window start (now). */
  windowStart: string;
  /** Exclusive ISO timestamp for the window end (+ICAL_SYNC_WINDOW_DAYS). */
  windowEnd: string;
}

export class IcalFetchError extends Error {
  readonly code:
    | 'invalid_url'
    | 'blocked_host'
    | 'fetch_failed'
    | 'too_large'
    | 'parse_failed'
    | 'timeout';
  constructor(
    code: IcalFetchError['code'],
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

/**
 * Normalize a user-provided URL: accept webcal:// and rewrite to
 * https://; require https for everything else. Returns null when the
 * URL is unusable so callers can produce a structured 400.
 */
function normalizeIcalUrl(raw: string): URL | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  // webcal://host/path → https://host/path (webcal is the legacy
  // calendar-subscribe scheme Apple ships in share sheets).
  if (/^webcal:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate.slice('webcal://'.length);
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Reject hostnames whose A/AAAA resolves into any private/loopback
 * range. Done at fetch time, not URL-validation time, so DNS
 * rebinding (host swaps IP between check and connect) is harder —
 * we then pass `signal` to abort if anything is off. Not a full SSRF
 * defense (would need raw socket control to match the resolved IP
 * against connect), but blocks the common cases.
 */
async function assertHostIsPublic(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    throw new IcalFetchError('blocked_host', 'localhost not allowed');
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new IcalFetchError('blocked_host', 'DNS resolution failed');
  }
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new IcalFetchError(
        'blocked_host',
        'resolved address is private/loopback/link-local',
      );
    }
  }
}

function isPrivateIp(addr: string): boolean {
  // IPv4 private + loopback + link-local + shared CG-NAT
  if (/^127\./.test(addr)) return true;
  if (/^10\./.test(addr)) return true;
  if (/^192\.168\./.test(addr)) return true;
  if (/^169\.254\./.test(addr)) return true; // link-local + AWS IMDS
  if (/^0\./.test(addr)) return true;
  const m172 = addr.match(/^172\.(\d+)\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return true; // 172.16/12
  }
  const m100 = addr.match(/^100\.(\d+)\./);
  if (m100) {
    const n = Number(m100[1]);
    if (n >= 64 && n <= 127) return true; // 100.64/10 CG-NAT
  }
  // IPv6: ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local
  if (addr === '::1') return true;
  if (/^fc/i.test(addr) || /^fd/i.test(addr)) return true;
  if (/^fe[89ab]/i.test(addr)) return true;
  return false;
}

async function fetchIcalBody(url: URL): Promise<string> {
  await assertHostIsPublic(url.hostname);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      // Some webcal publishers (Apple) require a specific UA before
      // returning the .ics body; a generic UA is fine and avoids the
      // "<!DOCTYPE html>" landing page returned to anonymous browsers.
      headers: { 'User-Agent': 'GunsUp-Calendar-Sync/1.0 (+https://gunnyai.fit)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new IcalFetchError('timeout', 'request timed out');
    }
    throw new IcalFetchError('fetch_failed', (err as Error).message || 'fetch error');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new IcalFetchError('fetch_failed', `HTTP ${res.status}`);
  }
  const lenHeader = res.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    throw new IcalFetchError('too_large', `body > ${MAX_BODY_BYTES} bytes`);
  }
  const text = await res.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new IcalFetchError('too_large', `body > ${MAX_BODY_BYTES} bytes (after read)`);
  }
  return text;
}

interface IcalVEvent {
  type?: string;
  uid?: string;
  summary?: string;
  start?: Date;
  end?: Date;
  datetype?: 'date' | 'date-time';
  location?: string;
  status?: string;
  transparency?: string;
}

/**
 * Parse an .ics body into normalized events filtered to the
 * fetch-time-anchored sync window.
 */
function normalizeIcalBody(body: string): IcalFetchResult {
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(
    now.getTime() + ICAL_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  let parsed: Record<string, IcalVEvent>;
  try {
    parsed = ical.parseICS(body) as unknown as Record<string, IcalVEvent>;
  } catch (err) {
    throw new IcalFetchError('parse_failed', (err as Error).message || 'parse error');
  }
  const out: NormalizedIcalEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const e = parsed[key];
    if (!e || e.type !== 'VEVENT') continue;
    if (e.status && e.status.toUpperCase() === 'CANCELLED') continue;
    // TRANSP:TRANSPARENT == "show as free" → not blocking
    if (e.transparency && e.transparency.toUpperCase() === 'TRANSPARENT') continue;
    const title = (e.summary || '').toString().trim();
    if (!title) continue;
    if (!(e.start instanceof Date) || !(e.end instanceof Date)) continue;
    const start = e.start;
    const end = e.end;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    // Window filter: event must end after windowStart and start before windowEnd.
    const startMs = start.getTime();
    const endMs = end.getTime();
    const winStartMs = now.getTime();
    const winEndMs = winStartMs + ICAL_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (endMs <= winStartMs) continue;
    if (startMs >= winEndMs) continue;
    const allDay = e.datetype === 'date';
    const normalized: NormalizedIcalEvent = {
      title,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      allDay,
    };
    if (typeof e.location === 'string' && e.location.trim()) {
      normalized.location = e.location.trim();
    }
    out.push(normalized);
  }
  out.sort((a, b) => a.startISO.localeCompare(b.startISO));
  return { events: out, windowStart, windowEnd };
}

/**
 * End-to-end: validate URL, fetch with SSRF guards, parse, normalize.
 * Throws IcalFetchError on any failure — caller maps the .code field
 * onto a structured response.
 */
export async function fetchAndParseIcal(rawUrl: string): Promise<IcalFetchResult> {
  const url = normalizeIcalUrl(rawUrl);
  if (!url) {
    throw new IcalFetchError(
      'invalid_url',
      'URL must be https:// or webcal:// and parse as a valid URL',
    );
  }
  const body = await fetchIcalBody(url);
  return normalizeIcalBody(body);
}
