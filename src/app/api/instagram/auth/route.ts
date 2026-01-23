import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/instagram';

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const redirectUri = `${origin}/api/instagram/callback`;

  console.log('=== Instagram Auth Debug ===');
  console.log('Received userId:', userId);
  console.log('Redirect URI:', redirectUri);

  // Pass user ID as state parameter (since cookies don't work across domains)
  const authUrl = getAuthUrl(redirectUri, userId || undefined);

  console.log('Generated auth URL:', authUrl);
  console.log('============================');

  return NextResponse.redirect(authUrl);
}
