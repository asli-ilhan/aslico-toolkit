import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { isGrammarGateOpen, isUnitPassedByScore } from '@/lib/language-tutor/progress'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const lessonDate = body.lesson_date ?? new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('language_tutor_lessons')
    .select('language, scores, sections')
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sections = existing.sections as { unitId?: string; submissions?: { quizScore?: number } } | null
  const unitId = sections?.unitId
  const scores =
    (existing.scores as Record<string, number> | null) ??
    (body.scores as Record<string, number> | undefined) ??
    null
  const quizScore = scores?.quiz ?? sections?.submissions?.quizScore

  if (quizScore == null) {
    return NextResponse.json(
      {
        error: 'check_phase_incomplete',
        message: 'Finish the Check phase: submit quiz + speaking/writing before marking done.',
      },
      { status: 403 },
    )
  }

  if (unitId) {
    const { data: grammarRows } = await supabase
      .from('language_tutor_grammar_progress')
      .select('topic_id, mastery_score, passed')
      .eq('user_id', user.id)
      .eq('language', existing.language as TutorLanguage)

    const gateOpen =
      isGrammarGateOpen(
        unitId,
        (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
      ) || isUnitPassedByScore(quizScore)

    if (!gateOpen) {
      return NextResponse.json(
        {
          error: 'quiz_gate_blocked',
          message: 'Score at least 70% on the quiz to complete this unit (retry Check phase).',
        },
        { status: 403 },
      )
    }

    if (isUnitPassedByScore(quizScore)) {
      await supabase.from('language_tutor_grammar_progress').upsert(
        {
          user_id: user.id,
          language: existing.language,
          topic_id: unitId,
          mastery_score: quizScore,
          passed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,language,topic_id' },
      )
    }
  }

  const finalScores = scores ?? {
    vocab: 80,
    grammar: quizScore,
    speaking: 75,
    writing: 75,
    quiz: quizScore,
  }

  const { data, error } = await supabase
    .from('language_tutor_lessons')
    .update({
      status: 'done',
      scores: finalScores,
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
