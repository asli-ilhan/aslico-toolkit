import { NextResponse, type NextRequest } from 'next/server'
import { generateNewsletterIssue } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingNewsletterTable } from '@/lib/supabase/errors'
import {
  fetchJobBrief,
  fetchNewsletterSettings,
  fetchTodayCalendar,
  fetchTodayTodos,
} from '@/lib/toolkit-context'
import { scrapeNewsHeadlines } from '@/lib/newsletter/scrape'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const locale = String(body.locale ?? 'en')
  const issueDate = new Date().toISOString().slice(0, 10)

  const settings = await fetchNewsletterSettings(supabase, user.id)
  const interests =
    settings.interests.length > 0 ?
      settings.interests
    : ['HCI research', 'Contemporary art', 'German B1', 'Job hunt']

  const [jobBrief, todayEvents, todayTodos, headlines] = await Promise.all([
    fetchJobBrief(supabase, user.id),
    fetchTodayCalendar(supabase, user.id),
    fetchTodayTodos(supabase, user.id, issueDate),
    scrapeNewsHeadlines({
      interests,
      customFeeds: settings.newsFeeds,
      locale,
      maxItems: 12,
    }),
  ])

  try {
    const generated = await generateNewsletterIssue({
      locale,
      interests,
      date: issueDate,
      headlines,
      todayEvents: todayEvents.map((e) => ({
        title: e.title,
        at: e.starts_at,
        allDay: e.all_day,
        account: (e as { source_account?: string }).source_account ?? null,
      })),
      todayTodos: todayTodos.map((t) => ({ title: t.title, done: t.done })),
      jobBrief: {
        pendingInbox: jobBrief.pendingCount,
        deadlines: (jobBrief.deadlines ?? []).map((d) => ({
          company: d.company,
          role: d.role,
          at: d.deadline_at!,
        })),
        followUps: (jobBrief.followUps ?? []).map((d) => ({
          company: d.company,
          role: d.role,
          at: d.follow_up_at!,
        })),
      },
    })

    const { data: saved, error } = await supabase
      .from('newsletter_issues')
      .upsert(
        {
          user_id: user.id,
          issue_date: issueDate,
          title: generated.title,
          content_md: generated.contentMd,
          sections: generated.sections,
        },
        { onConflict: 'user_id,issue_date' },
      )
      .select('id, issue_date, title, content_md, sections, created_at')
      .single()

    if (error) {
      if (isMissingNewsletterTable(error)) {
        return NextResponse.json({
          warning: 'newsletter_table_missing',
          preview: generated,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ issue: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
