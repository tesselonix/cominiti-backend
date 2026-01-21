import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getMedia, refreshLongLivedToken } from '@/lib/instagram';

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's Instagram token from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('instagram_access_token, token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.instagram_access_token) {
      return NextResponse.json({ error: 'Instagram not connected' }, { status: 400 });
    }

    let accessToken = profile.instagram_access_token;

    // Check if token needs refresh (less than 7 days until expiry)
    if (profile.token_expires_at) {
      const expiresAt = new Date(profile.token_expires_at);
      const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilExpiry < 7) {
        try {
          const refreshedToken = await refreshLongLivedToken(accessToken);
          accessToken = refreshedToken.access_token;
          
          // Update token in database
          await supabase
            .from('profiles')
            .update({
              instagram_access_token: accessToken,
              token_expires_at: new Date(Date.now() + refreshedToken.expires_in * 1000).toISOString(),
            })
            .eq('id', user.id);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
    }

    // Fetch Instagram profile
    const instagramProfile = await getProfile(accessToken);
    
    // Fetch Instagram media
    const media = await getMedia(accessToken, 25);

    // Update profile with latest stats
    await supabase
      .from('profiles')
      .update({
        username: instagramProfile.username,
        posts_count: instagramProfile.media_count,
        is_onboarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Upsert posts
    for (const item of media) {
      await supabase
        .from('posts')
        .upsert({
          user_id: user.id,
          instagram_post_id: item.id,
          caption: item.caption || null,
          media_url: item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url,
          media_type: item.media_type,
          permalink: item.permalink,
          posted_at: item.timestamp,
          is_hidden: false,
        }, { onConflict: 'instagram_post_id' });
    }

    return NextResponse.json({
      status: 'success',
      message: `Synced ${media.length} posts from @${instagramProfile.username}`,
      posts_count: media.length,
    });

  } catch (err) {
    console.error('Instagram sync error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
