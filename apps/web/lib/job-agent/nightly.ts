import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateApplicationPack,
  scoreJobFit,
  type MasterProfileData,
} from '@aslico/ai'
import {
  adjustFitScore,
  computeDomainFit,
  detectAiRisk,
  isCompanyExcluded,
  matchesKeywords,
  mergeSearchPreferences,
  type SearchPreferences,
} from '@/lib/job-agent/types'
import { collectAggregatorJobs } from '@/lib/job-agent/aggregators'
import {
  BUILTIN_DISCOVERY_KEYWORDS,
  BUILTIN_RSS_FEEDS,
  collectJobicyPool,
  fetchArbeitnowJobs,
  parseRssFeed,
  uniqueFeedUrls,
  type JobCandidate,
} from '@/lib/job-agent/feeds'
import {
  dedupeCandidates,
  loadJobDedupeIndex,
} from '@/lib/job-agent/dedupe'
import { scrapeJobUrl } from '@/lib/job-agent/scrape'
import { scrapeCareersPage } from '@/lib/job-agent/careers'
import { maritimeBatchForRun } from '@/lib/job-agent/maritime-targets'
import { relatedEmployerCareersBatch } from '@/lib/job-agent/related-employers'
import { scanLimits } from '@/lib/job-agent/scan-limits'
import { createScanDeadline } from '@/lib/job-agent/scan-budget'
import { relevanceDomains } from '@/lib/job-agent/domain-aliases'
import {
  boostFitWithAlignment,
  experienceNoteForCv,
  rankCandidatesByRelevance,
} from '@/lib/job-agent/relevance'
import type { ScoutSkippedInput } from '@/lib/scout/skipped'

export interface NightlyResult {
  jobsScanned: number
  packsCreated: number
  skipped: ScoutSkippedInput[]
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

function recordJobSkip(
  skipped: ScoutSkippedInput[],
  job: JobCandidate,
  category: ScoutSkippedInput['skipCategory'],
  reason: string,
  fit?: { score: number; reason: string },
) {
  skipped.push({
    moduleId: 'job-agent',
    title: job.role,
    subtitle: job.company,
    itemUrl: job.jobUrl,
    description: job.jobDescription.slice(0, 2000),
    skipReason: reason,
    skipCategory: category,
    fitScore: fit?.score ?? null,
    candidateData: { job, fit },
  })
}

export async function runDiscoveryForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { trigger?: 'manual' | 'scheduled' },
): Promise<NightlyResult> {
  const trigger = options?.trigger ?? 'manual'
  const log: NightlyResult['log'] = []
  const skipped: ScoutSkippedInput[] = []
  let jobsScanned = 0
  let packsCreated = 0

  if (!process.env.ANTHROPIC_API_KEY) {
    log.push({ message: 'ANTHROPIC_API_KEY missing. Skipping pack generation.', level: 'warn' })
    return { jobsScanned, packsCreated, skipped, log }
  }

  const { data: prefsRow } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const preferences: SearchPreferences = mergeSearchPreferences(
    prefsRow?.preferences as Partial<SearchPreferences> | null,
  )
  const limits = scanLimits(preferences)
  const clock = createScanDeadline()
  log.push({
    message: `Scan mode: ${preferences.scanDepth ?? 'normal'} (max ${limits.maxPacks} packs, ${limits.employerBatch} employer + ${limits.maritimeBatch} maritime careers, ${clock.budgetMs / 1000}s budget)`,
  })

  if (trigger === 'scheduled' && !preferences.nightlyEnabled) {
    log.push({ message: 'Scheduled scan disabled in preferences.' })
    return { jobsScanned, packsCreated, skipped, log }
  }

  log.push({ message: trigger === 'manual' ? 'Manual scan started.' : 'Scheduled scan started.' })

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('master_profile')
    .eq('user_id', userId)
    .maybeSingle()

  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    log.push({ message: 'No master profile. Build profile first.', level: 'warn' })
    return { jobsScanned, packsCreated, skipped, log }
  }

  const dedupeIndex = await loadJobDedupeIndex(supabase, userId)

  const { data: watchlist } = await supabase
    .from('job_watchlist')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)

  const keywordAlerts = (watchlist ?? [])
    .filter((w) => w.kind === 'keyword' && w.enabled)
    .map((w) => String(w.value).trim())
    .filter(Boolean)

  const userKeywords = [...new Set([...preferences.keywords, ...keywordAlerts])].filter(Boolean)

  const profileDomainTerms = (masterProfile.domains ?? preferences.domains ?? []).map((d) =>
    d.replace(/_/g, ' '),
  )

  const searchTerms = [
    ...new Set([...userKeywords, ...BUILTIN_DISCOVERY_KEYWORDS, ...profileDomainTerms]),
  ]

  const watchlistRss = (watchlist ?? [])
    .filter((w) => w.kind === 'rss' && w.enabled)
    .map((w) => String(w.value).trim())

  const rssSources = uniqueFeedUrls([
    ...(preferences.rssFeeds ?? []),
    ...watchlistRss,
    ...BUILTIN_RSS_FEEDS,
  ])

  const rawCandidates: JobCandidate[] = []

  for (const item of watchlist ?? []) {
    if (clock.timeUp()) {
      log.push({ message: 'Time budget reached during watchlist — continuing with collected jobs', level: 'warn' })
      break
    }
    try {
      if (item.kind === 'url') {
        const scraped = await scrapeJobUrl(item.value)
        rawCandidates.push({
          company: scraped.company ?? item.label ?? 'Unknown company',
          role: scraped.title ?? item.label ?? 'Role',
          jobDescription: scraped.description.slice(0, 12000),
          jobUrl: item.value,
          source: 'watchlist_url',
        })
        jobsScanned++
      } else if (item.kind === 'careers') {
        const careersJobs = await scrapeCareersPage(item.value, item.label ?? undefined)
        rawCandidates.push(...careersJobs)
        jobsScanned += careersJobs.length
        log.push({
          message: `Careers ${item.label ?? item.value}: ${careersJobs.length} opportunities`,
        })
      }
    } catch (err) {
      log.push({
        message: `Watchlist ${item.kind} failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  for (const entry of preferences.targetCompanies ?? []) {
    if (clock.timeUp()) break
    if (!entry.startsWith('http')) continue
    try {
      const careersJobs = await scrapeCareersPage(entry)
      rawCandidates.push(...careersJobs)
      jobsScanned += careersJobs.length
      log.push({ message: `Target careers ${entry}: ${careersJobs.length} opportunities` })
    } catch (err) {
      log.push({
        message: `Target careers failed ${entry}: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  const runDay = new Date().getDate()
  for (const target of relatedEmployerCareersBatch(runDay, limits.employerBatch)) {
    if (clock.timeUp()) {
      log.push({ message: 'Time budget reached during employer careers scrape', level: 'warn' })
      break
    }
    if (!target.careersUrl) continue
    try {
      const careersJobs = await scrapeCareersPage(target.careersUrl, target.label)
      rawCandidates.push(...careersJobs)
      jobsScanned += careersJobs.length
      log.push({
        message: `Related employer ${target.label}: ${careersJobs.length} opportunities`,
      })
    } catch (err) {
      log.push({
        message: `Careers ${target.label} failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  for (const target of maritimeBatchForRun(runDay, limits.maritimeBatch)) {
    if (clock.timeUp()) break
    try {
      const careersJobs = await scrapeCareersPage(target.careersUrl, target.company)
      rawCandidates.push(...careersJobs)
      jobsScanned += careersJobs.length
      log.push({
        message: `Maritime target ${target.company}: ${careersJobs.length} opportunities`,
      })
    } catch (err) {
      log.push({
        message: `Maritime careers ${target.company} failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  for (const feedUrl of rssSources.slice(0, limits.maxRssFeeds)) {
    if (clock.timeUp()) {
      log.push({ message: 'Time budget reached during RSS fetch', level: 'warn' })
      break
    }
    try {
      const rssJobs = await parseRssFeed(feedUrl, 'rss')
      const slice = rssJobs.slice(0, limits.rssPerFeed)
      rawCandidates.push(...slice.map((j) => ({ ...j, source: 'builtin_rss' })))
      jobsScanned += slice.length
      log.push({ message: `RSS ${feedUrl}: ${rssJobs.length} listings (${slice.length} sampled)` })
    } catch (err) {
      log.push({
        message: `RSS failed ${feedUrl}: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  if (!clock.timeUp()) {
    try {
      const jobicyJobs = await collectJobicyPool(searchTerms)
      rawCandidates.push(...jobicyJobs)
      jobsScanned += jobicyJobs.length
      log.push({ message: `Jobicy API: ${jobicyJobs.length} jobs` })
    } catch (err) {
      log.push({
        message: `Jobicy API failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  if (!clock.timeUp()) {
    try {
      const arbeitnowJobs = await fetchArbeitnowJobs()
      rawCandidates.push(...arbeitnowJobs)
      jobsScanned += arbeitnowJobs.length
      log.push({ message: `Arbeitnow API: ${arbeitnowJobs.length} remote jobs` })
    } catch (err) {
      log.push({
        message: `Arbeitnow API failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  if (!clock.timeUp()) {
    const agg = await collectAggregatorJobs(searchTerms, limits)
    rawCandidates.push(...agg.jobs)
    jobsScanned += agg.jobs.length
    for (const line of agg.logs) {
      log.push({ message: line })
    }
    for (const w of agg.warnings) {
      log.push({ message: w, level: 'warn' })
    }
  } else {
    log.push({ message: 'Skipped aggregator APIs — time budget', level: 'warn' })
  }

  let candidates = dedupeCandidates(rawCandidates)
  log.push({ message: `Unique candidates after dedupe: ${candidates.length}` })

  const profileDomains = masterProfile.domains ?? preferences.domains ?? []
  const preferenceDomains = preferences.domains ?? []
  const scoringDomains = relevanceDomains(profileDomains, preferenceDomains)

  const ranked = rankCandidatesByRelevance(
    candidates,
    preferences,
    profileDomains,
    preferenceDomains,
  )
  log.push({
    message: `Relevant after soft filter: ${ranked.length} (prioritized — related employers & sector roles first)`,
  })

  if (!ranked.length) {
    log.push({
      message: 'No relevant jobs after filtering. Try Deep scan or lower min fit.',
      level: 'warn',
    })
    return { jobsScanned, packsCreated, skipped, log }
  }

  let skippedDupes = 0
  let skippedKeywords = 0
  let skippedRemote = 0
  let skippedFit = 0

  const expNote = experienceNoteForCv(preferences)
  const maxPacks = limits.maxPacks

  let evalCount = 0

  for (const { job, alignment: preAlignment } of ranked) {
    if (clock.timeUp()) {
      log.push({ message: `Time budget reached after ${evalCount} AI evaluations — partial results returned`, level: 'warn' })
      break
    }
    if (evalCount >= limits.maxRankedEval) {
      log.push({ message: `Eval limit (${limits.maxRankedEval}) reached for this scan`, level: 'info' })
      break
    }
    evalCount++

    if (packsCreated >= maxPacks) {
      recordJobSkip(skipped, job, 'pack_limit', `Max ${maxPacks} packs per scan reached`)
      continue
    }

    const dupe = dedupeIndex.check(job)
    if (dupe.duplicate) {
      skippedDupes++
      recordJobSkip(skipped, job, 'duplicate', 'Already seen / in inbox / applied')
      continue
    }

    if (isCompanyExcluded(job.company, preferences.excludeCompanies)) {
      recordJobSkip(skipped, job, 'excluded', `Company on blocklist: ${job.company}`)
      log.push({ message: `Skipped excluded company: ${job.company}` })
      continue
    }

    const relevance = { pass: true, alignment: preAlignment }

    if (userKeywords.length && !matchesKeywords(`${job.jobDescription} ${job.role}`, userKeywords)) {
      skippedKeywords++
      recordJobSkip(skipped, job, 'keyword', 'No user keyword match')
      continue
    }

    if (preferences.remoteRequired && job.source !== 'careers_open') {
      const hay = `${job.jobDescription} ${job.role} ${job.jobUrl ?? ''}`.toLowerCase()
      const remoteish = ['remote', 'hybrid', 'work from home', 'distributed', 'worldwide', 'anywhere'].some(
        (w) => hay.includes(w),
      )
      if (!remoteish) {
        skippedRemote++
        recordJobSkip(skipped, job, 'remote', 'Remote required — listing not remote/hybrid')
        continue
      }
    }

    const domainFit = computeDomainFit(
      `${job.company} ${job.role} ${job.jobDescription}`,
      scoringDomains,
      preferences.domainWeights,
    )

    let fit = await scoreJobFit(masterProfile, {
      company: job.company,
      role: job.role,
      jobDescription: job.jobDescription,
      jobUrl: job.jobUrl,
      experienceNote: expNote,
      scopeLearnings: preferences.scopeLearnings,
    })
    fit.score = adjustFitScore(fit.score, domainFit, preferences)
    fit.score = boostFitWithAlignment(fit.score, relevance.alignment, preferences)

    if (fit.score < preferences.minFitScore) {
      skippedFit++
      recordJobSkip(skipped, job, 'low_fit', `Fit ${fit.score}% below min ${preferences.minFitScore}%`, fit)
      if (skippedFit <= 12) {
        log.push({ message: `Below min fit (${fit.score}%): ${job.company} · ${job.role}` })
      }
      continue
    }

    const risk = detectAiRisk(job.company, job.jobUrl)

    try {
      const pack = await generateApplicationPack(
        masterProfile,
        {
          company: job.company,
          role: job.role,
          jobDescription: job.jobDescription,
          jobUrl: job.jobUrl,
          experienceNote: expNote,
          applicationType: job.source === 'careers_open' ? 'open_application' : 'job_posting',
        },
        preferences,
      )
      const { error } = await supabase.from('application_packs').insert({
        user_id: userId,
        company: job.company,
        role: job.role,
        job_url: job.jobUrl ?? null,
        job_description: job.jobDescription.slice(0, 20000),
        fit_score: fit.score,
        fit_reason: fit.reason,
        domain_fit: domainFit,
        ai_risk_level: risk.level,
        ai_risk_reason: risk.reason,
        auto_submit_blocked: risk.autoSubmitBlocked,
        tailored_cv: pack.tailoredCv,
        cover_letter: pack.coverLetter,
        evidence_used: pack.evidenceUsed,
        status: 'pending_review',
        source: job.source,
        profile_variant: 'default',
      })

      if (error) {
        log.push({ message: `Save failed: ${error.message}`, level: 'error' })
        recordJobSkip(skipped, job, 'pack_failed', `DB save failed: ${error.message}`, fit)
      } else {
        packsCreated++
        dedupeIndex.remember(job)
        log.push({ message: `Pack created: ${job.company} · ${job.role} (${fit.score}%)` })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error'
      log.push({
        message: `Generation failed for ${job.company}: ${msg}`,
        level: 'error',
      })
      recordJobSkip(skipped, job, 'pack_failed', `Pack generation failed: ${msg}`, fit)
    }
  }

  if (skippedDupes) {
    log.push({ message: `Skipped ${skippedDupes} already seen / applied / in inbox` })
  }
  if (skippedKeywords) {
    log.push({ message: `Skipped ${skippedKeywords} (no user keyword match)` })
  }
  if (skippedRemote) {
    log.push({ message: `Skipped ${skippedRemote} non-remote listings` })
  }
  if (skippedFit > 12) {
    log.push({ message: `Skipped ${skippedFit} total below min fit (${preferences.minFitScore}%)` })
  }

  if (packsCreated === 0) {
    log.push({
      message: `No new packs. Try lowering min fit (now ${preferences.minFitScore}%) or add keywords in Preferences.`,
      level: 'warn',
    })
  }

  log.push({ message: `Skipped candidates saved for review: ${skipped.length}`, level: skipped.length ? 'info' : undefined })

  return { jobsScanned, packsCreated, skipped, log }
}

/** @deprecated use runDiscoveryForUser */
export const runNightlyForUser = runDiscoveryForUser
