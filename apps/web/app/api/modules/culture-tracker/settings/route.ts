import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const patch = {
    user_id: user.id,
    home_cities: Array.isArray(body.home_cities) ? body.home_cities : undefined,
    interests: Array.isArray(body.interests) ? body.interests : undefined,
    book_topics: Array.isArray(body.book_topics) ? body.book_topics : undefined,
    favorite_authors: Array.isArray(body.favorite_authors) ? body.favorite_authors : undefined,
    spotify_artists: Array.isArray(body.spotify_artists) ? body.spotify_artists : undefined,
    languages: Array.isArray(body.languages) ? body.languages : undefined,
    updated_at: new Date().toISOString(),
  }

  const row = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  )

  const { data, error } = await supabase
    .from('culture_tracker_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    if (isMissingCultureTrackerTable(error)) {
      return NextResponse.json({ error: 'culture_tracker_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
