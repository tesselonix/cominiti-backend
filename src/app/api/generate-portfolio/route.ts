import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

// Initialize Gemini API
// Note: In production, ensure GEMINI_API_KEY is set
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Check Authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get User Profile & Credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits, subscription_tier, bio, instagram_access_token')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 3. Check Credit Balance
    if (profile.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits', 
        credits: profile.credits,
        required: 1 
      }, { status: 403 })
    }

    // 4. Prepare Generation Prompt
    // In a real app, we might fetch Instagram content here or take user input from body
    const { message } = await request.json().catch(() => ({ message: '' }))
    
    // Fallback prompt if no specific input
    const prompt = `
      You are an expert design consultant for content creators.
      Generate a portfolio design configuration for a creator with the following context:
      Bio: "${profile.bio || 'New content creator'}"
      Additional Context: "${message}"

      Return ONLY a valid JSON object with the following structure (no markdown formatting):
      {
        "theme": "string (one of: Minimal, Bold, Pastel, Dark, Neon)",
        "colorPalette": ["hex1", "hex2", "hex3", "hex4"],
        "typography": "string (suggested font family)",
        "layout": "string (Grid or Magazine or Masonry)",
        "tagline": "string (a catchy short tagline based on bio)"
      }
    `

    // 5. Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean up the response to ensure it's valid JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    let designConfig
    try {
      designConfig = JSON.parse(cleanJson)
    } catch (e) {
      console.error('Failed to parse Gemini response:', text)
      throw new Error('Invalid AI response format')
    }

    // 6. Deduct Credit
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        credits: profile.credits - 1,
        // Optional: Save the generated config to the profile directly?
        // For now, we just return it, user can "apply" it in a separate step or we assume this API applies it.
        // Let's assume we just return it for preview, BUT credits are consumed on generation.
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to deduct credit:', updateError)
      // Potentially refund or fail? For now, risk of free generation if this fails but that's edge case.
    }

    return NextResponse.json({ 
      success: true, 
      data: designConfig, 
      remainingCredits: profile.credits - 1 
    })

  } catch (error: any) {
    console.error('Portfolio generation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to generate portfolio' 
    }, { status: 500 })
  }
}
