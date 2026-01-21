import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: Accept or reject a creator application
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

    // Get application with campaign and brand info
    const { data: application } = await supabase
      .from('campaign_applications')
      .select(`
        *,
        campaigns!inner(
          id,
          title,
          brand_accounts!inner(id, user_id)
        )
      `)
      .eq('id', id)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Verify brand ownership
    if (application.campaigns.brand_accounts.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { status } = await request.json()

    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('campaign_applications')
      .update({
        status,
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
    console.error('Application update error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update application' 
    }, { status: 500 })
  }
}
