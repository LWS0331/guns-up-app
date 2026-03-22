import { NextRequest, NextResponse } from 'next/server';
import { Vital } from '@tryvital/vital-node';
import { prisma } from '@/lib/db';
import { getVitalClient, SUPPORTED_PROVIDERS } from '@/lib/vital';

// POST /api/wearables/connect — Register operator in Junction + return connect link
export async function POST(req: NextRequest) {
  try {
    const { operatorId, provider } = await req.json();

    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    if (!process.env.VITAL_API_KEY) {
      return NextResponse.json({ error: 'Wearable integration not configured' }, { status: 503 });
    }

    const vital = getVitalClient();

    // Check if operator already has a Junction user
    let vitalUserId: string;
    const existingConnection = await prisma.wearableConnection.findFirst({
      where: { operatorId },
    });

    if (existingConnection) {
      vitalUserId = existingConnection.vitalUserId;
    } else {
      // Create user in Junction
      const user = await vital.user.create({
        clientUserId: `guns-up-${operatorId}`,
      });
      vitalUserId = user.userId!;
    }

    // Generate connect link
    const providerInfo = SUPPORTED_PROVIDERS.find(p => p.slug === provider);
    const filterProviders = (provider ? [provider] : SUPPORTED_PROVIDERS
      .filter(p => !p.requiresMobile)
      .map(p => p.slug)) as Vital.Providers[];

    const linkToken = await vital.link.token({
      userId: vitalUserId,
      provider: (provider || undefined) as Vital.Providers | undefined,
      filterOnProviders: filterProviders,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://guns-up-app-production-3291.up.railway.app'}/api/wearables/callback`,
    });

    return NextResponse.json({
      vitalUserId,
      linkToken: linkToken.linkToken,
      linkUrl: linkToken.linkWebUrl,
      provider: providerInfo?.name || provider || 'All Providers',
    });
  } catch (error) {
    console.error('Wearable connect error:', error);
    return NextResponse.json(
      { error: 'Failed to generate connect link', details: String(error) },
      { status: 500 }
    );
  }
}
