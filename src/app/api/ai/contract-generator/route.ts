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

    // 2. Get User Profile & Check Tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const allowedTiers = ['elite', 'elite_plus']
    if (!allowedTiers.includes(profile.subscription_tier)) {
      return NextResponse.json({ 
        error: 'Elite tier required', 
        upgradeRequired: true 
      }, { status: 403 })
    }

    const { sponsorName, deliverables, paymentTerms, exclusivity, jurisdiction } = await request.json()

    // 3. Call Gemini API
    const prompt = `
      You are an expert entertainment lawyer specializing in influencer contracts.
      Draft a simple, enforceable Brand Collaboration Agreement based on the following terms:
      
      Creator: [User Name]
      Brand/Sponsor: ${sponsorName}
      Deliverables: ${deliverables}
      Payment Terms: ${paymentTerms}
      Exclusivity: ${exclusivity || 'Non-exclusive'}
      Jurisdiction: ${jurisdiction || 'General'}

      Return ONLY a valid JSON object:
      {
        "title": "COLLABORATION AGREEMENT",
        "content": "Full contract text in markdown format. Use ## for sections."
      }
    `

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const contractData = JSON.parse(cleanJson)

    return NextResponse.json({ 
      success: true, 
      data: contractData
    })

  } catch (error: any) {
    console.error('Contract generation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to generate contract' 
    }, { status: 500 })
  }
}
