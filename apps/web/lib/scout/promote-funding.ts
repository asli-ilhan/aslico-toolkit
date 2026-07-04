import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFundingPack, type MasterProfileData, type FundingOppInput } from '@aslico/ai'
import type { ScoutSkippedRecord } from '@/lib/scout/skipped'
import { settingsFromDbRow, type FundingCandidate } from '@/lib/funding-scout/types'
import { composeEnrichedDescription } from '@/lib/funding-scout/enrich-opening'
import { upsertFundingDeadlineEvent } from '@/lib/funding-scout/calendar-sync'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'

function settingsForAi(settings: ReturnType<typeof settingsFromDbRow>) {
  return {
    citizenship: settings.citizenship,
    homeCountry: settings.homeCountry,
    phdStage: settings.phdStage,
    phdStartMonth: settings.phdStartMonth,
    homeUniversity: settings.homeUniversity,
    partnerCountries: settings.partnerCountries,
    supervisionModel: settings.supervisionModel,
    partnershipNotes: settings.partnershipNotes,
    strictEligibility: settings.strictEligibility,
    disciplines: settings.disciplines,
    regions: settings.regions,
  }
}

export async function promoteFundingSkippedToPack(
  supabase: SupabaseClient,
  userId: string,
  item: ScoutSkippedRecord,
): Promise<{ applicationId: string }> {
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
    throw new Error('Build master profile in Job Agent first')
  }

  const { data: settingsRow } = await supabase
    .from('funding_scout_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const settings = settingsFromDbRow(settingsRow)
  const aiSettings = settingsForAi(settings)

  const data = item.candidate_data
  const opp = (data.opp ?? data) as FundingCandidate & {
    listingDescription?: string
    primarySourceText?: string
    primarySourceFetchedAt?: string
    searchVerificationSnippets?: unknown[]
  }
  const fit = data.fit as {
    score?: number
    reason?: string
    eligible?: boolean
    eligibilityReason?: string
    eligibilityFlags?: string[]
    deadline?: string | null
    amount?: string | null
    confidence?: string
    applicantType?: string
    verifyNotes?: string
  } | undefined

  const enriched = {
    ...opp,
    listingDescription: opp.listingDescription ?? opp.description ?? item.description ?? '',
    description: opp.description ?? item.description ?? '',
  }

  const pack = await generateFundingPack(masterProfile, {
    funder: opp.funder ?? item.subtitle ?? 'Unknown',
    title: opp.title ?? item.title,
    fundingType: opp.fundingType ?? 'phd_scholarship',
    region: opp.region ?? 'global',
    description: enriched.listingDescription,
    opportunityUrl: opp.opportunityUrl ?? item.item_url ?? undefined,
    primarySourceText: opp.primarySourceText,
    primarySourceFetchedAt: opp.primarySourceFetchedAt,
    searchVerificationSnippets: opp.searchVerificationSnippets as FundingOppInput['searchVerificationSnippets'],
  }, aiSettings)
  const deadline =
    (fit?.deadline && /^\d{4}-\d{2}-\d{2}$/.test(fit.deadline) ? fit.deadline : null) ??
    (opp.deadline && /^\d{4}-\d{2}-\d{2}$/.test(opp.deadline) ? opp.deadline : null) ??
    parseDeadlineFromText(`${opp.title}\n${enriched.description}`)

  const { data: inserted, error } = await supabase
    .from('funding_applications')
    .insert({
      user_id: userId,
      funder: opp.funder ?? item.subtitle ?? 'Unknown',
      title: opp.title ?? item.title,
      funding_type: opp.fundingType ?? 'phd_scholarship',
      region: opp.region ?? 'global',
      opportunity_url: opp.opportunityUrl ?? item.item_url ?? null,
        description: composeEnrichedDescription({
          ...enriched,
          listingDescription: enriched.listingDescription,
          searchVerificationSnippets: undefined,
        }).slice(0, 20000),
      deadline,
      amount: fit?.amount ?? opp.amount ?? null,
      fit_score: fit?.score ?? item.fit_score ?? null,
      fit_reason: fit?.reason ?? item.skip_reason,
      eligibility_pass: fit?.eligible !== false,
      eligibility_reason: fit?.eligibilityReason ?? `Manual promote from skipped: ${item.skip_reason}`,
      eligibility_flags: fit?.eligibilityFlags ?? [`promoted_from_skipped:${item.skip_category}`],
      motivation_letter: pack.motivationLetter,
      research_summary: pack.researchSummary,
      project_outline: pack.projectOutline,
      status: 'pending_review',
      source: opp.source ?? 'manual_promote',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Insert failed')
  }

  if (deadline) {
    try {
      await upsertFundingDeadlineEvent(
        supabase,
        userId,
        inserted.id,
        opp.funder ?? item.subtitle ?? '',
        opp.title ?? item.title,
        deadline,
      )
    } catch {
      /* calendar optional */
    }
  }

  return { applicationId: inserted.id }
}
