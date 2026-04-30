import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

// POST /api/migrate — create tables if they don't exist
// This is a one-time migration endpoint for when prisma db push didn't run during build.
// Requires ADMIN_SECRET in the `x-admin-secret` header. Query-param support was
// removed so the secret never appears in access/proxy logs.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'No DATABASE_URL configured' }, { status: 500 });
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    // Create Operator table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Operator" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "callsign" TEXT NOT NULL,
        "pin" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "tier" TEXT NOT NULL,
        "coupleWith" TEXT,
        "trainerId" TEXT,
        "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "trainerNotes" TEXT,
        "betaUser" BOOLEAN NOT NULL DEFAULT false,
        "betaFeedback" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "profile" JSONB NOT NULL DEFAULT '{}',
        "nutrition" JSONB NOT NULL DEFAULT '{}',
        "prs" JSONB NOT NULL DEFAULT '[]',
        "injuries" JSONB NOT NULL DEFAULT '[]',
        "preferences" JSONB NOT NULL DEFAULT '{}',
        "workouts" JSONB NOT NULL DEFAULT '{}',
        "dayTags" JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add new beta/promo columns to Operator (safe to run multiple times — IF NOT EXISTS not needed, ALTER ADD handles gracefully)
    const newColumns = [
      { name: 'email', type: 'TEXT UNIQUE' },
      { name: 'passwordHash', type: 'TEXT' },
      { name: 'googleId', type: 'TEXT UNIQUE' },
      { name: 'betaStartDate', type: 'TEXT' },
      { name: 'betaEndDate', type: 'TEXT' },
      { name: 'isVanguard', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'tierLocked', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'promoActive', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'promoType', type: 'TEXT' },
      { name: 'promoExpiry', type: 'TEXT' },
      { name: 'intake', type: "JSONB NOT NULL DEFAULT '{}'" },
      { name: 'sitrep', type: "JSONB NOT NULL DEFAULT '{}'" },
      { name: 'dailyBrief', type: "JSONB NOT NULL DEFAULT '{}'" },
      { name: 'billing', type: "JSONB NOT NULL DEFAULT '{}'" },
      // Junior Operator (gated, see featureFlags + JuniorIntakeForm)
      { name: 'isJunior', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'juniorAge', type: 'INTEGER' },
      { name: 'parentIds', type: 'TEXT[] DEFAULT ARRAY[]::TEXT[]' },
      { name: 'sportProfile', type: "JSONB NOT NULL DEFAULT '{}'" },
      { name: 'juniorConsent', type: "JSONB NOT NULL DEFAULT '{}'" },
      { name: 'juniorSafety', type: "JSONB NOT NULL DEFAULT '{}'" },
      // Pricing v2 — Free RECON usage caps
      { name: 'reconChatsCount', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'reconChatsResetAt', type: 'TIMESTAMP(3)' },
      { name: 'reconWorkoutsCount', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'reconWorkoutsResetAt', type: 'TIMESTAMP(3)' },
      // Activation Flow tracking (PaywallSpec §8)
      { name: 'webPurchaseAt', type: 'TIMESTAMP(3)' },
      { name: 'firstAppOpenAt', type: 'TIMESTAMP(3)' },
      { name: 'firstWorkoutCompletedAt', type: 'TIMESTAMP(3)' },
      { name: 'activationEmailsSent', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'lastActivationEmailAt', type: 'TIMESTAMP(3)' },
      { name: 'passwordResetRequestedAt', type: 'TIMESTAMP(3)' },
      { name: 'recoveryAttempts', type: 'INTEGER NOT NULL DEFAULT 0' },
      // Tier-1 chat-driven channels (Apr 2026, PR #93). Daily readiness
      // check-ins from Gunny's <readiness_json> channel land here. Without
      // this column the channel writes silently fail at the DB layer.
      { name: 'dailyReadiness', type: "JSONB NOT NULL DEFAULT '{}'" },
    ];
    for (const col of newColumns) {
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE "Operator" ADD COLUMN "${col.name}" ${col.type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

    // Indexes for new columns (idempotent — IF NOT EXISTS).
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "Operator_webPurchaseAt_firstAppOpenAt_idx"
      ON "Operator"("webPurchaseAt", "firstAppOpenAt");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "Operator_isJunior_idx"
      ON "Operator"("isJunior");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "Operator_parentIds_idx"
      ON "Operator" USING GIN ("parentIds");
    `);

    // === AuthToken table — Pricing v2 / Activation Flow ===
    // Single-use tokens for web_handoff / magic_link / password_reset.
    // See src/lib/authTokens.ts for the contract.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "AuthToken" (
        "id" TEXT NOT NULL,
        "operatorId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "intent" TEXT,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "used" BOOLEAN NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP(3),
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "AuthToken_operatorId_idx"
      ON "AuthToken"("operatorId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "AuthToken_expiresAt_idx"
      ON "AuthToken"("expiresAt");
    `);

    // === TrainerApplication table (idempotent — may already exist) ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "TrainerApplication" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "callsign" TEXT,
        "yearsCertified" INTEGER NOT NULL,
        "currentClientCount" INTEGER NOT NULL,
        "primaryDiscipline" TEXT NOT NULL,
        "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "whyGunsUp" TEXT NOT NULL,
        "sampleProgramming" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewNotes" TEXT,
        "ip" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TrainerApplication_pkey" PRIMARY KEY ("id")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "TrainerApplication_status_idx"
      ON "TrainerApplication"("status");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "TrainerApplication_email_idx"
      ON "TrainerApplication"("email");
    `);

    // Create ChatHistory table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ChatHistory" (
        "id" TEXT NOT NULL,
        "operatorId" TEXT NOT NULL,
        "chatType" TEXT NOT NULL,
        "messages" JSONB NOT NULL DEFAULT '[]',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create unique index on ChatHistory
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ChatHistory_operatorId_chatType_key"
      ON "ChatHistory"("operatorId", "chatType");
    `);

    // Create WearableConnection table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "WearableConnection" (
        "id" TEXT NOT NULL,
        "operatorId" TEXT NOT NULL,
        "vitalUserId" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerName" TEXT NOT NULL,
        "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastSyncAt" TIMESTAMP(3),
        "syncData" JSONB NOT NULL DEFAULT '{}',
        "active" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "WearableConnection_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create indexes for WearableConnection
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "WearableConnection_operatorId_provider_key"
      ON "WearableConnection"("operatorId", "provider");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "WearableConnection_operatorId_idx"
      ON "WearableConnection"("operatorId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "WearableConnection_vitalUserId_idx"
      ON "WearableConnection"("vitalUserId");
    `);

    await pool.end();

    return NextResponse.json({
      ok: true,
      message: 'Schema synced (Operator, ChatHistory, WearableConnection, AuthToken, TrainerApplication) — Pricing v2 + Activation Flow columns applied.',
    });
  } catch (error) {
    await pool.end();
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
