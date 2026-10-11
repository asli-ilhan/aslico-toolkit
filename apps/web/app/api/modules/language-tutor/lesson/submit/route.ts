import { NextResponse, type NextRequest } from 'next/server'
import { gradeSpeakingWriting } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { isUnitPassedByScore, QUIZ_PASS_THRESHOLD } from '@/lib/language-tutor/progress'
import { resolveLessonDate } from '@/lib/language-tutor/dates'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export const maxDuration = 60

type LessonRow = {
  id: string
  user_id: string
  lesson_date: string
  language: string
  sections: Record<string, unknown> | null
  scores: Record<string, unknown> | null
  status: string
}

async function findLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: { lesson_id?: string; lesson_date?: string },
): Promise<LessonRow | null> {
  const lessonId = String(body.lesson_id ?? '').trim()
  if (lessonId) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('id', lessonId)
      .maybeSingle()
    if (data) return data as LessonRow
  }

  const lessonDate = resolveLessonDate(body.lesson_date)
  const { data: byDate } = await supabase
    .from('language_tutor_lessons')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_date', lessonDate)
    .maybeSingle()
  if (byDate) return byDate as LessonRow

  // Recovery: open lesson from the last few days (UTC/local mismatch or overnight session).
  const { data: open } = await supabase
    .from('language_tutor_lessons')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .order('lesson_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (open as LessonRow | null) ?? null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const quizScore = Number(body.quiz_score ?? 0)
  const speaking = String(body.speaking ?? '').trim()
  const writing = String(body.writing ?? '').trim()
  const locale = String(body.locale ?? 'tr')
  const quizAnswers =
    body.quiz_answers && typeof body.quiz_answers === 'object' ?
      (body.quiz_answers as Record<string, string>)
    : {}

  const lesson = await findLesson(supabase, user.id, body)
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sections = (lesson.sections ?? {}) as {
    speakingExercise?: { prompt: string }
    writingExercise?: { prompt: string }
    unitId?: string
    submissions?: Record<string, unknown>
    checkAcknowledged?: boolean
  }

  const graded = await gradeSpeakingWriting({
    language: lesson.language as TutorLanguage,
    locale,
    speaking,
    writing,
    speakingPrompt: sections.speakingExercise?.prompt ?? 'Speaking exercise',
    writingPrompt: sections.writingExercise?.prompt ?? 'Writing exercise',
  })

  const scores = {
    vocab: 80,
    grammar: quizScore,
    speaking: graded.speaking,
    writing: graded.writing,
    quiz: quizScore,
  }

  const { data: updated, error } = await supabase
    .from('language_tutor_lessons')
    .update({
      scores,
      sections: {
        ...sections,
        // New attempt — must re-acknowledge after reviewing feedback.
        checkAcknowledged: false,
        submissions: {
          speaking,
          writing,
          feedback: graded.feedback,
          quizScore,
          quizAnswers,
        },
      },
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', lesson.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unitId = sections.unitId
  if (unitId && isUnitPassedByScore(quizScore)) {
    await supabase.from('language_tutor_grammar_progress').upsert(
      {
        user_id: user.id,
        language: lesson.language,
        topic_id: unitId,
        mastery_score: quizScore,
        passed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,language,topic_id' },
    )
  } else if (unitId) {
    await supabase.from('language_tutor_grammar_progress').upsert(
      {
        user_id: user.id,
        language: lesson.language,
        topic_id: unitId,
        mastery_score: quizScore,
        passed: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,language,topic_id' },
    )
  }

  return NextResponse.json({
    lesson: updated,
    scores,
    feedback: graded.feedback,
    unitPassed: isUnitPassedByScore(quizScore),
    passThreshold: QUIZ_PASS_THRESHOLD,
  })
}
