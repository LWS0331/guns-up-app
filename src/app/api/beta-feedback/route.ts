import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

function generateId(): string {
  return 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

interface BetaFeedbackEntry {
  id: string;
  operatorId: string;
  callsign: string;
  type: 'BUG' | 'RECOMMENDATION' | 'UI/UX' | 'PERFORMANCE';
  category: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  screenshot?: string;
  timestamp: string;
  status: 'NEW' | 'REVIEWING' | 'FIXED' | 'WONTFIX';
}

// GET /api/beta-feedback — fetch feedback.
// AUTH: required. Non-admins may only read their own feedback.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const requestedId = request.nextUrl.searchParams.get('operatorId');
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);

    // Non-admins are locked to their own operatorId regardless of what they ask for.
    const scopedId = isAdmin ? requestedId : auth.operatorId;

    const operators = await prisma.operator.findMany({
      ...(scopedId && { where: { id: scopedId } }),
      select: { betaFeedback: true },
    });

    const allFeedback: BetaFeedbackEntry[] = [];

    for (const operator of operators) {
      if (operator.betaFeedback && Array.isArray(operator.betaFeedback)) {
        for (const feedbackJson of operator.betaFeedback) {
          try {
            const feedback = JSON.parse(feedbackJson);
            allFeedback.push(feedback);
          } catch (e) {
            console.error('Failed to parse feedback entry:', e);
          }
        }
      }
    }

    allFeedback.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ ok: true, feedback: allFeedback });
  } catch (error) {
    console.error('GET /api/beta-feedback error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch feedback' },
      { status: 500 },
    );
  }
}

// POST /api/beta-feedback — submit new feedback.
// AUTH: required. The caller's JWT operatorId is the source of truth; anything in the body
// is ignored for identity so a user can't submit feedback as someone else.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { type, category, description, screenshot } = body;

    if (!type || !description) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof description !== 'string' || description.length < 10) {
      return NextResponse.json({ ok: false, error: 'Description must be at least 10 characters' }, { status: 400 });
    }

    // Look up callsign from DB — do NOT trust whatever the client sent.
    const operator = await prisma.operator.findUnique({
      where: { id: auth.operatorId },
      select: { callsign: true, betaFeedback: true },
    });

    if (!operator) {
      return NextResponse.json({ ok: false, error: 'Operator not found' }, { status: 404 });
    }

    const feedbackEntry: BetaFeedbackEntry = {
      id: generateId(),
      operatorId: auth.operatorId,
      callsign: operator.callsign,
      type,
      category: category || 'LOW',
      description,
      screenshot,
      timestamp: new Date().toISOString(),
      status: 'NEW',
    };

    const feedbackArray: BetaFeedbackEntry[] = [];
    if (operator.betaFeedback && Array.isArray(operator.betaFeedback)) {
      for (const feedbackJson of operator.betaFeedback) {
        try {
          feedbackArray.push(JSON.parse(feedbackJson));
        } catch (e) {
          console.error('Failed to parse existing feedback:', e);
        }
      }
    }
    feedbackArray.push(feedbackEntry);

    const feedbackStrings = feedbackArray.map((fb) => JSON.stringify(fb));

    await prisma.operator.update({
      where: { id: auth.operatorId },
      data: { betaFeedback: feedbackStrings },
    });

    const response: { ok: true; feedback: BetaFeedbackEntry; alert?: string } = {
      ok: true,
      feedback: feedbackEntry,
    };
    if (feedbackEntry.category === 'CRITICAL') response.alert = 'CRITICAL';

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/beta-feedback error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to submit feedback' },
      { status: 500 },
    );
  }
}

// PATCH /api/beta-feedback — update an existing entry's status.
// AUTH: required + admin (OPS_CENTER_ACCESS) only. Non-admins cannot change
// status — even on their own tickets — to keep the resolution audit clean.
//
// Body: { id: string, status: 'NEW'|'REVIEWING'|'FIXED'|'WONTFIX',
//         resolutionNote?: string }
//
// Storage gotcha: betaFeedback is a String[] of JSON-stringified entries
// (legacy schema, predates JSON column support). To update one entry we
// have to scan every operator's array (the entry's owning operatorId is
// embedded in the JSON, not surfaced as a separate column). This is fine
// at current scale — beta is < 100 operators — but should be revisited if
// the array gets indexed for filtering.
export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, resolutionNote } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }
    const validStatuses: BetaFeedbackEntry['status'][] = ['NEW', 'REVIEWING', 'FIXED', 'WONTFIX'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
    }

    // Find the operator that owns this feedback id by scanning their JSON-
    // stringified arrays. We could narrow by `id` prefix but the prefix is
    // a timestamp, not the operator. Linear scan is acceptable here.
    const operators = await prisma.operator.findMany({
      select: { id: true, betaFeedback: true },
    });

    for (const op of operators) {
      if (!Array.isArray(op.betaFeedback) || op.betaFeedback.length === 0) continue;
      let found = false;
      const updated: string[] = [];
      for (const json of op.betaFeedback) {
        try {
          const entry = JSON.parse(json) as BetaFeedbackEntry & { resolutionNote?: string; resolvedAt?: string; resolvedBy?: string };
          if (entry.id === id) {
            entry.status = status;
            if (typeof resolutionNote === 'string' && resolutionNote.trim().length > 0) {
              entry.resolutionNote = resolutionNote.trim();
            }
            if (status === 'FIXED' || status === 'WONTFIX') {
              entry.resolvedAt = new Date().toISOString();
              entry.resolvedBy = auth.operatorId;
            }
            found = true;
          }
          updated.push(JSON.stringify(entry));
        } catch {
          updated.push(json); // keep malformed rows untouched
        }
      }
      if (found) {
        await prisma.operator.update({
          where: { id: op.id },
          data: { betaFeedback: updated },
        });
        return NextResponse.json({ ok: true, id, status });
      }
    }

    return NextResponse.json({ ok: false, error: 'feedback id not found' }, { status: 404 });
  } catch (error) {
    console.error('PATCH /api/beta-feedback error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update feedback' },
      { status: 500 },
    );
  }
}
