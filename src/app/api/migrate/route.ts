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

    await pool.end();

    return NextResponse.json({ ok: true, message: 'Tables created successfully' });
  } catch (error) {
    await pool.end();
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
