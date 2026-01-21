import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Templates for Basic Mode
const EMAIL_TEMPLATES: Record<string, string> = {
  'brand_pitch': `Subject: Partnership Opportunity: [Brand Name] x [Your Name]

Hi [Contact Name],

I've been using [Brand Product] for a while now and absolutely love it. I'm a content creator in the [Niche] space with [Follower Count] followers who trust my recommendations.

I'd love to discuss how we could work together to showcase [Product] to my audience. I have a few creative ideas that I think would perform really well.

Here is a link to my portfolio: [Link]

Best,
[Your Name]`,
  
  'collab_request': `Subject: Collab Idea: [Creator Name] x [Your Name]

Hey [Creator Name]!

I've been following your content for a while and love your recent post about [Subject]. I'm also creating content in the [Niche] space and think our audiences have a lot of crossover.

Would you be open to doing a collab? I was thinking we could [Idea].

Let me know what you think!

Cheers,
[Your Name]`,

  'rate_inquiry': `Subject: Rate Card & Media Kit Request

Hi [Name],

Thanks for reaching out! I'm definitely interested in this campaign.

Attached is my media kit which outlines my audience demographics and past campaign performance.

Regarding rates, for the deliverables mentioned in your email, my standard rate is [Amount]. I'm happy to discuss a package deal if you're looking for a longer-term partnership.

Best,
[Your Name]`
}

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
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const isFree = profile.subscription_tier === 'free'
    const body = await request.json()
    const { type, context, tone, recipient } = body

    // 3. Handle Free Tier (Basic Mode)
    if (isFree || type === 'template') {
      const template = EMAIL_TEMPLATES[context] || EMAIL_TEMPLATES['brand_pitch']
      return NextResponse.json({ 
        success: true, 
        data: { 
          subject: template.split('\n')[0].replace('Subject: ', ''),
          body: template.split('\n').slice(2).join('\n'),
          isTemplate: true
        } 
      })
    }

    // 4. Handle Paid Tier (Smart Mode)
    const prompt = `
      You are an expert talent manager writing an email for a creator.
      Write a professional email with the following details:
      
      Type: ${context} (e.g., Brand Pitch, Collab, Response)
      Recipient: ${recipient}
      Tone: ${tone}
      Context/Details: ${JSON.stringify(body.details)}

      Return ONLY a valid JSON object:
      {
        "subject": "Email Subject Line",
        "body": "Email Body Text (use \\n for line breaks)"
      }
    `

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const emailData = JSON.parse(cleanJson)

    return NextResponse.json({ 
      success: true, 
      data: { ...emailData, isTemplate: false }
    })

  } catch (error: any) {
    console.error('Email generation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to generate email' 
    }, { status: 500 })
  }
}
