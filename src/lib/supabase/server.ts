import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { MockSupabaseClient } from './mock'

export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl || supabaseUrl === 'your_supabase_url') {
    const client = new MockSupabaseClient();
    const mockUserCookie = cookieStore.get('sb-mock-user');
    if (mockUserCookie) {
      try {
        client._setMockUser(JSON.parse(decodeURIComponent(mockUserCookie.value)));
      } catch (e) {
        console.error('Failed to parse mock user cookie', e);
      }
    }
    return client as any;
  }



  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
