import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'
import { fetchCultureSettings } from '@/lib/culture-tracker/scout'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [settingsRes, scoutRes, booksRes] = await Promise.all([
    supabase.from('culture_tracker_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('culture_tracker_scouts')
      .select('id, scout_date, title, content_md, sections, created_at')
      .eq('user_id', user.id)
      .eq('scout_date', today)
      .maybeSingle(),
    supabase
      .from('culture_tracker_books')
      .select('id, title, author, language, category, status, priority, source, notes')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .limit(50),
  ])

  const err = settingsRes.error ?? scoutRes.error ?? booksRes.error
  if (err && isMissingCultureTrackerTable(err)) {
    return NextResponse.json({ warning: 'culture_tracker_table_missing' })
  }

  const settings = await fetchCultureSettings(supabase, user.id)

  return NextResponse.json({
    settings,
    todayScout: scoutRes.data,
    books: booksRes.data ?? [],
  })
}
