import { NextResponse } from 'next/server'
import { generateTherapyScript } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingSelfTherapyTable } from '@/lib/supabase/errors'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  const body = await request.json()
  const topic = String(body.topic ?? '').trim()
  const locale = String(body.locale ?? 'tr')
  const notes = body.notes ? String(body.notes) : undefined
  const durationHint = body.durationHint as 'short' | 'medium' | 'long' | undefined

  if (!topic) {
    return NextResponse.json({ error: 'Topic required' }, { status: 400 })
  }

  try {
    const script = await generateTherapyScript({ topic, locale, notes, durationHint })

    const { data: item, error } = await supabase
      .from('self_therapy_sessions')
      .insert({
        user_id: user.id,
        title: script.title,
        topic,
        locale,
        induction: script.induction,
        deepening: script.deepening,
        suggestions: script.suggestions,
        full_script: script.fullScript,
        status: 'draft',
      })
      .select(
        'id, title, topic, locale, induction, deepening, suggestions, full_script, audio_path, duration_seconds, status, created_at, updated_at',
      )
      .single()

    if (error) {
      if (isMissingSelfTherapyTable(error)) {
        return NextResponse.json({
          script,
          warning: 'self_therapy_table_missing',
          hint: 'Run packages/storage/sql/self_therapy.sql in Supabase SQL Editor',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
