import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/chat?operatorId=xxx&chatType=gunny-tab
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const operatorId = req.nextUrl.searchParams.get('operatorId');
  const chatType = req.nextUrl.searchParams.get('chatType');

  if (!operatorId || !chatType) {
    return NextResponse.json({ error: 'operatorId and chatType required' }, { status: 400 });
  }

  // Ownership: caller must be target OR admin
  if (auth.operatorId !== operatorId && !OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
//
// SHRINK GUARD (added May 2026 after the Daily Ops chat-wipe incident):
// Before May 2026 this endpoint would happily replace a long messages
// array with an empty one — a pre-hydration race in any client surface
// that called PUT before reading the DB would silently wipe the
// operator's entire chat history. The client-side fix in
// AppShell.tsx (gunnyMessagesHydratedRef) prevents the original cause,
// but a defensive server-side guard ensures any future regression
// (or third-party tool / debug script) can't repeat the data loss.
//
// The guard refuses any PUT that would shrink an existing >0-length
// row to length 0, OR to a length less than 25% of the existing row.
// Both are characteristic of a pre-hydration wipe; neither is a normal
// chat flow. Legitimate clears can pass `?force=true`.
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';
    const { operatorId, chatType, messages } = await req.json();

    if (!operatorId || !chatType || !messages) {
      return NextResponse.json({ error: 'operatorId, chatType, and messages required' }, { status: 400 });
    }

    // Ownership: caller must be target OR admin
    if (auth.operatorId !== operatorId && !OPS_CENTER_ACCESS.includes(auth.operatorId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages must be an array' }, { status: 400 });
    }

    // Read existing once — used for both the shrink guard AND the
    // pre-overwrite snapshot below. Two reads of the same row would
    // be wasteful given this PUT runs hundreds of times per active
    // operator per day.
    const existing = await prisma.chatHistory.findUnique({
      where: { operatorId_chatType: { operatorId, chatType } },
      select: { messages: true },
    });
    const existingMsgs = Array.isArray(existing?.messages)
      ? (existing!.messages as unknown[])
      : [];
    const existingLen = existingMsgs.length;
    const incomingLen = messages.length;

    if (!force) {
      const shrinksToZero = existingLen > 0 && incomingLen === 0;
      // 4× shrink heuristic: incoming has < 25% of existing.
      const shrinksHeavily = existingLen >= 8 && incomingLen < existingLen / 4;
      if (shrinksToZero || shrinksHeavily) {
        // eslint-disable-next-line no-console
        console.warn('[api/chat PUT] shrink guard tripped', {
          actor: auth.operatorId,
          target: operatorId,
          chatType,
          existingLen,
          incomingLen,
        });
        return NextResponse.json(
          {
            error: 'shrink-guard: refusing to shrink chat history',
            detail:
              'Server refused to overwrite a longer chat history with a much shorter one. ' +
              'This usually means the client called PUT before hydrating from /api/chat. ' +
              'If this clear is intentional, retry with ?force=true.',
            existingLen,
            incomingLen,
          },
          { status: 409 },
        );
      }
    }

    // Snapshot the prior state BEFORE we overwrite. Append-only audit;
    // every meaningful change to ChatHistory is recoverable from this
    // table forever (or until a future cleanup cron prunes it).
    // Skip the snapshot only when:
    //   - existing is empty (nothing to capture)
    //   - existing length === incoming length AND the snapshot would be
    //     near-identical (still capture if longer; cheap insurance)
    if (existingLen > 0 && existingLen >= incomingLen) {
      try {
        await prisma.chatHistorySnapshot.create({
          data: {
            operatorId,
            chatType,
            messages: existing!.messages as Prisma.InputJsonValue,
            replacedByOp: auth.operatorId,
            reason: force ? 'force-clear' : 'normal-update',
            prevLen: existingLen,
            newLen: incomingLen,
          },
        });
      } catch (snapErr) {
        // Snapshot failure must NEVER block a legitimate save — log
        // and continue. The shrink guard above already rejected the
        // obvious wipes; this is best-effort backup.
        // eslint-disable-next-line no-console
        console.error('[api/chat PUT] snapshot failed (non-fatal):', snapErr);
      }
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
