import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, author, language, category, status, notes } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('culture_tracker_books')
    .insert({
      user_id: user.id,
      title: title.trim(),
      author: author?.trim() || null,
      language: language ?? 'en',
      category: category ?? 'development',
      status: status ?? 'want_to_read',
      notes: notes?.trim() || null,
      source: 'manual',
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingCultureTrackerTable(error)) {
      return NextResponse.json({ error: 'culture_tracker_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ book: data })
}
