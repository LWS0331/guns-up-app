import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/chat?operatorId=xxx&chatType=gunny-tab
export async function GET(req: NextRequest) {
  const operatorId = req.nextUrl.searchParams.get('operatorId');
  const chatType = req.nextUrl.searchParams.get('chatType');

  if (!operatorId || !chatType) {
    return NextResponse.json({ error: 'operatorId and chatType required' }, { status: 400 });
  }

  try {
    const record = await prisma.chatHistory.findUnique({
      where: { operatorId_chatType: { operatorId, chatType } },
    });

    return NextResponse.json({ messages: record?.messages ?? [] });
  } catch (error) {
    console.error('Failed to fetch chat:', error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

// PUT /api/chat — upsert chat history
export async function PUT(req: NextRequest) {
  try {
    const { operatorId, chatType, messages } = await req.json();

    if (!operatorId || !chatType || !messages) {
      return NextResponse.json({ error: 'operatorId, chatType, and messages required' }, { status: 400 });
    }

    const record = await prisma.chatHistory.upsert({
      where: { operatorId_chatType: { operatorId, chatType } },
      update: { messages },
      create: { operatorId, chatType, messages },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    console.error('Failed to save chat:', error);
    return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
  }
}
