import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'crypto';

// Verify webhook signature from Junction/Vital.
// Fails closed: if no secret is configured in a deployed (non-dev) environment,
// reject the request. In local dev, unsigned webhooks are only accepted when the
// operator explicitly opts in via ALLOW_UNSIGNED_WEBHOOKS=true so staging cannot
// silently accept spoofed events.
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.VITAL_WEBHOOK_SECRET;

  if (!secret) {
    const allowUnsigned =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true';
    if (!allowUnsigned) {
      console.warn('[wearables/webhook] VITAL_WEBHOOK_SECRET not set — rejecting request');
    }
    return allowUnsigned;
  }

  if (!signature) return false;

  // timingSafeEqual throws if buffers differ in length — guard to return false instead
  // so a short/malformed signature from an attacker doesn't surface as a 500.
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(
    crypto.createHmac('sha256', secret).update(payload).digest('hex'),
  );
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

// POST /api/wearables/webhook — Receive Junction/Vital webhook events
// Events: provider.connection.created, daily.data.sleep.created, daily.data.activity.created, etc.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-vital-signature') || req.headers.get('svix-signature');

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.event_type;
    const data = body.data;
    const clientUserId = body.client_user_id; // "guns-up-{operatorId}"
    const vitalUserId = body.user_id;

    console.log(`[Webhook] ${eventType} for user ${clientUserId}`);

    // Extract operatorId from client_user_id
    const operatorId = clientUserId?.replace('guns-up-', '') || null;

    if (!operatorId) {
      console.warn('[Webhook] Could not extract operatorId from:', clientUserId);
      return NextResponse.json({ ok: true }); // Still return 200 to prevent retries
    }

    // Handle provider connection events
    if (eventType === 'provider.connection.created') {
      const provider = data?.provider || 'unknown';
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

      // Upsert wearable connection record
      const existing = await prisma.wearableConnection.findFirst({
        where: { operatorId, provider },
      });

      if (existing) {
        await prisma.wearableConnection.update({
          where: { id: existing.id },
          data: { active: true, connectedAt: new Date(), vitalUserId },
        });
      } else {
        await prisma.wearableConnection.create({
          data: {
            operatorId,
            vitalUserId,
            provider,
            providerName,
            active: true,
          },
        });
      }

      console.log(`[Webhook] Connected ${provider} for operator ${operatorId}`);
      return NextResponse.json({ ok: true, action: 'connection_recorded' });
    }

    // Handle daily data events — auto-update sync data
    if (eventType?.startsWith('daily.data.') || eventType?.startsWith('historical.data.')) {
      const resource = eventType.split('.')[2]; // sleep, activity, body, etc.

      // Find operator's wearable connection
      const connection = await prisma.wearableConnection.findFirst({
        where: { operatorId, active: true },
      });

      if (connection) {
        const currentSyncData = (connection.syncData as Record<string, unknown>) || {};

        // Update the relevant data section
        if (resource === 'sleep' && data) {
          const secondsToHours = (sec: number) => Math.round((sec / 3600) * 10) / 10;
          currentSyncData.sleep = {
            date: data.calendar_date,
            duration: secondsToHours(data.duration || 0),
            deep: secondsToHours(data.deep || 0),
            light: secondsToHours(data.light || 0),
            rem: secondsToHours(data.rem || 0),
            awake: secondsToHours(data.awake || 0),
            efficiency: data.efficiency ? Math.round(data.efficiency * 100) : null,
            hrAverage: data.hr_average || null,
            provider: data.source?.provider || 'unknown',
          };

          // Also update operator profile readiness/sleep
          const sleepHours = secondsToHours(data.duration || 0);
          const sleepScore = Math.min(10, Math.round(sleepHours / 0.8));
          let readiness = 70;
          if (sleepHours >= 7) readiness += 10;
          else if (sleepHours >= 6) readiness += 5;
          else readiness -= 10;
          if (data.efficiency && data.efficiency > 0.85) readiness += 10;

          const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
          if (operator) {
            const profile = (operator.profile as Record<string, unknown>) || {};
            await prisma.operator.update({
              where: { id: operatorId },
              data: {
                profile: JSON.parse(JSON.stringify({
                  ...profile,
                  readiness: Math.max(20, Math.min(100, readiness)),
                  sleep: sleepScore,
                })),
              },
            });
          }
        }

        if (resource === 'activity' && data) {
          currentSyncData.activity = {
            date: data.calendar_date,
            steps: data.steps || 0,
            caloriesTotal: Math.round(data.calories_total || 0),
            caloriesActive: Math.round(data.calories_active || 0),
            heartRate: data.heart_rate || null,
            provider: data.source?.provider || 'unknown',
          };
        }

        if (resource === 'body' && data) {
          const kgToLbs = (kg: number) => Math.round(kg * 2.20462);
          currentSyncData.body = {
            date: data.calendar_date,
            weight: data.weight ? kgToLbs(data.weight) : null,
            bodyFat: data.fat || null,
            provider: data.source?.provider || 'unknown',
          };

          // Update operator profile weight/body fat
          const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
          if (operator && data.weight) {
            const profile = (operator.profile as Record<string, unknown>) || {};
            const updates: Record<string, unknown> = { ...profile };
            if (data.weight) updates.weight = kgToLbs(data.weight);
            if (data.fat) updates.bodyFat = data.fat;
            await prisma.operator.update({
              where: { id: operatorId },
              data: { profile: JSON.parse(JSON.stringify(updates)) },
            });
          }
        }

        currentSyncData.lastSync = new Date().toISOString();

        await prisma.wearableConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            syncData: JSON.parse(JSON.stringify(currentSyncData)),
          },
        });
      }

      console.log(`[Webhook] Updated ${resource} data for operator ${operatorId}`);
      return NextResponse.json({ ok: true, action: `${resource}_updated` });
    }

    // Unknown event type — acknowledge anyway
    console.log(`[Webhook] Unhandled event type: ${eventType}`);
    return NextResponse.json({ ok: true, action: 'ignored' });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Always return 200 to prevent Junction from retrying
    return NextResponse.json({ ok: false, error: String(error) });
  }
}
