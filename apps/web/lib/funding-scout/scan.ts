import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFundingPack, scoreFundingFitBatch, type MasterProfileData } from '@aslico/ai'
import { discoverLiveOpenings } from '@/lib/funding-scout/sources'
import { fundingScanLimits } from '@/lib/funding-scout/scan-limits'
import { rankFundingCandidates } from '@/lib/funding-scout/relevance'
import { settingsFromDbRow, type FundingCandidate, type FundingSettings } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'
import { upsertFundingDeadlineEvent } from '@/lib/funding-scout/calendar-sync'
import { passesEligibilityGate } from '@/lib/funding-scout/eligibility'
import { filterLiveOpenings } from '@/lib/funding-scout/opening-quality'
import { enrichOpeningsBatch, composeEnrichedDescription } from '@/lib/funding-scout/enrich-opening'
import { isWebSearchAvailable, webSearchProvider } from '@/lib/funding-scout/web-search'
import type { ScoutSkippedInput } from '@/lib/scout/skipped'
import type { FundingFitResult } from '@aslico/ai'

export interface FundingScanResult {
  opportunitiesScanned: number
  packsCreated: number
  candidatesNew: number
  candidatesDuplicate: number
  skippedSaved: number
  regionsScanned: string[]
  skipped: ScoutSkippedInput[]
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

function settingsForAi(settings: FundingSettings) {
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

function resolveDeadline(opp: FundingCandidate, aiDeadline?: string | null): string | null {
  if (opp.deadline && /^\d{4}-\d{2}-\d{2}$/.test(opp.deadline)) return opp.deadline
  if (aiDeadline && /^\d{4}-\d{2}-\d{2}$/.test(aiDeadline)) return aiDeadline
  return parseDeadlineFromText(`${opp.title}\n${opp.description}`)
}

function dedupeKey(opp: FundingCandidate): string {
  return `${opp.funder}::${opp.title}::${opp.opportunityUrl ?? ''}`.toLowerCase()
}

function minFitScore(opp: FundingCandidate): number {
  if (opp.listingKind === 'live_opening' || opp.source.startsWith('search:')) return 40
  return 50
}

function recordFundingSkip(
  skipped: ScoutSkippedInput[],
  opp: FundingCandidate,
  category: ScoutSkippedInput['skipCategory'],
  reason: string,
  fit?: FundingFitResult,
  enriched?: FundingCandidate,
) {
  skipped.push({
    moduleId: 'funding-scout',
    title: opp.title,
    subtitle: opp.funder,
    itemUrl: opp.opportunityUrl,
    description: (enriched?.description ?? opp.description).slice(0, 2000),
    skipReason: reason,
    skipCategory: category,
    fitScore: fit?.score ?? null,
    candidateData: { opp: enriched ?? opp, fit },
  })
}

export async function runFundingScan(supabase: SupabaseClient, userId: string): Promise<FundingScanResult> {
  const log: FundingScanResult['log'] = []
  let opportunitiesScanned = 0
  let packsCreated = 0
  let candidatesNew = 0
  let candidatesDuplicate = 0
  const skipped: ScoutSkippedInput[] = []

  const empty = {
    opportunitiesScanned,
    packsCreated,
    candidatesNew,
    candidatesDuplicate,
    skippedSaved: 0,
    regionsScanned: [] as string[],
    skipped,
    log,
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log.push({ message: 'ANTHROPIC_API_KEY missing.', level: 'warn' })
    return empty
  }

  const { data: settingsRow } = await supabase.from('funding_scout_settings').select('*').eq('user_id', userId).maybeSingle()
  const settings = settingsFromDbRow(settingsRow)
  const aiSettings = settingsForAi(settings)

  const limits = fundingScanLimits(settings)
  const regionsScanned = settings.regions
  log.push({
    message: `Live-opening scan (${settings.scanDepth}) — AI scout + primary verify · max ${limits.maxPacks} packs/run`,
  })
  if (isWebSearchAvailable()) {
    log.push({ message: `Web search: ${webSearchProvider()} enabled` })
  } else {
    log.push({
      message: 'TAVILY_API_KEY not detected — Vercel → Settings → Environment Variables → Production → redeploy',
      level: 'warn',
    })
  }

  const { data: profileRow } = await supabase.from('candidate_profiles').select('master_profile').eq('user_id', userId).maybeSingle()
  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    log.push({ message: 'Build master profile in Job Agent first.', level: 'warn' })
    return { ...empty, regionsScanned, log }
  }

  const { data: existing } = await supabase
    .from('funding_applications')
    .select('funder, title, opportunity_url')
    .eq('user_id', userId)
  const seen = new Set((existing ?? []).map((r) => `${r.funder}::${r.title}::${r.opportunity_url ?? ''}`.toLowerCase()))
  log.push({ message: `Already in your list: ${seen.size} funding applications` })

  const discovered = await discoverLiveOpenings(settings, limits)
  for (const line of discovered.log) log.push({ message: line })

  opportunitiesScanned = discovered.items.length
  const liveOnly = filterLiveOpenings(discovered.items)
  log.push({
    message: `Specific openings: ${liveOnly.length} kept · ${discovered.items.length - liveOnly.length} generic dropped`,
    level: liveOnly.length ? 'info' : 'warn',
  })

  if (!liveOnly.length) {
    log.push({ message: 'No live calls found. Try Deep scan later.', level: 'warn' })
    return { opportunitiesScanned, packsCreated, candidatesNew, candidatesDuplicate, skippedSaved: 0, regionsScanned, skipped, log }
  }

  const unique = new Map<string, FundingCandidate>()
  for (const opp of liveOnly) {
    const key = dedupeKey(opp)
    if (seen.has(key)) {
      candidatesDuplicate++
      recordFundingSkip(skipped, opp, 'duplicate', 'Already in your saved list')
      continue
    }
    if (!unique.has(key)) unique.set(key, opp)
  }

  candidatesNew = unique.size
  log.push({
    message: `New vs list: ${candidatesNew} new · ${candidatesDuplicate} already saved (skipped)`,
    level: candidatesNew ? 'info' : 'warn',
  })

  if (!candidatesNew) {
    log.push({
      message: 'Nothing new to add — same openings as your saved list. Try Deep scan or wait for new announcements.',
      level: 'warn',
    })
    return { opportunitiesScanned, packsCreated, candidatesNew, candidatesDuplicate, skippedSaved: 0, regionsScanned, skipped, log }
  }

  const ranked = rankFundingCandidates([...unique.values()], settings)
  log.push({ message: `Rule-filtered: ${ranked.length} / ${unique.size} new candidates pass relevance` })

  if (!ranked.length) {
    log.push({ message: 'New openings found but none passed relevance/eligibility rules.', level: 'warn' })
    return { opportunitiesScanned, packsCreated, candidatesNew, candidatesDuplicate, skippedSaved: 0, regionsScanned, skipped, log }
  }

  let skippedIneligible = 0
  let skippedLowScore = 0
  let skippedNoFit = 0
  let evalCursor = 0
  let totalEvaluated = 0

  while (packsCreated < limits.maxPacks && evalCursor < ranked.length && evalCursor < limits.maxEvaluate) {
    const wave = ranked.slice(evalCursor, evalCursor + limits.evalWindow)
    evalCursor += wave.length
    if (!wave.length) break

    log.push({ message: `Wave: enriching + AI eval for ${wave.length} candidates (${evalCursor}/${Math.min(ranked.length, limits.maxEvaluate)})…` })
    const toEnrich = wave.map(({ opp }) => opp)
    const enriched = await enrichOpeningsBatch(toEnrich, {
      concurrency: limits.enrichConcurrency,
      fetchPrimary: true,
      verifySearch: isWebSearchAvailable(),
    })

    const openings = enriched.map((opp) => ({
      funder: opp.funder,
      title: opp.title,
      fundingType: opp.fundingType,
      region: opp.region,
      description: opp.listingDescription,
      opportunityUrl: opp.opportunityUrl,
      primarySourceText: opp.primarySourceText,
      primarySourceFetchedAt: opp.primarySourceFetchedAt,
      searchVerificationSnippets: opp.searchVerificationSnippets?.map((h) => ({
        title: h.title,
        url: h.url,
        snippet: h.snippet,
      })),
    }))

    const fitMap = await scoreFundingFitBatch(masterProfile, aiSettings, openings)
    totalEvaluated += wave.length
    log.push({ message: `AI evaluated ${fitMap.size} / ${wave.length} in this wave` })

    for (let i = 0; i < wave.length; i++) {
      if (packsCreated >= limits.maxPacks) break
      const { opp, eligibility: ruleElig } = wave[i]
      const enrichedOpp = enriched[i] ?? opp
      const fit = fitMap.get(i)
      if (!fit) {
        skippedNoFit++
        recordFundingSkip(skipped, opp, 'no_ai_eval', 'No AI evaluation returned', undefined, enrichedOpp)
        continue
      }

      try {
        if (!passesEligibilityGate(ruleElig, settings)) {
          skippedIneligible++
          recordFundingSkip(skipped, opp, 'rules', 'Failed rule-based eligibility gate', fit, enrichedOpp)
          continue
        }

        if (fit.disqualifiers?.length) {
          skippedIneligible++
          recordFundingSkip(skipped, opp, 'disqualifier', fit.disqualifiers.join('; '), fit, enrichedOpp)
          continue
        }

        if (settings.strictEligibility && fit.eligible === false) {
          skippedIneligible++
          recordFundingSkip(skipped, opp, 'ineligible', fit.eligibilityReason, fit, enrichedOpp)
          continue
        }

        const threshold = minFitScore(enrichedOpp)
        if (fit.score < threshold) {
          skippedLowScore++
          recordFundingSkip(skipped, opp, 'low_fit', `Fit ${fit.score}% below ${threshold}%`, fit, enrichedOpp)
          continue
        }

        const pack = await generateFundingPack(masterProfile, enrichedOpp, aiSettings)
        const deadline = resolveDeadline(enrichedOpp, fit.deadline)
        const allFlags = [...new Set([
          ...ruleElig.flags,
          ...fit.eligibilityFlags,
          enrichedOpp.primarySourceText ? 'primary_source:fetched' : 'primary_source:missing',
          enrichedOpp.searchVerificationSnippets?.length ? 'web_verify:yes' : 'web_verify:no',
        ])]
        const eligibilityReason = [
          fit.eligibilityReason,
          fit.confidence ? `confidence: ${fit.confidence}` : '',
          fit.applicantType ? `type: ${fit.applicantType}` : '',
          fit.verifyNotes ? `verify: ${fit.verifyNotes}` : '',
        ].filter(Boolean).join(' · ')

        const { data: inserted, error } = await supabase.from('funding_applications').insert({
          user_id: userId,
          funder: enrichedOpp.funder,
          title: enrichedOpp.title,
          funding_type: enrichedOpp.fundingType,
          region: enrichedOpp.region,
          opportunity_url: enrichedOpp.opportunityUrl ?? null,
          description: composeEnrichedDescription(enrichedOpp).slice(0, 20000),
          deadline,
          amount: fit.amount ?? enrichedOpp.amount ?? null,
          fit_score: fit.score,
          fit_reason: fit.reason,
          eligibility_pass: fit.eligible !== false && ruleElig.eligible,
          eligibility_reason: eligibilityReason,
          eligibility_flags: allFlags,
          motivation_letter: pack.motivationLetter,
          research_summary: pack.researchSummary,
          project_outline: pack.projectOutline,
          status: 'pending_review',
          source: enrichedOpp.source,
        }).select('id').single()

        if (error) {
          log.push({ message: `DB insert failed: ${opp.title.slice(0, 40)} — ${error.message}`, level: 'error' })
          continue
        }

        if (inserted) {
          packsCreated++
          seen.add(dedupeKey(enrichedOpp))
          const conf = fit.confidence === 'verified' ? '✓' : '?'
          const deadlineNote = deadline ? ` · ${deadline}` : ''
          log.push({
            message: `${conf} PACK ${enrichedOpp.funder}: ${enrichedOpp.title.slice(0, 55)} (${fit.score}%)${deadlineNote}`,
          })
          if (deadline) {
            try {
              await upsertFundingDeadlineEvent(supabase, userId, inserted.id, enrichedOpp.funder, enrichedOpp.title, deadline)
            } catch {
              log.push({ message: 'Calendar sync failed', level: 'warn' })
            }
          }
        }
      } catch (err) {
        log.push({ message: `Failed: ${err instanceof Error ? err.message : 'error'}`, level: 'error' })
      }
    }
  }

  log.push({ message: `Total AI-evaluated: ${totalEvaluated} candidates across waves` })

  if (skippedIneligible > 0) {
    log.push({ message: `Skipped ${skippedIneligible} — eligibility / disqualifiers`, level: 'info' })
  }
  if (skippedLowScore > 0) {
    log.push({ message: `Skipped ${skippedLowScore} — fit score below threshold`, level: 'info' })
  }
  if (skippedNoFit > 0) {
    log.push({ message: `Skipped ${skippedNoFit} — no AI evaluation returned`, level: 'warn' })
  }
  if (packsCreated === 0 && candidatesNew > 0) {
    log.push({
      message: 'Found new openings but none became packs — check Skipped list below or log above.',
      level: 'warn',
    })
  }

  log.push({ message: `Skipped candidates saved for review: ${skipped.length}`, level: skipped.length ? 'info' : undefined })

  return {
    opportunitiesScanned,
    packsCreated,
    candidatesNew,
    candidatesDuplicate,
    skippedSaved: skipped.length,
    regionsScanned,
    skipped,
    log,
  }
}
