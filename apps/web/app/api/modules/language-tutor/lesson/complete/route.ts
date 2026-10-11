import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { nextUnitFromProgress } from '@/lib/language-tutor/progress'
import { resolveLessonDate } from '@/lib/language-tutor/dates'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

/**
 * Mark the day done and pass the unit.
 * No quiz gate — user can finish after studying; score is kept for history only.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const lessonId = String(body.lesson_id ?? '').trim()
  const lessonDate = resolveLessonDate(body.lesson_date)

  let existing: {
    id: string
    language: string
    scores: Record<string, number> | null
    sections: {
      unitId?: string
      checkAcknowledged?: boolean
      submissions?: { quizScore?: number }
    } | null
  } | null = null

  if (lessonId) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('id, language, scores, sections')
      .eq('user_id', user.id)
      .eq('id', lessonId)
      .maybeSingle()
    existing = data
  }

  if (!existing) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('id, language, scores, sections')
      .eq('user_id', user.id)
      .eq('lesson_date', lessonDate)
      .maybeSingle()
    existing = data
  }

  if (!existing) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('id, language, scores, sections')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'done'])
      .order('lesson_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    existing = data
  }

  if (!existing) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sections = { ...(existing.sections ?? {}), checkAcknowledged: true }
  const quizScore =
    existing.scores?.quiz ??
    sections.submissions?.quizScore ??
    (typeof body.quiz_score === 'number' ? body.quiz_score : 0)

  let unitId = sections.unitId ?? (typeof body.unit_id === 'string' ? body.unit_id : undefined)

  // Legacy lessons without unitId — pass whatever unit progress says is current.
  if (!unitId) {
    const { data: grammarRows } = await supabase
      .from('language_tutor_grammar_progress')
      .select('topic_id, mastery_score, passed')
      .eq('user_id', user.id)
      .eq('language', existing.language)
    const gated = nextUnitFromProgress(
      existing.language as TutorLanguage,
      (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
    )
    unitId = gated.unit.id
    sections.unitId = unitId
  }

  if (unitId) {
    await supabase.from('language_tutor_grammar_progress').upsert(
      {
        user_id: user.id,
        language: existing.language,
        topic_id: unitId,
        mastery_score: typeof quizScore === 'number' ? quizScore : 0,
        passed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,language,topic_id' },
    )
  }

  const finalScores = {
    vocab: existing.scores?.vocab ?? 80,
    grammar: existing.scores?.grammar ?? quizScore,
    speaking: existing.scores?.speaking ?? 75,
    writing: existing.scores?.writing ?? 75,
    quiz: quizScore,
  }

  const { data, error } = await supabase
    .from('language_tutor_lessons')
    .update({
      status: 'done',
      scores: finalScores,
      sections,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lesson: data, unitPassed: true, unitId })
}
