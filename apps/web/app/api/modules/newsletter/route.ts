import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingNewsletterTable } from '@/lib/supabase/errors'

const DEFAULT_INTERESTS = ['HCI research', 'Contemporary art', 'German B1', 'Job hunt']

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const [settingsRes, issueRes, historyRes] = await Promise.all([
    supabase.from('newsletter_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('newsletter_issues')
      .select('id, issue_date, title, content_md, sections, created_at')
      .eq('user_id', user.id)
      .eq('issue_date', today)
      .maybeSingle(),
    supabase
      .from('newsletter_issues')
      .select('id, issue_date, title, created_at')
      .eq('user_id', user.id)
      .order('issue_date', { ascending: false })
      .limit(14),
  ])

  const settingsError = settingsRes.error
  const issuesError = issueRes.error ?? historyRes.error

  if (settingsError && isMissingNewsletterTable(settingsError)) {
    return NextResponse.json({ warning: 'newsletter_table_missing' })
  }
  if (issuesError && isMissingNewsletterTable(issuesError)) {
    return NextResponse.json({ warning: 'newsletter_table_missing' })
  }

  const settings = settingsRes.data ?? {
    interests: DEFAULT_INTERESTS,
    news_feeds: [],
    delivery_time: '08:00',
    timezone: 'Europe/Istanbul',
  }

  return NextResponse.json({
    settings,
    todayIssue: issueRes.data,
    history: historyRes.data ?? [],
  })
}
