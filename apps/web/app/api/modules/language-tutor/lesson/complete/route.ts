import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { isGrammarGateOpen } from '@/lib/language-tutor/progress'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const lessonDate = body.lesson_date ?? new Date().toISOString().slice(0, 10)
  const requireGrammar = body.require_grammar !== false

  const { data: existing } = await supabase
    .from('language_tutor_lessons')
    .select('language, scores, sections')
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sections = existing.sections as { unitId?: string } | null
  const unitId = sections?.unitId

  if (requireGrammar && unitId) {
    const { data: grammarRows } = await supabase
      .from('language_tutor_grammar_progress')
      .select('topic_id, mastery_score, passed')
      .eq('user_id', user.id)
      .eq('language', existing.language as TutorLanguage)

    if (!isGrammarGateOpen(unitId, (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>)) {
      return NextResponse.json(
        {
          error: 'grammar_gate_blocked',
          message: 'Complete the Grammar drill coach to 80% before marking lesson done.',
        },
        { status: 403 },
      )
    }
  }

  const scores =
    body.scores ??
    (existing.scores as Record<string, number> | null) ?? {
      vocab: 80,
      grammar: 80,
      speaking: 75,
      writing: 75,
      quiz: 80,
    }

  const { data, error } = await supabase
    .from('language_tutor_lessons')
    .update({
      status: 'done',
      scores,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)
    .select('*')
    .single()

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lesson: data })
}
