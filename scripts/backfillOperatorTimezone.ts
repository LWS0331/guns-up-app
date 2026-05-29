/**
 * One-off backfill: set `profile.timezone` to America/Los_Angeles for every
 * operator that doesn't already have one set. Idempotent — operators with
 * a real stored timezone (set explicitly by them) are skipped, never
 * overwritten.
 *
 * Run once after deploying the timezone correctness PR:
 *
 *   DATABASE_URL=... npx tsx scripts/backfillOperatorTimezone.ts
 *
 * The script prints a summary (scanned / backfilled / skipped) and exits 0.
 * It's safe to run repeatedly — re-runs after the first will report 0
 * backfilled because every operator already has a timezone.
 */

import { prisma } from '../src/lib/db';
import { APP_TIMEZONE } from '../src/lib/dateUtils';

async function main(): Promise<void> {
  const operators = await prisma.operator.findMany({
    select: { id: true, callsign: true, profile: true },
  });

  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;
  const skippedSamples: Array<{ id: string; tz: string }> = [];

  for (const op of operators) {
    scanned += 1;
    const profile = (op.profile as Record<string, unknown> | null) ?? {};
    const existing = profile.timezone;
    if (typeof existing === 'string' && existing.length > 0) {
      skipped += 1;
      if (skippedSamples.length < 5) {
        skippedSamples.push({ id: op.id, tz: existing });
      }
      continue;
    }
    await prisma.operator.update({
      where: { id: op.id },
      data: {
        profile: { ...profile, timezone: APP_TIMEZONE },
      },
    });
    backfilled += 1;
  }

  console.log(`Scanned:     ${scanned}`);
  console.log(`Backfilled:  ${backfilled}  → ${APP_TIMEZONE}`);
  console.log(`Skipped:     ${skipped}  (already had a timezone set)`);
  if (skippedSamples.length > 0) {
    console.log(`Skipped sample:`);
    for (const s of skippedSamples) {
      console.log(`  - ${s.id}: ${s.tz}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
