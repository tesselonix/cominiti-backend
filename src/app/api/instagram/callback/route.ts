import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForToken, getLongLivedToken, getProfile } from '@/lib/instagram';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // User ID passed from OAuth state

  // Fallback: Try to get user ID from cookie
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get('instagram_oauth_user')?.value;

  // Determine effective user ID (state takes precedence, then cookie)
  const userId = state || cookieUserId;

  // Debug logging
  console.log('=== Instagram Callback Debug ===');
  console.log('Full URL:', request.url);
  console.log('Code:', code ? 'present' : 'missing');
  console.log('State (param):', state);
  console.log('Cookie (instagram_oauth_user):', cookieUserId);
  console.log('Effective UserID:', userId);
  console.log('All params:', Object.fromEntries(searchParams.entries()));
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  console.log('================================');

  // Use FRONTEND_URL env var, fallback to production frontend URL
  const frontendUrl = process.env.FRONTEND_URL || 'https://cominiti-frontend.vercel.app';

  if (error) {
    console.error('Instagram OAuth error:', error);
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=instagram_auth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=no_code`);
  }

  // User ID must be passed via state parameter or cookie
  if (!userId) {
    console.error('No user ID found in state parameter or cookie');
    console.error('Search params were:', Object.fromEntries(searchParams.entries()));
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=no_user_id`);
  }

  try {
    const supabase = await createClient();
    const redirectUri = `${origin}/api/instagram/callback`;

    // Step 1: Exchange code for short-lived token
    console.log('Exchanging code for token...');
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.log('Token received, user_id:', tokenData.user_id);

    // Step 2: Exchange for long-lived token (60 days)
    console.log('Getting long-lived token...');
    const longLivedTokenData = await getLongLivedToken(tokenData.access_token);
    console.log('Long-lived token received');

    // Step 3: Get Instagram profile
    console.log('Fetching Instagram profile...');
    const profile = await getProfile(longLivedTokenData.access_token);
    console.log('Profile received:', profile.username);

    // Calculate token expiry (expires_in is in seconds)
    const tokenExpiresAt = new Date(Date.now() + longLivedTokenData.expires_in * 1000);

    // Step 4: Save to Supabase profile using user ID
    console.log('Saving to database for user:', userId);
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: userId, // User ID from state or cookie
        username: profile.username,
        instagram_user_id: profile.id,
        instagram_access_token: longLivedTokenData.access_token,
        token_expires_at: tokenExpiresAt.toISOString(),
        posts_count: profile.media_count,
        is_onboarded: true,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('Failed to save Instagram data:', updateError);
      return NextResponse.redirect(`${frontendUrl}/dashboard?error=save_failed`);
    }

    console.log('Instagram connection successful!');
    // Redirect to onboarding with success
    return NextResponse.redirect(`${frontendUrl}/onboarding?instagram=connected`);

  } catch (err) {
    console.error('Instagram callback error:', err);
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=instagram_auth_failed`);
  }
}
