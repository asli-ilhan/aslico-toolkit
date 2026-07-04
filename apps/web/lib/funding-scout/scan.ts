import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFundingPack, scoreFundingFit, type MasterProfileData } from '@aslico/ai'
import {
  CURATED_OPPORTUNITIES,
  fetchPortalListings,
  parseFundingRss,
  sourcesForRegions,
} from '@/lib/funding-scout/sources'
import { fundingScanLimits } from '@/lib/funding-scout/scan-limits'
import { rankFundingCandidates } from '@/lib/funding-scout/relevance'
import { mergeFundingSettings, type FundingCandidate, type FundingSettings } from '@/lib/funding-scout/types'

export interface FundingScanResult {
  opportunitiesScanned: number
  packsCreated: number
  regionsScanned: string[]
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

function dedupeKey(opp: FundingCandidate): string {
  return `${opp.funder}::${opp.title}::${opp.opportunityUrl ?? ''}`.toLowerCase()
}

export async function runFundingScan(supabase: SupabaseClient, userId: string): Promise<FundingScanResult> {
  const log: FundingScanResult['log'] = []
  let opportunitiesScanned = 0
  let packsCreated = 0

  if (!process.env.ANTHROPIC_API_KEY) {
    log.push({ message: 'ANTHROPIC_API_KEY missing.', level: 'warn' })
    return { opportunitiesScanned, packsCreated, regionsScanned: [], log }
  }

  const { data: settingsRow } = await supabase.from('funding_scout_settings').select('*').eq('user_id', userId).maybeSingle()
  const settings: FundingSettings = mergeFundingSettings(
    settingsRow ? {
      regions: settingsRow.regions as FundingSettings['regions'],
      fundingTypes: settingsRow.funding_types as FundingSettings['fundingTypes'],
      disciplines: settingsRow.disciplines as string[],
      requireFullFunding: settingsRow.require_full_funding,
      scanDepth: settingsRow.scan_depth as FundingSettings['scanDepth'],
      citizenship: settingsRow.citizenship ?? 'TR',
      phdStage: settingsRow.phd_stage as FundingSettings['phdStage'],
    } : null,
  )

  const limits = fundingScanLimits(settings)
  const regionsScanned = settings.regions
  log.push({ message: `Manual scan (${settings.scanDepth}) — ${regionsScanned.join(', ')}` })

  const { data: profileRow } = await supabase.from('candidate_profiles').select('master_profile').eq('user_id', userId).maybeSingle()
  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    log.push({ message: 'Build master profile in Job Agent first.', level: 'warn' })
    return { opportunitiesScanned, packsCreated, regionsScanned, log }
  }

  const { data: existing } = await supabase.from('funding_applications').select('funder, title, opportunity_url').eq('user_id', userId)
  const seen = new Set((existing ?? []).map((r) => `${r.funder}::${r.title}::${r.opportunity_url ?? ''}`.toLowerCase()))

  const raw: FundingCandidate[] = limits.curatedAll ? [...CURATED_OPPORTUNITIES] : CURATED_OPPORTUNITIES.slice(0, 6)
  const sources = sourcesForRegions(settings.regions, limits.sourceBatch)

  for (const source of sources) {
    try {
      if (source.rssUrl) {
        const rss = await parseFundingRss(source.rssUrl, source.region, source.label, limits.rssPerFeed)
        raw.push(...rss)
        opportunitiesScanned += rss.length
        log.push({ message: `RSS ${source.label}: ${rss.length}` })
      }
      const portal = await fetchPortalListings(source)
      raw.push(...portal)
      opportunitiesScanned += portal.length
    } catch (err) {
      log.push({ message: `${source.label}: ${err instanceof Error ? err.message : 'error'}`, level: 'warn' })
    }
  }

  const unique = new Map<string, FundingCandidate>()
  for (const opp of raw) {
    const key = dedupeKey(opp)
    if (!seen.has(key) && !unique.has(key)) unique.set(key, opp)
  }

  const ranked = rankFundingCandidates([...unique.values()], settings)
  log.push({ message: `Relevant: ${ranked.length} / ${unique.size} unique` })

  for (const { opp } of ranked) {
    if (packsCreated >= limits.maxPacks) break
    try {
      const fit = await scoreFundingFit(masterProfile, opp, settings)
      if (fit.score < 40) continue
      const pack = await generateFundingPack(masterProfile, opp, settings)
      const { error } = await supabase.from('funding_applications').insert({
        user_id: userId,
        funder: opp.funder,
        title: opp.title,
        funding_type: opp.fundingType,
        region: opp.region,
        opportunity_url: opp.opportunityUrl ?? null,
        description: opp.description.slice(0, 20000),
        deadline: opp.deadline ?? null,
        amount: opp.amount ?? null,
        fit_score: fit.score,
        fit_reason: fit.reason,
        motivation_letter: pack.motivationLetter,
        research_summary: pack.researchSummary,
        project_outline: pack.projectOutline,
        status: 'pending_review',
        source: opp.source,
      })
      if (!error) {
        packsCreated++
        log.push({ message: `Pack: ${opp.funder} · ${opp.title} (${fit.score}%)` })
      }
    } catch (err) {
      log.push({ message: `Failed ${opp.funder}: ${err instanceof Error ? err.message : 'error'}`, level: 'error' })
    }
  }

  return { opportunitiesScanned, packsCreated, regionsScanned, log }
}
