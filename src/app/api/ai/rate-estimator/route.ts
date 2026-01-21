import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Check Authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get User Profile & Usage
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, rate_estimator_usage')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const isFree = profile.subscription_tier === 'free'
    
    // 3. Enforce Limit for Free Users
    if (isFree && (profile.rate_estimator_usage || 0) >= 1) {
      return NextResponse.json({ 
        error: 'Free limit reached', 
        upgradeRequired: true 
      }, { status: 403 })
    }

    const { niche, followers, engagement, deliverables } = await request.json()

    // 4. Call Gemini API
    const prompt = `
      You are an expert influencer marketing strategist.
      Estimate fair market rates for a creator with the following stats:
      
      Niche: ${niche}
      Followers: ${followers}
      Engagement Rate: ${engagement}%
      Deliverables Requested: ${deliverables}

      Provide a realistic price range (USD) and a brief justification.
      
      Return ONLY a valid JSON object:
      {
        "minRate": number,
        "maxRate": number,
        "currency": "USD",
        "justification": "Brief explanation of why this rate is appropriate based on market standards."
      }
    `

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const rateData = JSON.parse(cleanJson)

    // 5. Increment Usage if Free
    if (isFree) {
      await supabase
        .from('profiles')
        .update({ rate_estimator_usage: (profile.rate_estimator_usage || 0) + 1 })
        .eq('id', user.id)
    }

    return NextResponse.json({ 
      success: true, 
      data: rateData,
      usage: isFree ? (profile.rate_estimator_usage || 0) + 1 : 'unlimited'
    })

  } catch (error: any) {
    console.error('Rate estimation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to estimate rate' 
    }, { status: 500 })
  }
}
