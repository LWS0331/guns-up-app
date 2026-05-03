// /api/cron/daily-ops-notify — every-5-min block-start tick. Phase 2C.
//
// Fires Web Push notifications for any DailyOpsPlan block whose
// startTime is within ±2.5 min of "now in the operator's local
// timezone". The 5-min cron interval ÷ 2 = ±2.5 min tolerance window;
// that's the "feels on time" envelope without requiring sub-minute
// cron resolution.
//
// Idempotency: we stamp the block's feedback map with a 'notified=true'
// marker so a double-tick (e.g. cron retry) doesn't double-fire.
//
// Skipped:
//   - Plans not in {active, approved} status (junior pending, rejected)
//   - Operators with notificationsOn=false on all subscriptions
//   - Block categories the operator has muted (filtered server-side
//     in sendPush helper)
//
// Auth: Bearer CRON_SECRET via shared requireCronAuth.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { requireCronAuth } from '@/lib/cronAuth';
import { sendPushToOperator } from '@/lib/sendPush';
import type {
  DailyBlock,
  BlockCategory,
  BlockFeedback,
} from '@/lib/dailyOpsTypes';

// Notification tolerance window in minutes around "now".
const TOLERANCE_MIN = 2.5;

// Per-category copy. Short and tactical so iOS / Android / desktop
// banners read cleanly without truncation.
const NOTIFY_COPY: Partial<Record<BlockCategory, { title: string; bodyTemplate: string }>> = {
  wake:                  { title: 'Wake up, Operator',     bodyTemplate: '{label}' },
  sun_exposure:          { title: 'Sun exposure',          bodyTemplate: '{label}' },
  caffeine_window_open:  { title: 'Caffeine window open',  bodyTemplate: '{label}' },
  caffeine_cutoff:       { title: 'Caffeine cutoff',       bodyTemplate: 'No more caffeine after this — {label}' },
  meal:                  { title: 'Meal time',             bodyTemplate: '{label}' },
  pre_workout_supp:      { title: 'Pre-workout supps',     bodyTemplate: '{label}' },
  workout:               { title: 'Workout window',        bodyTemplate: '{label}' },
  post_workout:          { title: 'Post-workout',          bodyTemplate: '{label}' },
  mobility:              { title: 'Mobility',              bodyTemplate: '{label}' },
  wind_down:             { title: 'Wind down',             bodyTemplate: 'Screens off — {label}' },
  pre_bed_supp:          { title: 'Pre-bed supps',         bodyTemplate: '{label}' },
  sleep_target:          { title: 'Lights out',            bodyTemplate: '{label}' },
  sauna:                 { title: 'Sauna',                 bodyTemplate: '{label}' },
  cold_exposure:         { title: 'Cold exposure',         bodyTemplate: '{label}' },
  recovery_walk:         { title: 'Recovery walk',         bodyTemplate: '{label}' },
};

function copyForBlock(b: DailyBlock): { title: string; body: string } {
  const meta = NOTIFY_COPY[b.category];
  if (!meta) return { title: 'Daily Ops', body: b.label };
  return { title: meta.title, body: meta.bodyTemplate.replace('{label}', b.label) };
}

function nowMinutesInTimezone(utcNow: Date, timezone: string | undefined): number | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone ?? 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(utcNow);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function localDateInTimezone(utcNow: Date, timezone: string | undefined): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(utcNow);
  } catch {
    return utcNow.toISOString().slice(0, 10);
  }
}

function blockMin(b: DailyBlock): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(b.startTime);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface TickSummary {
  scanned_plans: number;
  fired: number;
  already_notified: number;
  not_in_window: number;
  errors: { operatorId: string; blockId: string; error: string }[];
}

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const summary: TickSummary = {
    scanned_plans: 0,
    fired: 0,
    already_notified: 0,
    not_in_window: 0,
    errors: [],
  };

  const utcNow = new Date();

  // Pull active / approved plans for "today" in any timezone — i.e.
  // plans whose `date` is within today's UTC ±1 day. Cheap filter to
  // bound the scan; we still verify per-operator timezone below.
  const utcToday = utcNow.toISOString().slice(0, 10);
  const utcYesterday = new Date(utcNow.getTime() - 86400000).toISOString().slice(0, 10);
  const utcTomorrow = new Date(utcNow.getTime() + 86400000).toISOString().slice(0, 10);

  const candidates = await prisma.dailyOpsPlan.findMany({
    where: {
      status: { in: ['active', 'approved'] },
      date: { in: [utcYesterday, utcToday, utcTomorrow] },
    },
    select: {
      id: true,
      operatorId: true,
      date: true,
      blocks: true,
      feedback: true,
    },
    take: 5000,
  });

  // Pre-fetch operator timezones to avoid N round trips.
  const opIds = Array.from(new Set(candidates.map((p) => p.operatorId)));
  const operators = await prisma.operator.findMany({
    where: { id: { in: opIds } },
    select: { id: true, profile: true },
  });
  const tzMap = new Map<string, string | undefined>();
  for (const op of operators) {
    const tzRaw = (op.profile as Record<string, unknown> | null)?.timezone;
    tzMap.set(op.id, typeof tzRaw === 'string' ? tzRaw : undefined);
  }

  for (const plan of candidates) {
    summary.scanned_plans++;
    const tz = tzMap.get(plan.operatorId);
    const localDate = localDateInTimezone(utcNow, tz);
    if (plan.date !== localDate) continue; // skip — this plan is for another day in this operator's local clock

    const nowMin = nowMinutesInTimezone(utcNow, tz);
    if (nowMin === null) continue;

    const blocks: DailyBlock[] = Array.isArray(plan.blocks)
      ? (plan.blocks as unknown as DailyBlock[])
      : [];
    const feedback: Record<string, BlockFeedback & { notified?: boolean }> =
      plan.feedback &&
      typeof plan.feedback === 'object' &&
      !Array.isArray(plan.feedback)
        ? (plan.feedback as unknown as Record<string, BlockFeedback & { notified?: boolean }>)
        : {};

    let dirty = false;

    for (const b of blocks) {
      const bMin = blockMin(b);
      if (bMin === null) continue;
      const delta = Math.abs(bMin - nowMin);
      if (delta > TOLERANCE_MIN) {
        summary.not_in_window++;
        continue;
      }
      // Idempotency — only fire once per block per day.
      if (feedback[b.id]?.notified) {
        summary.already_notified++;
        continue;
      }

      const { title, body } = copyForBlock(b);
      try {
        const result = await sendPushToOperator(plan.operatorId, {
          title,
          body,
          url: '/plan',
          tag: `daily-ops-${plan.id}-${b.id}`,
          category: b.category,
        });
        if (result.attempted > 0) {
          summary.fired++;
        }
      } catch (err) {
        summary.errors.push({
          operatorId: plan.operatorId,
          blockId: b.id,
          error: (err as Error).message,
        });
      }

      // Stamp notified=true regardless of send success — we don't
      // want to retry-storm a flaky push service. The next regen
      // (overnight pre-gen or chat) clears the flag.
      const existing = feedback[b.id];
      feedback[b.id] = {
        followed: existing?.followed ?? 'partial',
        perceivedFit: existing?.perceivedFit,
        notes: existing?.notes,
        source: existing?.source ?? 'wearable_inferred',
        at: existing?.at ?? new Date().toISOString(),
        notified: true,
      };
      dirty = true;
    }

    if (dirty) {
      await prisma.dailyOpsPlan
        .update({
          where: { id: plan.id },
          data: { feedback: feedback as unknown as Prisma.InputJsonValue },
        })
        .catch((err: Error) => {
          summary.errors.push({
            operatorId: plan.operatorId,
            blockId: 'feedback-update',
            error: err.message,
          });
        });
    }
  }

  return NextResponse.json({ ok: true, summary });
}
