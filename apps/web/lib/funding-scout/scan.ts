import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFundingPack, scoreFundingFit, type MasterProfileData } from '@aslico/ai'
import {
  buildCuratedBatch,
  fetchPortalListings,
  parseFundingRss,
  sourcesForRegions,
} from '@/lib/funding-scout/sources'
import { isTurkishCandidate } from '@/lib/funding-scout/turkey-priority'
import { fundingScanLimits } from '@/lib/funding-scout/scan-limits'
import { rankFundingCandidates } from '@/lib/funding-scout/relevance'
import { settingsFromDbRow, type FundingCandidate } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'
import { upsertFundingDeadlineEvent } from '@/lib/funding-scout/calendar-sync'
import { passesEligibilityGate } from '@/lib/funding-scout/eligibility'

export interface FundingScanResult {
  opportunitiesScanned: number
  packsCreated: number
  regionsScanned: string[]
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

function resolveDeadline(opp: FundingCandidate, aiDeadline?: string | null): string | null {
  if (opp.deadline && /^\d{4}-\d{2}-\d{2}$/.test(opp.deadline)) return opp.deadline
  if (aiDeadline && /^\d{4}-\d{2}-\d{2}$/.test(aiDeadline)) return aiDeadline
  return parseDeadlineFromText(`${opp.title}\n${opp.description}`)
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
  const settings = settingsFromDbRow(settingsRow)

  const limits = fundingScanLimits(settings)
  const regionsScanned = settings.regions
  log.push({
    message: `Manual scan (${settings.scanDepth}) — eligibility: ${settings.strictEligibility ? 'strict' : 'relaxed'} · PhD ${settings.phdStartMonth} · partners: ${settings.partnerCountries.join(', ')}`,
  })

  const { data: profileRow } = await supabase.from('candidate_profiles').select('master_profile').eq('user_id', userId).maybeSingle()
  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    log.push({ message: 'Build master profile in Job Agent first.', level: 'warn' })
    return { opportunitiesScanned, packsCreated, regionsScanned, log }
  }

  const { data: existing } = await supabase.from('funding_applications').select('funder, title, opportunity_url').eq('user_id', userId)
  const seen = new Set((existing ?? []).map((r) => `${r.funder}::${r.title}::${r.opportunity_url ?? ''}`.toLowerCase()))

  const raw: FundingCandidate[] = buildCuratedBatch(settings, limits.curatedAll)
  if (isTurkishCandidate(settings)) {
    log.push({ message: `TR priority: TÜBİTAK, YÖK, KYK + ${settings.homeUniversity.trim() ? 'home university' : 'set home university for ITU bursları'} — always scanned` })
  }
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
  log.push({ message: `Eligible + relevant: ${ranked.length} / ${unique.size} unique` })

  let skippedIneligible = 0

  for (const { opp, eligibility: ruleElig } of ranked) {
    if (packsCreated >= limits.maxPacks) break
    try {
      if (!passesEligibilityGate(ruleElig, settings)) {
        skippedIneligible++
        log.push({ message: `Skip: ${opp.funder} — ${ruleElig.reasons[0] ?? 'ineligible'}`, level: 'info' })
        continue
      }

      const fit = await scoreFundingFit(masterProfile, opp, settings)
      if (settings.strictEligibility && !fit.eligible) {
        skippedIneligible++
        log.push({ message: `Skip: ${opp.funder} — ${fit.eligibilityReason}`, level: 'info' })
        continue
      }
      if (fit.score < 45) continue

      const pack = await generateFundingPack(masterProfile, opp, settings)
      const deadline = resolveDeadline(opp, fit.deadline)
      const allFlags = [...new Set([...ruleElig.flags, ...fit.eligibilityFlags])]
      const eligibilityReason = fit.eligibilityReason || ruleElig.reasons.join('; ')

      const { data: inserted, error } = await supabase.from('funding_applications').insert({
        user_id: userId,
        funder: opp.funder,
        title: opp.title,
        funding_type: opp.fundingType,
        region: opp.region,
        opportunity_url: opp.opportunityUrl ?? null,
        description: opp.description.slice(0, 20000),
        deadline,
        amount: opp.amount ?? null,
        fit_score: fit.score,
        fit_reason: fit.reason,
        eligibility_pass: fit.eligible && ruleElig.eligible,
        eligibility_reason: eligibilityReason,
        eligibility_flags: allFlags,
        motivation_letter: pack.motivationLetter,
        research_summary: pack.researchSummary,
        project_outline: pack.projectOutline,
        status: 'pending_review',
        source: opp.source,
      }).select('id').single()
      if (!error && inserted) {
        packsCreated++
        const deadlineNote = deadline ? ` · deadline ${deadline}` : ''
        log.push({ message: `✓ ${opp.funder} · ${opp.title} (${fit.score}%) — ${eligibilityReason.slice(0, 80)}${deadlineNote}` })
        if (deadline) {
          try {
            await upsertFundingDeadlineEvent(supabase, userId, inserted.id, opp.funder, opp.title, deadline)
          } catch {
            log.push({ message: `Calendar sync failed for ${opp.funder}`, level: 'warn' })
          }
        }
      }
    } catch (err) {
      log.push({ message: `Failed ${opp.funder}: ${err instanceof Error ? err.message : 'error'}`, level: 'error' })
    }
  }

  if (skippedIneligible > 0) {
    log.push({ message: `Skipped ${skippedIneligible} ineligible / poor-fit programmes`, level: 'info' })
  }

  return { opportunitiesScanned, packsCreated, regionsScanned, log }
}
