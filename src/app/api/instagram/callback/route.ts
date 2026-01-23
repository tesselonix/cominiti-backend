import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForToken, getLongLivedToken, getProfile } from '@/lib/instagram';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || origin;

  if (error) {
    console.error('Instagram OAuth error:', error);
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=instagram_auth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=no_code`);
  }

  try {
    const supabase = await createClient();
    
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${frontendUrl}/login?error=not_authenticated`);
    }

    const redirectUri = `${origin}/api/instagram/callback`;

    // Step 1: Exchange code for short-lived token
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    
    // Step 2: Exchange for long-lived token (60 days)
    const longLivedTokenData = await getLongLivedToken(tokenData.access_token);
    
    // Step 3: Get Instagram profile
    const profile = await getProfile(longLivedTokenData.access_token);
    
    // Calculate token expiry (expires_in is in seconds)
    const tokenExpiresAt = new Date(Date.now() + longLivedTokenData.expires_in * 1000);

    // Step 4: Save to Supabase profile
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
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

    // Redirect to onboarding with success
    return NextResponse.redirect(`${frontendUrl}/onboarding?instagram=connected`);

  } catch (err) {
    console.error('Instagram callback error:', err);
    return NextResponse.redirect(`${frontendUrl}/dashboard?error=instagram_auth_failed`);
  }
}
