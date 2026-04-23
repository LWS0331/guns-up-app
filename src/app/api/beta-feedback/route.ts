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
