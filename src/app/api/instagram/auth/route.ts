import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/instagram';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  // Hardcode to production domain to ensure consistency
  const redirectUri = 'https://api.cominiti.co/api/instagram/callback';

  if (!userId) {
    console.error('No userId provided to auth route');
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  console.log('=== Instagram Auth ===');
  console.log('Received userId:', userId);
  console.log('Redirect URI:', redirectUri);

  // Generate auth URL with state parameter (as backup)
  const authUrl = getAuthUrl(redirectUri, userId);

  console.log('Generated auth URL:', authUrl);

  // Create redirect response and set cookie with user ID
  const response = NextResponse.redirect(authUrl);

  // Set a cookie to store the userId - expires in 10 minutes
  response.cookies.set('instagram_oauth_user', userId, {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // 'none' is required for cross-site cookies (redirects)
    maxAge: 600, // 10 minutes
    path: '/',
  });

  console.log('Set cookie instagram_oauth_user:', userId);

  return response;
}
