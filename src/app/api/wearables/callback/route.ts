import { NextRequest, NextResponse } from 'next/server';

// GET /api/wearables/callback — OAuth redirect after wearable connection
// Junction redirects here after the user completes OAuth
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const state = searchParams.get('state') || '';
  const success = searchParams.get('success') || 'true';

  // Redirect back to the app with connection status
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;

  if (success === 'true') {
    // Connection succeeded — redirect to app with success indicator
    return NextResponse.redirect(`${baseUrl}?wearable_connected=true&state=${state}`);
  } else {
    // Connection failed
    return NextResponse.redirect(`${baseUrl}?wearable_error=true`);
  }
}
