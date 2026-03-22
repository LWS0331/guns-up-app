import { NextResponse } from 'next/server';
import pg from 'pg';

// POST /api/migrate — create tables if they don't exist
// This is a one-time migration endpoint for when prisma db push didn't run during build
export async function POST() {
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
      { name: 'betaStartDate', type: 'TEXT' },
      { name: 'betaEndDate', type: 'TEXT' },
      { name: 'isVanguard', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'tierLocked', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'promoActive', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'promoType', type: 'TEXT' },
      { name: 'promoExpiry', type: 'TEXT' },
    ];
    for (const col of newColumns) {
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE "Operator" ADD COLUMN "${col.name}" ${col.type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

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

    return NextResponse.json({ ok: true, message: 'Tables created successfully (Operator, ChatHistory, WearableConnection)' });
  } catch (error) {
    await pool.end();
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
