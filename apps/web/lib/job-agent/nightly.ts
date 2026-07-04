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
  MAX_NIGHTLY_PACKS,
  parseRssFeed,
  RSS_ITEMS_PER_FEED,
  uniqueFeedUrls,
  type JobCandidate,
} from '@/lib/job-agent/feeds'
import {
  dedupeCandidates,
  loadJobDedupeIndex,
} from '@/lib/job-agent/dedupe'
import { scrapeJobUrl } from '@/lib/job-agent/scrape'
import { scrapeCareersPage } from '@/lib/job-agent/careers'
import { relatedEmployerCareersBatch } from '@/lib/job-agent/related-employers'
import { relevanceDomains } from '@/lib/job-agent/domain-aliases'
import {
  boostFitWithAlignment,
  evaluateJobRelevance,
  experienceNoteForCv,
} from '@/lib/job-agent/relevance'

export interface NightlyResult {
  jobsScanned: number
  packsCreated: number
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

export async function runNightlyForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<NightlyResult> {
  const log: NightlyResult['log'] = []
  let jobsScanned = 0
  let packsCreated = 0

  if (!process.env.ANTHROPIC_API_KEY) {
    log.push({ message: 'ANTHROPIC_API_KEY missing. Skipping pack generation.', level: 'warn' })
    return { jobsScanned, packsCreated, log }
  }

  const { data: prefsRow } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const preferences: SearchPreferences = mergeSearchPreferences(
    prefsRow?.preferences as Partial<SearchPreferences> | null,
  )

  if (!preferences.nightlyEnabled) {
    log.push({ message: 'Nightly run disabled in preferences.' })
    return { jobsScanned, packsCreated, log }
  }

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('master_profile')
    .eq('user_id', userId)
    .maybeSingle()

  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.summary && !masterProfile?.evidence?.length) {
    log.push({ message: 'No master profile. Build profile first.', level: 'warn' })
    return { jobsScanned, packsCreated, log }
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
  for (const target of relatedEmployerCareersBatch(runDay, 10)) {
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

  for (const feedUrl of rssSources) {
    try {
      const rssJobs = await parseRssFeed(feedUrl, 'rss')
      const slice = rssJobs.slice(0, RSS_ITEMS_PER_FEED)
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

  const agg = await collectAggregatorJobs(searchTerms)
  rawCandidates.push(...agg.jobs)
  jobsScanned += agg.jobs.length
  for (const line of agg.logs) {
    log.push({ message: line })
  }
  for (const w of agg.warnings) {
    log.push({ message: w, level: 'warn' })
  }

  let candidates = dedupeCandidates(rawCandidates)
  log.push({ message: `Unique candidates after dedupe: ${candidates.length}` })

  if (!candidates.length) {
    log.push({ message: 'No jobs found from feeds. Add watchlist URLs or check network.' })
    return { jobsScanned, packsCreated, log }
  }

  let skippedDupes = 0
  let skippedKeywords = 0
  let skippedRemote = 0
  let skippedRelevance = 0
  let skippedFit = 0

  const profileDomains = masterProfile.domains ?? preferences.domains ?? []
  const preferenceDomains = preferences.domains ?? []
  const scoringDomains = relevanceDomains(profileDomains, preferenceDomains)
  const expNote = experienceNoteForCv(preferences)

  const maxPacks = MAX_NIGHTLY_PACKS

  for (const job of candidates) {
    if (packsCreated >= maxPacks) break

    const dupe = dedupeIndex.check(job)
    if (dupe.duplicate) {
      skippedDupes++
      continue
    }

    if (isCompanyExcluded(job.company, preferences.excludeCompanies)) {
      log.push({ message: `Skipped excluded company: ${job.company}` })
      continue
    }

    const relevance = evaluateJobRelevance(job, preferences, profileDomains, preferenceDomains)
    if (!relevance.pass) {
      skippedRelevance++
      if (skippedRelevance <= 10) {
        log.push({ message: `Skipped: ${relevance.reason}` })
      }
      continue
    }

    if (userKeywords.length && !matchesKeywords(`${job.jobDescription} ${job.role}`, userKeywords)) {
      skippedKeywords++
      continue
    }

    if (preferences.remoteRequired && job.source !== 'careers_open') {
      const hay = `${job.jobDescription} ${job.role} ${job.jobUrl ?? ''}`.toLowerCase()
      const remoteish = ['remote', 'hybrid', 'work from home', 'distributed', 'worldwide', 'anywhere'].some(
        (w) => hay.includes(w),
      )
      if (!remoteish) {
        skippedRemote++
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
    })
    fit.score = adjustFitScore(fit.score, domainFit, preferences)
    fit.score = boostFitWithAlignment(fit.score, relevance.alignment, preferences)

    if (fit.score < preferences.minFitScore) {
      skippedFit++
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
      } else {
        packsCreated++
        dedupeIndex.remember(job)
        log.push({ message: `Pack created: ${job.company} · ${job.role} (${fit.score}%)` })
      }
    } catch (err) {
      log.push({
        message: `Generation failed for ${job.company}: ${err instanceof Error ? err.message : 'error'}`,
        level: 'error',
      })
    }
  }

  if (skippedRelevance) {
    log.push({ message: `Skipped ${skippedRelevance} irrelevant roles / domain mismatches` })
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

  return { jobsScanned, packsCreated, log }
}
