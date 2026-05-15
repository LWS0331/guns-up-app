// /api/admin/chat-history-restore — recovery endpoints for ChatHistory.
//
// Built in pre-emptive response to the May 2026 chat-wipe incident.
// Three operations, all admin-gated (OPS_CENTER_ACCESS):
//
//   GET  ?operatorId=X&chatType=Y       → list snapshots for that pair
//                                          (most recent first, capped at 50)
//   GET  ?operatorId=X                  → list ALL snapshots for the operator
//                                          across every chatType
//   POST { snapshotId }                 → restore that snapshot to ChatHistory
//                                          (force-bypasses the shrink guard)
//   POST { operatorId, chatType, messages } → write raw provided messages
//                                          (use when restoring from a Railway
//                                          DB backup or another device's
//                                          localStorage)
//
// Every successful restore is itself snapshotted by /api/chat PUT's
// audit logic, so no operation in the recovery flow is destructive.

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

function denyIfNotAdmin(operatorId: string): NextResponse | null {
  if (!OPS_CENTER_ACCESS.includes(operatorId)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const denied = denyIfNotAdmin(auth.operatorId);
  if (denied) return denied;

  const url = new URL(req.url);
  const operatorId = url.searchParams.get('operatorId');
  const chatType = url.searchParams.get('chatType');

  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
  }

  const snapshots = await prisma.chatHistorySnapshot.findMany({
    where: chatType ? { operatorId, chatType } : { operatorId },
    orderBy: { replacedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      operatorId: true,
      chatType: true,
      replacedAt: true,
      replacedByOp: true,
      reason: true,
      prevLen: true,
      newLen: true,
      // messages excluded from list view to keep payload small;
      // fetch a single snapshot via id to inspect its content
    },
  });

  return NextResponse.json({ ok: true, snapshots });
}

interface RestoreBody {
  /** Restore from a previously-captured snapshot. */
  snapshotId?: string;
  /** Restore by writing raw JSON (e.g. extracted from Railway backup or device localStorage). */
  operatorId?: string;
  chatType?: string;
  messages?: unknown[];
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const denied = denyIfNotAdmin(auth.operatorId);
  if (denied) return denied;

  let body: RestoreBody;
  try {
    body = (await req.json()) as RestoreBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Path 1: restore from snapshot id
  if (body.snapshotId) {
    const snap = await prisma.chatHistorySnapshot.findUnique({
      where: { id: body.snapshotId },
    });
    if (!snap) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }
    const messages = Array.isArray(snap.messages) ? (snap.messages as unknown[]) : [];

    // Snapshot the CURRENT state before the restore overwrite, so the
    // restore itself is reversible.
    const current = await prisma.chatHistory.findUnique({
      where: {
        operatorId_chatType: { operatorId: snap.operatorId, chatType: snap.chatType },
      },
      select: { messages: true },
    });
    const currentMsgs = Array.isArray(current?.messages)
      ? (current!.messages as unknown[])
      : [];
    if (currentMsgs.length > 0) {
      await prisma.chatHistorySnapshot.create({
        data: {
          operatorId: snap.operatorId,
          chatType: snap.chatType,
          messages: current!.messages as Prisma.InputJsonValue,
          replacedByOp: auth.operatorId,
          reason: 'admin-restore',
          prevLen: currentMsgs.length,
          newLen: messages.length,
        },
      });
    }

    const restored = await prisma.chatHistory.upsert({
      where: {
        operatorId_chatType: { operatorId: snap.operatorId, chatType: snap.chatType },
      },
      update: { messages: messages as Prisma.InputJsonValue },
      create: {
        operatorId: snap.operatorId,
        chatType: snap.chatType,
        messages: messages as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      ok: true,
      via: 'snapshot',
      snapshotId: snap.id,
      operatorId: snap.operatorId,
      chatType: snap.chatType,
      restoredLen: messages.length,
      previousLen: currentMsgs.length,
      chatHistoryId: restored.id,
    });
  }

  // Path 2: restore from raw messages payload
  const { operatorId, chatType, messages } = body;
  if (!operatorId || !chatType || !Array.isArray(messages)) {
    return NextResponse.json(
      {
        error:
          'Provide either { snapshotId } or { operatorId, chatType, messages: [] }',
      },
      { status: 400 },
    );
  }

  // Snapshot the current state first.
  const current = await prisma.chatHistory.findUnique({
    where: { operatorId_chatType: { operatorId, chatType } },
    select: { messages: true },
  });
  const currentMsgs = Array.isArray(current?.messages)
    ? (current!.messages as unknown[])
    : [];
  if (currentMsgs.length > 0) {
    await prisma.chatHistorySnapshot.create({
      data: {
        operatorId,
        chatType,
        messages: current!.messages as Prisma.InputJsonValue,
        replacedByOp: auth.operatorId,
        reason: 'admin-restore',
        prevLen: currentMsgs.length,
        newLen: messages.length,
      },
    });
  }

  const restored = await prisma.chatHistory.upsert({
    where: { operatorId_chatType: { operatorId, chatType } },
    update: { messages: messages as Prisma.InputJsonValue },
    create: {
      operatorId,
      chatType,
      messages: messages as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    ok: true,
    via: 'raw-payload',
    operatorId,
    chatType,
    restoredLen: messages.length,
    previousLen: currentMsgs.length,
    chatHistoryId: restored.id,
  });
}
