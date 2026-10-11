import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { resolveLessonDate } from '@/lib/language-tutor/dates'

/** Mark Check feedback as reviewed — unlocks missions and allows unit pass on complete. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const lessonId = String(body.lesson_id ?? '').trim()
  const lessonDate = resolveLessonDate(body.lesson_date)

  let lesson: {
    id: string
    sections: Record<string, unknown> | null
    scores: Record<string, unknown> | null
  } | null = null

  if (lessonId) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('id, sections, scores')
      .eq('user_id', user.id)
      .eq('id', lessonId)
      .maybeSingle()
    lesson = data
  }

  if (!lesson) {
    const { data } = await supabase
      .from('language_tutor_lessons')
      .select('id, sections, scores')
      .eq('user_id', user.id)
      .eq('lesson_date', lessonDate)
      .maybeSingle()
    lesson = data
  }

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const quizScore = (lesson.scores as { quiz?: number } | null)?.quiz
  if (quizScore == null) {
    return NextResponse.json(
      { error: 'check_incomplete', message: 'Submit Check before acknowledging feedback.' },
      { status: 403 },
    )
  }

  const sections = { ...(lesson.sections ?? {}), checkAcknowledged: true }
  const { data: updated, error } = await supabase
    .from('language_tutor_lessons')
    .update({
      sections,
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

  return NextResponse.json({ lesson: updated, checkAcknowledged: true })
}
