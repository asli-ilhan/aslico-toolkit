import { generateNewsletterIssue } from '@aslico/ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_INTERESTS } from '@/lib/newsletter/sources'
import { scrapeNewsHeadlines } from '@/lib/newsletter/scrape'
import {
  fetchJobBrief,
  fetchNewsletterSettings,
  fetchTodayCalendar,
  fetchTodayTodos,
} from '@/lib/toolkit-context'

export async function buildNewsletterIssueForUser(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
  issueDate?: string,
) {
  const date = issueDate ?? new Date().toISOString().slice(0, 10)
  const settings = await fetchNewsletterSettings(supabase, userId)
  const interests =
    settings.interests.length > 0 ? settings.interests : DEFAULT_INTERESTS

  const [jobBrief, todayEvents, todayTodos, scraped] = await Promise.all([
    fetchJobBrief(supabase, userId),
    fetchTodayCalendar(supabase, userId),
    fetchTodayTodos(supabase, userId, date),
    scrapeNewsHeadlines({
      interests,
      customFeeds: settings.newsFeeds,
      locale,
      maxItems: 45,
    }),
  ])

  const generated = await generateNewsletterIssue({
    locale,
    interests,
    date,
    headlines: scraped.headlines,
    topicSections: scraped.topicSections,
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

  return { generated, issueDate: date }
}
