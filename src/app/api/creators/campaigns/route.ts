import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: List available campaigns for creators
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const niche = url.searchParams.get('niche')
    const budgetMin = url.searchParams.get('budgetMin')

    // Get live campaigns
    let query = supabase
      .from('campaigns')
      .select(`
        *,
        brand_accounts!inner(company_name, logo_url, is_verified)
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })

    // Apply filters
    if (budgetMin) {
      query = query.gte('budget_max', parseInt(budgetMin))
    }

    const { data: campaigns, error } = await query

    if (error) throw error

    // Filter by niche if provided (check requirements JSON)
    let filteredCampaigns = campaigns
    if (niche) {
      filteredCampaigns = campaigns.filter((c: any) => {
        const req = c.requirements as { niche?: string } | null
        return req?.niche?.toLowerCase().includes(niche.toLowerCase())
      })
    }

    return NextResponse.json({ data: filteredCampaigns })

  } catch (error: any) {
    console.error('Campaigns fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch campaigns' 
    }, { status: 500 })
  }
}
