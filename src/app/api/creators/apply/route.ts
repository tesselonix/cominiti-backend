import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST: Apply to a campaign
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get creator profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
    }

    const { campaignId, pitch, proposedRate } = await request.json()

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Check if campaign is live
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status, max_creators')
      .eq('id', campaignId)
      .single()

    if (!campaign || campaign.status !== 'live') {
      return NextResponse.json({ error: 'Campaign not available' }, { status: 400 })
    }

    // Check if already applied
    const { data: existingApp } = await supabase
      .from('campaign_applications')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('creator_id', user.id)
      .single()

    if (existingApp) {
      return NextResponse.json({ error: 'Already applied to this campaign' }, { status: 400 })
    }

    // Check max creators limit
    const { count } = await supabase
      .from('campaign_applications')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'accepted')

    if ((count || 0) >= campaign.max_creators) {
      return NextResponse.json({ error: 'Campaign is full' }, { status: 400 })
    }

    // Create application
    const { data: application, error } = await supabase
      .from('campaign_applications')
      .insert({
        campaign_id: campaignId,
        creator_id: user.id,
        pitch,
        proposed_rate: proposedRate,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data: application 
    })

  } catch (error: any) {
    console.error('Application error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to submit application' 
    }, { status: 500 })
  }
}

// GET: Get creator's applications
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: applications, error } = await supabase
      .from('campaign_applications')
      .select(`
        *,
        campaigns!inner(
          id,
          title,
          budget_min,
          budget_max,
          deadline,
          brand_accounts!inner(company_name, logo_url)
        )
      `)
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: applications })

  } catch (error: any) {
    console.error('Applications fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch applications' 
    }, { status: 500 })
  }
}
