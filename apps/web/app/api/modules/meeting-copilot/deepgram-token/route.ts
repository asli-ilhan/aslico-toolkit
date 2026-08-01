import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Short-lived Deepgram token for browser WebSocket (never expose API key). */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY missing' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        { error: `Deepgram token grant failed (${res.status})`, detail: body.slice(0, 200) },
        { status: 502 },
      )
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) {
      return NextResponse.json({ error: 'Deepgram returned empty token' }, { status: 502 })
    }
    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 60,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token grant failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
