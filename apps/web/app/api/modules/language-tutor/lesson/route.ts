import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'

/** Delete today's (or given date) lesson so it can be regenerated. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lessonDate =
    searchParams.get('lesson_date') ?? new Date().toISOString().slice(0, 10)

  const { data: existing, error: fetchErr } = await supabase
    .from('language_tutor_lessons')
    .select('id')
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)
    .maybeSingle()

  if (fetchErr) {
    if (isMissingLanguageTutorTable(fetchErr)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ ok: true, deleted: false, message: 'No lesson for that date.' })
  }

  await supabase.from('language_tutor_flashcards').delete().eq('source_lesson_id', existing.id)

  const { error } = await supabase
    .from('language_tutor_lessons')
    .delete()
    .eq('user_id', user.id)
    .eq('lesson_date', lessonDate)

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: true, lessonDate })
}
