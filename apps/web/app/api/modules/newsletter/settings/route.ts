import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingNewsletterTable } from '@/lib/supabase/errors'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const interests = Array.isArray(body.interests)
    ? body.interests.map(String).filter(Boolean)
    : String(body.interests ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)

  const newsFeeds = Array.isArray(body.news_feeds)
    ? body.news_feeds.map(String).filter(Boolean)
    : String(body.news_feeds ?? '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean)

  const row = {
    user_id: user.id,
    interests,
    news_feeds: newsFeeds,
    delivery_time: body.delivery_time ? String(body.delivery_time) : '08:00',
    timezone: body.timezone ? String(body.timezone) : 'Europe/Istanbul',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('newsletter_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    if (isMissingNewsletterTable(error)) {
      return NextResponse.json({ warning: 'newsletter_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
