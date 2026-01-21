import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/instagram';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/instagram/callback`;
  
  const authUrl = getAuthUrl(redirectUri);
  
  return NextResponse.redirect(authUrl);
}
