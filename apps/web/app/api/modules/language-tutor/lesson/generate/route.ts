import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { generateTodayLesson } from '@/lib/language-tutor/lesson'
import { resolveLessonDate } from '@/lib/language-tutor/dates'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const locale = String(body.locale ?? 'en')
  const force = body.force === true
  const lessonDate = resolveLessonDate(body.lesson_date)

  try {
    if (force) {
      const { data: existing } = await supabase
        .from('language_tutor_lessons')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_date', lessonDate)
        .maybeSingle()
      if (existing?.id) {
        await supabase.from('language_tutor_flashcards').delete().eq('source_lesson_id', existing.id)
        await supabase
          .from('language_tutor_lessons')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_date', lessonDate)
      }
    }

    const result = await generateTodayLesson(supabase, user.id, locale, lessonDate)
    if (result.restDay) {
      return NextResponse.json({ restDay: true, message: 'Rest day — optional immersion only.' })
    }
    return NextResponse.json({
      lesson: result.lesson,
      language: result.language,
      programDay: result.programDay,
      goalDays: result.goalDays,
      regenerated: force,
      enrichFailed: 'enrichFailed' in result ? result.enrichFailed : false,
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = String((err as { message: string }).message)
      if (isMissingLanguageTutorTable({ message: msg })) {
        return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
      }
    }
    const message = err instanceof Error ? err.message : 'Lesson generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
