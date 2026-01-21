import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: Campaign details with applications
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaign with applications and creator info
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        brand_accounts!inner(user_id, company_name),
        campaign_applications(
          id,
          pitch,
          proposed_rate,
          status,
          created_at,
          profiles!inner(id, username, full_name, avatar_url, followers_count, rating)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Verify ownership
    if (campaign.brand_accounts.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ data: campaign })

  } catch (error: any) {
    console.error('Campaign fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch campaign' 
    }, { status: 500 })
  }
}

// PATCH: Update campaign status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id, brand_accounts!inner(user_id)')
      .eq('id', id)
      .single()

    if (!campaign || campaign.brand_accounts.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await request.json()

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data 
    })

  } catch (error: any) {
    console.error('Campaign update error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update campaign' 
    }, { status: 500 })
  }
}
