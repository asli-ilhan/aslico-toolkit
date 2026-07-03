import { NextResponse, type NextRequest } from 'next/server'
import { gradeSpeakingWriting } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const lessonDate = body.lesson_date ?? new Date().toISOString().slice(0, 10)
  const quizScore = Number(body.quiz_score ?? 0)
  const speaking = String(body.speaking ?? '').trim()
  const writing = String(body.writing ?? '').trim()
  const locale = String(body.locale ?? 'tr')

  const { data: lesson, error: fetchErr } = await supabase
    .from('language_tutor_lessons')
    .select('*')
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)
    .maybeSingle()

  if (fetchErr || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const sections = lesson.sections as {
    speakingExercise?: { prompt: string }
    writingExercise?: { prompt: string }
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
        submissions: { speaking, writing, feedback: graded.feedback },
      },
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

  return NextResponse.json({ lesson: updated, scores, feedback: graded.feedback })
}
