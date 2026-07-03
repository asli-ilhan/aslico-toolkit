import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateApplicationPack,
  scoreJobFit,
  type MasterProfileData,
} from '@aslico/ai'
import {
  adjustFitScore,
  computeDomainFit,
  DEFAULT_PREFERENCES,
  detectAiRisk,
  isCompanyExcluded,
  matchesKeywords,
  type SearchPreferences,
} from '@/lib/job-agent/types'
import { scrapeJobUrl } from '@/lib/job-agent/scrape'

/** Remote job boards scanned when watchlist has no RSS sources. */
const BUILTIN_RSS_FEEDS = [
  'https://remotive.com/remote-jobs/feed',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://jobicy.com/?feed=job_listing',
]

export interface NightlyResult {
  jobsScanned: number
  packsCreated: number
  log: { message: string; level?: 'info' | 'warn' | 'error' }[]
}

interface JobCandidate {
  company: string
  role: string
  jobDescription: string
  jobUrl?: string
  source: string
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

  const preferences: SearchPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(prefsRow?.preferences as Partial<SearchPreferences> | null),
  }

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

  const { data: watchlist } = await supabase
    .from('job_watchlist')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)

  const candidates: JobCandidate[] = []

  const keywordAlerts = (watchlist ?? [])
    .filter((w) => w.kind === 'keyword' && w.enabled)
    .map((w) => String(w.value).trim())
    .filter(Boolean)

  const activeKeywords = [...new Set([...preferences.keywords, ...keywordAlerts])]

  /** Use profile domains as search terms when no explicit keywords. */
  const searchTerms =
    activeKeywords.length > 0 ?
      activeKeywords
    : (masterProfile.domains ?? preferences.domains ?? [])
        .slice(0, 4)
        .map((d) => d.replace(/_/g, ' '))

  const hasWatchlistRss = (watchlist ?? []).some((w) => w.kind === 'rss' && w.enabled)
  const rssSources = hasWatchlistRss ?
    []
  : [...(preferences.rssFeeds ?? []), ...BUILTIN_RSS_FEEDS].filter(Boolean)

  for (const item of watchlist ?? []) {
    try {
      if (item.kind === 'url') {
        const scraped = await scrapeJobUrl(item.value)
        const company = scraped.company ?? item.label ?? 'Unknown company'
        const role = scraped.title ?? item.label ?? 'Role'
        candidates.push({
          company,
          role,
          jobDescription: scraped.description.slice(0, 12000),
          jobUrl: item.value,
          source: 'watchlist_url',
        })
        jobsScanned++
      } else if (item.kind === 'rss') {
        const rssJobs = await parseRssFeed(item.value)
        for (const j of rssJobs.slice(0, 10)) {
          candidates.push({ ...j, source: 'watchlist_rss' })
          jobsScanned++
        }
      }
    } catch (err) {
      log.push({
        message: `Watchlist ${item.kind} failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  for (const feedUrl of rssSources) {
    try {
      const rssJobs = await parseRssFeed(feedUrl)
      for (const j of rssJobs.slice(0, 8)) {
        candidates.push({ ...j, source: 'builtin_rss' })
        jobsScanned++
      }
      log.push({ message: `RSS ${feedUrl}: ${rssJobs.length} listings` })
    } catch (err) {
      log.push({
        message: `RSS failed ${feedUrl}: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  if (searchTerms.length) {
    const q = encodeURIComponent(`${searchTerms.slice(0, 4).join(' ')} remote`)
    const indeedUrl = `https://rss.indeed.com/rss?q=${q}&l=remote`
    try {
      const indeedJobs = await parseRssFeed(indeedUrl)
      for (const j of indeedJobs.slice(0, 12)) {
        candidates.push({ ...j, source: 'indeed_rss' })
        jobsScanned++
      }
      log.push({
        message: `Indeed RSS: ${indeedJobs.length} jobs for [${searchTerms.slice(0, 4).join(', ')}]`,
      })
    } catch (err) {
      log.push({
        message: `Indeed RSS failed: ${err instanceof Error ? err.message : 'error'}`,
        level: 'warn',
      })
    }
  }

  if (!candidates.length) {
    log.push({
      message: 'No jobs found. Check profile domains or add keywords in Preferences.',
    })
    return { jobsScanned, packsCreated, log }
  }

  const maxPacks = 5
  for (const job of candidates.slice(0, maxPacks * 2)) {
    if (packsCreated >= maxPacks) break

    if (isCompanyExcluded(job.company, preferences.excludeCompanies)) {
      log.push({ message: `Skipped excluded company: ${job.company}` })
      continue
    }

    if (searchTerms.length && !matchesKeywords(`${job.jobDescription} ${job.role}`, searchTerms)) {
      continue
    }

    if (preferences.remoteRequired) {
      const hay = job.jobDescription.toLowerCase()
      const remoteish = ['remote', 'hybrid', 'work from home', 'distributed'].some((w) =>
        hay.includes(w),
      )
      if (!remoteish && !job.jobUrl?.includes('remote')) {
        log.push({ message: `Skipped non-remote: ${job.company} · ${job.role}` })
        continue
      }
    }

    const domainFit = computeDomainFit(
      job.jobDescription,
      masterProfile.domains ?? preferences.domains,
      preferences.domainWeights,
    )

    let fit = await scoreJobFit(masterProfile, job)
    fit.score = adjustFitScore(fit.score, domainFit, preferences)

    if (fit.score < preferences.minFitScore) {
      log.push({ message: `Below min fit (${fit.score}%): ${job.company}` })
      continue
    }

    const risk = detectAiRisk(job.company, job.jobUrl)

    try {
      const pack = await generateApplicationPack(masterProfile, job, preferences)
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
        log.push({ message: `Pack created: ${job.company} · ${job.role} (${fit.score}%)` })
      }
    } catch (err) {
      log.push({
        message: `Generation failed for ${job.company}: ${err instanceof Error ? err.message : 'error'}`,
        level: 'error',
      })
    }
  }

  return { jobsScanned, packsCreated, log }
}

async function parseRssFeed(url: string): Promise<JobCandidate[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`RSS fetch ${res.status}`)
  const xml = await res.text()
  const items: JobCandidate[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks) {
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim()
    const link = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim()
    const desc =
      block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? ''
    if (!title) continue
    items.push({
      company: title.split(' at ')[1]?.trim() ?? 'RSS listing',
      role: title.split(' at ')[0]?.trim() ?? title,
      jobDescription: desc.replace(/<[^>]+>/g, ' ').slice(0, 8000),
      jobUrl: link,
      source: 'rss',
    })
  }
  return items
}
