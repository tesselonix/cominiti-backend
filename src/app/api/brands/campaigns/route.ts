import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: List brand's campaigns
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get brand account
    const { data: brand } = await supabase
      .from('brand_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!brand) {
      return NextResponse.json({ error: 'Brand account not found' }, { status: 404 })
    }

    // Get campaigns with application counts
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_applications(count)
      `)
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: campaigns })

  } catch (error: any) {
    console.error('Campaigns fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch campaigns' 
    }, { status: 500 })
  }
}

// POST: Create new campaign
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get brand account
    const { data: brand } = await supabase
      .from('brand_accounts')
      .select('id, tier')
      .eq('user_id', user.id)
      .single()

    if (!brand) {
      return NextResponse.json({ error: 'Brand account not found' }, { status: 404 })
    }

    // Check campaign limit for free tier
    if (brand.tier === 'free') {
      const { count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
      
      if ((count || 0) >= 1) {
        return NextResponse.json({ 
          error: 'Free tier limited to 1 campaign. Upgrade to Pro for unlimited.', 
          upgradeRequired: true 
        }, { status: 403 })
      }
    }

    const { title, description, budgetMin, budgetMax, requirements, deadline, maxCreators } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Campaign title is required' }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        brand_id: brand.id,
        title,
        description,
        budget_min: budgetMin,
        budget_max: budgetMax,
        requirements: requirements || {},
        deadline,
        max_creators: maxCreators || 10,
        status: 'draft'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data: campaign 
    })

  } catch (error: any) {
    console.error('Campaign creation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create campaign' 
    }, { status: 500 })
  }
}
