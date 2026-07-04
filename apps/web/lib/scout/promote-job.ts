import type { SupabaseClient } from '@supabase/supabase-js'
import { generateApplicationPack, type MasterProfileData } from '@aslico/ai'
import type { ScoutSkippedRecord } from '@/lib/scout/skipped'
import { DEFAULT_PREFERENCES, mergeSearchPreferences, detectAiRisk } from '@/lib/job-agent/types'
import { experienceNoteForCv } from '@/lib/job-agent/relevance'

export async function promoteJobSkippedToPack(
  supabase: SupabaseClient,
  userId: string,
  item: ScoutSkippedRecord,
): Promise<{ packId: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing')
  }

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('master_profile')
    .eq('user_id', userId)
    .maybeSingle()
  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    throw new Error('Build master profile first')
  }

  const { data: prefsRow } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  const preferences = mergeSearchPreferences(
    prefsRow?.preferences as Partial<typeof DEFAULT_PREFERENCES> | null,
  )

  const data = item.candidate_data
  const job = (data.job ?? data) as {
    company: string
    role: string
    jobDescription: string
    jobUrl?: string
    source?: string
  }
  const fit = data.fit as { score?: number; reason?: string } | undefined

  const expNote = experienceNoteForCv(preferences)
  const pack = await generateApplicationPack(
    masterProfile,
    {
      company: job.company ?? item.subtitle ?? 'Company',
      role: job.role ?? item.title,
      jobDescription: job.jobDescription ?? item.description ?? '',
      jobUrl: job.jobUrl ?? item.item_url ?? undefined,
      experienceNote: expNote,
      applicationType: job.source === 'careers_open' ? 'open_application' : 'job_posting',
    },
    preferences,
  )

  const risk = detectAiRisk(job.company ?? '', job.jobUrl)

  const { data: inserted, error } = await supabase
    .from('application_packs')
    .insert({
      user_id: userId,
      company: job.company ?? item.subtitle ?? 'Company',
      role: job.role ?? item.title,
      job_url: job.jobUrl ?? item.item_url ?? null,
      job_description: (job.jobDescription ?? item.description ?? '').slice(0, 20000),
      fit_score: fit?.score ?? item.fit_score ?? null,
      fit_reason: fit?.reason ?? `Manual promote: ${item.skip_reason}`,
      ai_risk_level: risk.level,
      ai_risk_reason: risk.reason,
      auto_submit_blocked: risk.autoSubmitBlocked,
      tailored_cv: pack.tailoredCv,
      cover_letter: pack.coverLetter,
      evidence_used: pack.evidenceUsed,
      status: 'pending_review',
      source: job.source ?? 'manual_promote',
      profile_variant: 'default',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Insert failed')
  }

  return { packId: inserted.id }
}
