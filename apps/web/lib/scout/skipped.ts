import type { SupabaseClient } from '@supabase/supabase-js'

export type ScoutModuleId = 'funding-scout' | 'job-agent'

export type SkipCategory =
  | 'duplicate'
  | 'rules'
  | 'disqualifier'
  | 'ineligible'
  | 'low_fit'
  | 'no_ai_eval'
  | 'keyword'
  | 'remote'
  | 'excluded'
  | 'pack_limit'
  | 'pack_failed'

export interface ScoutSkippedInput {
  moduleId: ScoutModuleId
  title: string
  subtitle?: string
  itemUrl?: string
  description?: string
  skipReason: string
  skipCategory: SkipCategory | string
  fitScore?: number | null
  candidateData?: Record<string, unknown>
}

export interface ScoutSkippedRecord {
  id: string
  module_id: ScoutModuleId
  run_id: string | null
  title: string
  subtitle: string | null
  item_url: string | null
  description: string | null
  skip_reason: string
  skip_category: string
  fit_score: number | null
  candidate_data: Record<string, unknown>
  promoted_at: string | null
  dismissed_at: string | null
  created_at: string
}

const MAX_PER_SCAN = 80

export async function saveScoutSkippedItems(
  supabase: SupabaseClient,
  userId: string,
  runId: string | null,
  items: ScoutSkippedInput[],
): Promise<number> {
  if (!items.length) return 0

  const rows = items.slice(0, MAX_PER_SCAN).map((item) => ({
    user_id: userId,
    module_id: item.moduleId,
    run_id: runId,
    title: item.title.slice(0, 300),
    subtitle: item.subtitle?.slice(0, 200) ?? null,
    item_url: item.itemUrl ?? null,
    description: item.description?.slice(0, 8000) ?? null,
    skip_reason: item.skipReason.slice(0, 500),
    skip_category: item.skipCategory,
    fit_score: item.fitScore != null ? Math.round(item.fitScore) : null,
    candidate_data: slimCandidateData(item.candidateData),
  }))

  const BATCH = 12
  let saved = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('scout_skipped_items').insert(chunk)
    if (error) throw error
    saved += chunk.length
  }
  return saved
}

export async function listScoutSkippedItems(
  supabase: SupabaseClient,
  userId: string,
  moduleId: ScoutModuleId,
  limit = 60,
): Promise<ScoutSkippedRecord[]> {
  const { data, error } = await supabase
    .from('scout_skipped_items')
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .is('dismissed_at', null)
    .is('promoted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ScoutSkippedRecord[]
}

export async function dismissScoutSkippedItem(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('scout_skipped_items')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function markScoutSkippedPromoted(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('scout_skipped_items')
    .update({ promoted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export interface ClientSkippedPreview {
  id: string
  title: string
  subtitle: string | null
  item_url: string | null
  skip_reason: string
  skip_category: string
  fit_score: number | null
  candidate_data: Record<string, unknown>
}

export function slimCandidateData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}
  const opp = data.opp as Record<string, unknown> | undefined
  const job = data.job as Record<string, unknown> | undefined
  const fit = data.fit
  if (job) {
    return {
      job: {
        company: job.company,
        role: job.role,
        jobUrl: job.jobUrl,
        jobDescription: typeof job.jobDescription === 'string' ? job.jobDescription.slice(0, 4000) : '',
        source: job.source,
      },
      fit,
    }
  }
  if (!opp) return fit ? { fit } : {}
  return {
    opp: {
      funder: opp.funder,
      title: opp.title,
      fundingType: opp.fundingType,
      region: opp.region,
      opportunityUrl: opp.opportunityUrl,
      description: typeof opp.description === 'string' ? opp.description.slice(0, 4000) : '',
      listingDescription: typeof opp.listingDescription === 'string' ? opp.listingDescription.slice(0, 4000) : undefined,
      source: opp.source,
    },
    fit,
  }
}

export function buildSkippedPreview(items: ScoutSkippedInput[]): ClientSkippedPreview[] {
  return items.map((s, index) => ({
    id: `session-${index}`,
    title: s.title,
    subtitle: s.subtitle ?? null,
    item_url: s.itemUrl ?? null,
    skip_reason: s.skipReason,
    skip_category: s.skipCategory,
    fit_score: s.fitScore ?? null,
    candidate_data: slimCandidateData(s.candidateData),
  }))
}
