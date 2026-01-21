import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check Authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if brand account already exists
    const { data: existingBrand } = await supabase
      .from('brand_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingBrand) {
      return NextResponse.json({ error: 'Brand account already exists' }, { status: 400 })
    }

    const { companyName, companyEmail, companyWebsite, industry, description, logoUrl } = await request.json()

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Create brand account
    const { data: brand, error } = await supabase
      .from('brand_accounts')
      .insert({
        user_id: user.id,
        company_name: companyName,
        company_email: companyEmail || user.email,
        company_website: companyWebsite,
        industry,
        description,
        logo_url: logoUrl,
        tier: 'free'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data: brand 
    })

  } catch (error: any) {
    console.error('Brand registration error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to register brand' 
    }, { status: 500 })
  }
}

// Get current user's brand account
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: brand, error } = await supabase
      .from('brand_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return NextResponse.json({ 
      data: brand || null 
    })

  } catch (error: any) {
    console.error('Brand fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch brand' 
    }, { status: 500 })
  }
}
