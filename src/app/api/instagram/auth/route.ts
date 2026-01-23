import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/instagram';

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const redirectUri = `${origin}/api/instagram/callback`;

  // Pass user ID as state parameter (since cookies don't work across domains)
  const authUrl = getAuthUrl(redirectUri, userId || undefined);

  return NextResponse.redirect(authUrl);
}
