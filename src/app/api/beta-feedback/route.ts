import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

// GET: Fetch all feedback (optionally filtered by operatorId)
export async function GET(request: NextRequest) {
  try {
    const operatorId = request.nextUrl.searchParams.get('operatorId');

    const operators = await prisma.operator.findMany({
      ...(operatorId && { where: { id: operatorId } }),
      select: {
        betaFeedback: true,
      },
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

    // Sort by timestamp, newest first
    allFeedback.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      ok: true,
      feedback: allFeedback,
    });
  } catch (error) {
    console.error('GET /api/beta-feedback error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch feedback' },
      { status: 500 },
    );
  }
}

// POST: Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operatorId, callsign, type, category, description, screenshot } = body;

    if (!operatorId || !callsign || !type || !description) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    if (description.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Description must be at least 10 characters' },
        { status: 400 },
      );
    }

    // Create feedback entry
    const feedbackEntry: BetaFeedbackEntry = {
      id: generateId(),
      operatorId,
      callsign,
      type,
      category: category || 'LOW',
      description,
      screenshot,
      timestamp: new Date().toISOString(),
      status: 'NEW',
    };

    // Get operator and update betaFeedback array
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { betaFeedback: true },
    });

    if (!operator) {
      return NextResponse.json(
        { ok: false, error: 'Operator not found' },
        { status: 404 },
      );
    }

    // Parse existing feedback or start with empty array
    let feedbackArray: BetaFeedbackEntry[] = [];
    if (operator.betaFeedback && Array.isArray(operator.betaFeedback)) {
      for (const feedbackJson of operator.betaFeedback) {
        try {
          feedbackArray.push(JSON.parse(feedbackJson));
        } catch (e) {
          console.error('Failed to parse existing feedback:', e);
        }
      }
    }

    // Add new entry
    feedbackArray.push(feedbackEntry);

    // Convert back to JSON strings for storage
    const feedbackStrings = feedbackArray.map((fb) => JSON.stringify(fb));

    // Update operator with new feedback
    await prisma.operator.update({
      where: { id: operatorId },
      data: { betaFeedback: feedbackStrings },
    });

    const response: any = {
      ok: true,
      feedback: feedbackEntry,
    };

    // Flag critical issues
    if (feedbackEntry.category === 'CRITICAL') {
      response.alert = 'CRITICAL';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/beta-feedback error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to submit feedback' },
      { status: 500 },
    );
  }
}
