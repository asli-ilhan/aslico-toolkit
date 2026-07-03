import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }
  if (body.program_start_date) row.program_start_date = body.program_start_date
  if (body.goal_days) row.goal_days = body.goal_days
  if (Array.isArray(body.rotation)) row.rotation = body.rotation
  if (typeof body.sunday_break === 'boolean') row.sunday_break = body.sunday_break
  if (body.native_language) row.native_language = body.native_language

  const { data, error } = await supabase
    .from('language_tutor_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
