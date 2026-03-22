import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getVitalClient } from '@/lib/vital';

// Conversion helpers
const kgToLbs = (kg: number) => Math.round(kg * 2.20462);
const secondsToHours = (sec: number) => Math.round((sec / 3600) * 10) / 10;

// POST /api/wearables/sync — Pull latest health data from Junction for an operator
export async function POST(req: NextRequest) {
  try {
    const { operatorId } = await req.json();

    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    if (!process.env.VITAL_API_KEY) {
      return NextResponse.json({ error: 'Wearable integration not configured' }, { status: 503 });
    }

    // Find all active connections for this operator
    const connections = await prisma.wearableConnection.findMany({
      where: { operatorId, active: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No wearables connected' }, { status: 404 });
    }

    const vital = getVitalClient();
    const vitalUserId = connections[0].vitalUserId;

    // Date range: last 7 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Pull all available data types in parallel
    const [sleepData, activityData, bodyData] = await Promise.allSettled([
      vital.sleep.get(vitalUserId, { startDate }),
      vital.activity.get(vitalUserId, { startDate }),
      vital.body.get(vitalUserId, { startDate }),
    ]);

    // Process sleep data
    let latestSleep = null;
    const sleepArray = sleepData.status === 'fulfilled' ? (sleepData.value as unknown as { sleep?: Array<Record<string, unknown>> })?.sleep : null;
    if (sleepArray?.length) {
      const recent = sleepArray[sleepArray.length - 1];
      latestSleep = {
        date: recent.calendarDate as string,
        duration: secondsToHours(Number(recent.duration) || 0),
        deep: secondsToHours(Number(recent.deep) || 0),
        light: secondsToHours(Number(recent.light) || 0),
        rem: secondsToHours(Number(recent.rem) || 0),
        awake: secondsToHours(Number(recent.awake) || 0),
        efficiency: recent.efficiency ? Math.round(Number(recent.efficiency)) : null,
        hrAverage: recent.hrAverage ? Number(recent.hrAverage) : null,
        score: recent.score ? Number(recent.score) : null,
        provider: (recent.source as Record<string, unknown>)?.provider as string || 'unknown',
      };
    }

    // Process activity data
    let latestActivity = null;
    const activityArray = activityData.status === 'fulfilled' ? (activityData.value as unknown as { activity?: Array<Record<string, unknown>> })?.activity : null;
    if (activityArray?.length) {
      const recent = activityArray[activityArray.length - 1];
      latestActivity = {
        date: recent.calendarDate as string,
        steps: Number(recent.steps) || 0,
        caloriesTotal: Math.round(Number(recent.caloriesTotal) || 0),
        caloriesActive: Math.round(Number(recent.caloriesActive) || 0),
        distance: recent.distance ? Math.round(Number(recent.distance)) : 0,
        heartRate: recent.heartRate || null,
        provider: (recent.source as Record<string, unknown>)?.provider as string || 'unknown',
      };
    }

    // Process body data
    let latestBody = null;
    const bodyArray = bodyData.status === 'fulfilled' ? (bodyData.value as unknown as { body?: Array<Record<string, unknown>> })?.body : null;
    if (bodyArray?.length) {
      const recent = bodyArray[bodyArray.length - 1];
      latestBody = {
        date: recent.calendarDate as string,
        weight: recent.weight ? kgToLbs(Number(recent.weight)) : null,
        bodyFat: recent.fat ? Number(recent.fat) : null,
        bmi: recent.bodyMassIndex ? Number(recent.bodyMassIndex) : null,
        provider: (recent.source as Record<string, unknown>)?.provider as string || 'unknown',
      };
    }

    // Calculate readiness score from available data
    let computedReadiness = null;
    if (latestSleep) {
      // Simple readiness calculation based on sleep quality
      let readiness = 70; // baseline
      if (latestSleep.duration >= 7) readiness += 10;
      else if (latestSleep.duration >= 6) readiness += 5;
      else readiness -= 10;

      if (latestSleep.efficiency && latestSleep.efficiency > 85) readiness += 10;
      else if (latestSleep.efficiency && latestSleep.efficiency < 70) readiness -= 10;

      if (latestSleep.hrAverage && latestSleep.hrAverage < 60) readiness += 5;
      else if (latestSleep.hrAverage && latestSleep.hrAverage > 75) readiness -= 5;

      computedReadiness = Math.max(20, Math.min(100, readiness));
    }

    // Build sync snapshot
    const syncSnapshot = {
      lastSync: new Date().toISOString(),
      sleep: latestSleep,
      activity: latestActivity,
      body: latestBody,
      computedReadiness,
    };

    // Update all connections with latest sync data
    for (const conn of connections) {
      await prisma.wearableConnection.update({
        where: { id: conn.id },
        data: {
          lastSyncAt: new Date(),
          syncData: JSON.parse(JSON.stringify(syncSnapshot)),
        },
      });
    }

    // Auto-update operator profile with wearable data
    const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (operator) {
      const profile = (operator.profile as Record<string, unknown>) || {};
      const updatedProfile: Record<string, unknown> = { ...profile };

      // Update readiness from wearable
      if (computedReadiness !== null) {
        updatedProfile.readiness = computedReadiness;
      }

      // Update sleep score (1-10 scale)
      if (latestSleep?.duration) {
        const sleepScore = Math.min(10, Math.round(latestSleep.duration / 0.8));
        updatedProfile.sleep = sleepScore;
      }

      // Update weight from smart scale
      if (latestBody?.weight) {
        updatedProfile.weight = latestBody.weight;
      }

      // Update body fat from smart scale
      if (latestBody?.bodyFat) {
        updatedProfile.bodyFat = latestBody.bodyFat;
      }

      await prisma.operator.update({
        where: { id: operatorId },
        data: {
          profile: JSON.parse(JSON.stringify(updatedProfile)),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      operatorId,
      syncSnapshot,
      updatedFields: {
        readiness: computedReadiness,
        sleep: latestSleep?.duration ? Math.min(10, Math.round(latestSleep.duration / 0.8)) : null,
        weight: latestBody?.weight,
        bodyFat: latestBody?.bodyFat,
      },
    });
  } catch (error) {
    console.error('Wearable sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}
