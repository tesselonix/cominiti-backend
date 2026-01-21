import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Check Authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, creator_card_status')
      .eq('id', user.id)
      .single()

    if (profile.creator_card_status === 'ordered' || profile.creator_card_status === 'shipped') {
        return NextResponse.json({ error: 'Card already ordered' }, { status: 400 })
    }

    const tier = profile.subscription_tier
    const { cardType } = await request.json()

    // 3. Pricing Logic
    let price = 0
    let currency = 'INR'
    let allowedType = false

    // Validation Table
    // Creator+: 349 (PVC)
    // Growth Pro: 299 (Premium PVC)
    // Elite: 199 (Matte/Gold)
    // Elite+: FREE (Metal)

    if (tier === 'creator_plus' && cardType === 'pvc') {
        price = 349
        allowedType = true
    } else if (tier === 'growth_pro') {
        if (cardType === 'pvc') { price = 299; allowedType = true; } // Discounted base?
        if (cardType === 'premium_pvc') { price = 299; allowedType = true; }
    } else if (tier === 'elite') {
        price = 199 // Flat rate for allowed types? 
        if (['pvc', 'premium_pvc', 'gold'].includes(cardType)) allowedType = true
    } else if (tier === 'elite_plus') {
        price = 0
        allowedType = true // All access
    }

    if (!allowedType && tier === 'free') {
        return NextResponse.json({ error: 'Upgrade required to order Creator Card' }, { status: 403 })
    }

    if (!allowedType) {
        return NextResponse.json({ error: 'Card type not available for your plan' }, { status: 400 })
    }

    // 4. Mock Payment Processing
    // In real app, create Stripe/Razorpay session here.
    
    // 5. Update Profile
    const { error } = await supabase
        .from('profiles')
        .update({ 
            creator_card_status: 'ordered',
            creator_card_type: cardType
        })
        .eq('id', user.id)

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      price,
      currency,
      status: 'ordered'
    })

  } catch (error: any) {
    console.error('Order error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process order' 
    }, { status: 500 })
  }
}
