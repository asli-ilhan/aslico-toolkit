import { NextResponse } from 'next/server'
import { createClaudeMessage } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * Warms the cue model when the Live screen opens.
 * A cold first call costs ~2.5 s to first token; after this ping it is ~0.6 s,
 * so the first real question of a meeting is not the slow one.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  try {
    await createClaudeMessage({
      model: process.env.ANTHROPIC_MEETING_MODEL || 'claude-haiku-4-5-20251001',
      system: 'Reply with the single character: k',
      messages: [{ role: 'user', content: 'k' }],
      maxTokens: 4,
      temperature: 0,
    })
    return NextResponse.json({ warm: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prewarm failed'
    return NextResponse.json({ warm: false, error: message }, { status: 200 })
  }
}
