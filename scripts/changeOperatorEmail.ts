/**
 * One-off: change the login email on a single Operator record.
 *
 * The `Operator.email` column is the source of truth for email/password
 * login, magic-link recovery, and the closed-beta allowlist (see
 * src/lib/allowlist.ts). It is NOT defined in src/data/operators.ts for
 * existing rows — the seed only sets email on first create and the
 * force-update path intentionally excludes it — so the only way to change
 * a live account's login address is a direct DB write like this one (the
 * runtime equivalent of POST /api/admin/set-emails).
 *
 * Usage (run against the PRODUCTION database):
 *
 *   DATABASE_URL=... npx tsx scripts/changeOperatorEmail.ts <operatorId> <newEmail>
 *
 * Example — move Ruben's login from the old hirewithfox.com address to
 * the lonewolfsearch.com one:
 *
 *   DATABASE_URL=... npx tsx scripts/changeOperatorEmail.ts op-ruben ruben@lonewolfsearch.com
 *
 * The script:
 *   - normalizes the new email (trim + lowercase) and validates its format,
 *     matching /api/admin/set-emails exactly;
 *   - prints the operator's current email before changing anything;
 *   - refuses the write if another operator already owns the target email
 *     (the `email` column is @unique), surfacing who holds it;
 *   - is idempotent — if the operator already has the target email it
 *     reports "no change" and exits 0.
 *
 * It changes exactly one row and nothing else. Safe to re-run.
 */

import { prisma } from '../src/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main(): Promise<void> {
  const [operatorId, rawEmail] = process.argv.slice(2);

  if (!operatorId || !rawEmail) {
    console.error(
      'Usage: DATABASE_URL=... npx tsx scripts/changeOperatorEmail.ts <operatorId> <newEmail>',
    );
    process.exit(2);
  }

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    console.error(`Invalid email format: ${rawEmail}`);
    process.exit(2);
  }

  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, callsign: true, email: true },
  });
  if (!op) {
    console.error(`Operator not found: ${operatorId}`);
    process.exit(1);
  }

  console.log(`Operator:    ${op.id} (${op.callsign})`);
  console.log(`Current email: ${op.email ?? '(none)'}`);
  console.log(`New email:     ${email}`);

  if (op.email === email) {
    console.log('No change — operator already has this email. Done.');
    return;
  }

  // The email column is @unique; surface a collision instead of throwing
  // on the constraint.
  const collision = await prisma.operator.findFirst({
    where: { email, id: { not: operatorId } },
    select: { id: true, callsign: true },
  });
  if (collision) {
    console.error(
      `Email already owned by ${collision.id} (${collision.callsign}). ` +
        'Free it from that account first, then re-run.',
    );
    process.exit(1);
  }

  await prisma.operator.update({
    where: { id: operatorId },
    data: { email },
  });

  console.log('Updated. Login email changed successfully.');
}

main()
  .catch((err) => {
    console.error('changeOperatorEmail failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
