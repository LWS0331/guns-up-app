// /api/cron/daily-ops-pregen — Overnight pre-generation. Phase 2C.
//
// Walks every Commander operator (and every junior whose linked
// parent is Commander). For each:
//   1. Skip if a plan already exists for the target date (idempotent
//      — safe to retry).
//   2. Skip if the operator hasn't logged in in 14+ days (no point
//      generating for someone inactive; cuts API spend).
//   3. Generate via dailyOpsGenerator.generateDailyOpsPlan().
//
// Auth: Bearer CRON_SECRET via shared requireCronAuth helper.
//
// Recommended schedule: 21:00 LOCAL operator time. Since Railway's
// cron is UTC and operators span timezones, we either:
//   - run hourly and emit per-operator "is it 9pm local?" filtering, OR
//   - run once per UTC hour and let the per-operator check decide.
// The latter is simpler and what we do here. The route accepts an
// optional ?targetDate=YYYY-MM-DD override for backfills.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cronAuth';
import { hasCommanderAccess } from '@/lib/tierGates';
import { generateDailyOpsPlan } from '@/lib/dailyOpsGenerator';

const INACTIVE_THRESHOLD_DAYS = 14;
const TARGET_LOCAL_HOUR = 21; // 9 PM local

/**
 * Compute "is it currently 21:00 local for this operator?". Returns
 * true if the operator's local clock is within ±30 min of the target
 * hour. The cron runs hourly so a ±30 min window prevents missed
 * operators on hour boundaries.
 *
 * If the operator's profile.timezone isn't set, we fall back to UTC
 * which means we'll generate for them when the UTC clock hits the
 * target hour. Acceptable degraded behavior.
 */
function isLocalHourTarget(
  utcNow: Date,
  timezone: string | undefined,
  targetHour = TARGET_LOCAL_HOUR,
): boolean {
  let hour: number;
  try {
    if (timezone) {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      });
      hour = Number(fmt.format(utcNow));
    } else {
      hour = utcNow.getUTCHours();
    }
  } catch {
    hour = utcNow.getUTCHours();
  }
  // Hourly cron — same hour as the target counts; ±0 because the
  // cron fires at the top of the hour and we want to capture the
  // 21:00 hour, not 20:30 or 21:30.
  return hour === targetHour;
}

/**
 * Compute the operator's local "tomorrow" YYYY-MM-DD. If timezone
 * unset, use UTC tomorrow.
 */
function localTomorrow(utcNow: Date, timezone: string | undefined): string {
  try {
    if (timezone) {
      const tomorrow = new Date(utcNow.getTime() + 24 * 60 * 60 * 1000);
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return fmt.format(tomorrow); // 'YYYY-MM-DD'
    }
  } catch {
    // fall through to UTC
  }
  const utcTomorrow = new Date(utcNow.getTime() + 24 * 60 * 60 * 1000);
  return utcTomorrow.toISOString().slice(0, 10);
}

interface PregenSummary {
  scanned: number;
  generated: number;
  skipped_already_exists: number;
  skipped_inactive: number;
  skipped_not_local_target_hour: number;
  skipped_not_commander: number;
  errors: { operatorId: string; error: string }[];
}

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const overrideDate = url.searchParams.get('targetDate');
  const skipHourCheck = url.searchParams.get('skipHourCheck') === 'true';
  const onlyOperatorId = url.searchParams.get('operatorId') ?? null;

  const summary: PregenSummary = {
    scanned: 0,
    generated: 0,
    skipped_already_exists: 0,
    skipped_inactive: 0,
    skipped_not_local_target_hour: 0,
    skipped_not_commander: 0,
    errors: [],
  };

  const utcNow = new Date();
  const inactiveCutoff = new Date(
    utcNow.getTime() - INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );

  // Pull every operator + their linked parents (we'll resolve junior
  // tier via parent below). Limit fields aggressively — this scan can
  // walk thousands of rows on a busy cron tick. Activity is proxied
  // via `updatedAt` since the Operator model doesn't carry an explicit
  // lastLoginAt; trainingPath is nested in the `intake` JSON column.
  const operators = await prisma.operator.findMany({
    where: onlyOperatorId ? { id: onlyOperatorId } : undefined,
    select: {
      id: true,
      callsign: true,
      role: true,
      tier: true,
      isJunior: true,
      juniorAge: true,
      parentIds: true,
      profile: true,
      intake: true,
      sportProfile: true,
      updatedAt: true,
    },
    take: 5000,
  });

  // Pre-fetch all parent operators in one query so we don't round-trip
  // per-junior.
  const allParentIds = Array.from(
    new Set(
      operators
        .filter((o) => o.isJunior)
        .flatMap((o) => o.parentIds ?? []),
    ),
  );
  const parentMap = new Map<string, { id: string; tier: string | null; role: string }>();
  if (allParentIds.length > 0) {
    const parents = await prisma.operator.findMany({
      where: { id: { in: allParentIds } },
      select: { id: true, tier: true, role: true },
    });
    for (const p of parents) parentMap.set(p.id, p);
  }

  for (const op of operators) {
    summary.scanned++;

    // Tier check — adults need their own Commander access; juniors need
    // any linked parent at Commander.
    let isCommander = false;
    if (op.isJunior) {
      for (const pid of op.parentIds ?? []) {
        const p = parentMap.get(pid);
        if (
          p &&
          hasCommanderAccess({
            id: p.id,
            tier: p.tier ?? undefined,
            role: p.role,
          })
        ) {
          isCommander = true;
          break;
        }
      }
    } else {
      isCommander = hasCommanderAccess({
        id: op.id,
        tier: op.tier ?? undefined,
        role: op.role,
      });
    }

    if (!isCommander) {
      summary.skipped_not_commander++;
      continue;
    }

    // Activity check — Operator has no explicit lastLoginAt, so we use
    // `updatedAt` as a proxy. Any read+write on the operator (workout
    // saved, chat sent, intake update, billing webhook) bumps it.
    if (op.updatedAt < inactiveCutoff) {
      summary.skipped_inactive++;
      continue;
    }

    // Timezone-aware target-hour check
    const tzRaw = (op.profile as Record<string, unknown> | null)?.timezone;
    const tz = typeof tzRaw === 'string' ? tzRaw : undefined;
    if (!skipHourCheck && !overrideDate && !isLocalHourTarget(utcNow, tz)) {
      summary.skipped_not_local_target_hour++;
      continue;
    }

    const targetDate = overrideDate ?? localTomorrow(utcNow, tz);

    // Idempotency — skip if a plan already exists for this date.
    const existing = await prisma.dailyOpsPlan.findUnique({
      where: { operatorId_date: { operatorId: op.id, date: targetDate } },
      select: { id: true },
    });
    if (existing) {
      summary.skipped_already_exists++;
      continue;
    }

    // Generate
    const profileAge =
      typeof (op.profile as Record<string, unknown> | null)?.age === 'number'
        ? ((op.profile as Record<string, unknown>).age as number)
        : null;
    const intakePath = (op.intake as Record<string, unknown> | null)?.trainingPath;
    const trainingPath = typeof intakePath === 'string' ? intakePath : null;
    const result = await generateDailyOpsPlan({
      operatorContext: {
        operatorId: op.id,
        isJunior: op.isJunior,
        juniorAge: op.juniorAge,
        trainingPath,
        age: profileAge,
        callsign: op.callsign,
      },
      targetDate,
      reason: 'overnight_pregen',
    });

    if ('error' in result) {
      summary.errors.push({ operatorId: op.id, error: result.error });
      // eslint-disable-next-line no-console
      console.warn('[daily-ops-pregen]', op.id, result.error);
    } else {
      summary.generated++;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
