import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchJobBrief(supabase: SupabaseClient, userId: string) {
  const { count: pendingCount } = await supabase
    .from('application_packs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending_review')

  const { data: deadlines } = await supabase
    .from('application_packs')
    .select('id, company, role, deadline_at')
    .eq('user_id', userId)
    .not('deadline_at', 'is', null)
    .gte('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: true })
    .limit(5)

  const { data: followUps } = await supabase
    .from('application_packs')
    .select('id, company, role, follow_up_at')
    .eq('user_id', userId)
    .not('follow_up_at', 'is', null)
    .lte('follow_up_at', new Date(Date.now() + 14 * 86400000).toISOString())
    .gte('follow_up_at', new Date(Date.now() - 86400000).toISOString())
    .order('follow_up_at', { ascending: true })
    .limit(5)

  return {
    pendingCount: pendingCount ?? 0,
    deadlines: deadlines ?? [],
    followUps: followUps ?? [],
  }
}

export async function fetchTodayCalendar(supabase: SupabaseClient, userId: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const { data } = await supabase
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, all_day, source_account')
    .eq('user_id', userId)
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at', { ascending: true })

  return data ?? []
}

export async function fetchTodayTodos(supabase: SupabaseClient, userId: string, date?: string) {
  const dueDate = date ?? new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('calendar_todos')
    .select('id, title, done, due_date')
    .eq('user_id', userId)
    .eq('due_date', dueDate)
    .order('done', { ascending: true })
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function fetchNewsletterSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('newsletter_settings')
    .select('interests, news_feeds')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    interests: (data?.interests as string[] | undefined) ?? [],
    newsFeeds: (data?.news_feeds as string[] | undefined) ?? [],
  }
}

export async function fetchNewsletterInterests(supabase: SupabaseClient, userId: string) {
  const { interests } = await fetchNewsletterSettings(supabase, userId)
  return interests
}
