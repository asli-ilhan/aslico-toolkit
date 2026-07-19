import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { generateTodayLesson } from '@/lib/language-tutor/lesson'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const locale = String(body.locale ?? 'en')

  try {
    const result = await generateTodayLesson(supabase, user.id, locale)
    if (result.restDay) {
      return NextResponse.json({ restDay: true, message: 'Rest day — optional immersion only.' })
    }
    return NextResponse.json({
      lesson: result.lesson,
      language: result.language,
      programDay: result.programDay,
      goalDays: result.goalDays,
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
