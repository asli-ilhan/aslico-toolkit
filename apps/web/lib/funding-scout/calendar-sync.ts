import type { SupabaseClient } from '@supabase/supabase-js'
import { deadlineToCalendarIso } from '@/lib/funding-scout/deadline'

export async function upsertFundingDeadlineEvent(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  funder: string,
  title: string,
  deadline: string,
): Promise<void> {
  const sourceRef = `deadline:${applicationId}`
  const row = {
    user_id: userId,
    title: `Funding deadline: ${funder} — ${title}`.slice(0, 500),
    starts_at: deadlineToCalendarIso(deadline),
    all_day: true,
    source: 'funding-scout',
    source_ref: sourceRef,
    color: '#8b5cf6',
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'funding-scout')
    .eq('source_ref', sourceRef)
    .maybeSingle()

  if (existing) {
    await supabase.from('calendar_events').update(row).eq('id', existing.id)
  } else {
    await supabase.from('calendar_events').insert(row)
  }
}

export async function removeFundingDeadlineEvent(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  await supabase
    .from('calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'funding-scout')
    .eq('source_ref', `deadline:${applicationId}`)
}
