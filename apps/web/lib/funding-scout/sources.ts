import type { FundingCandidate, FundingRegion, FundingSettings } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'
import {
  ANNOUNCEMENT_PAGES,
  fetchAllLiveAnnouncements,
  type AnnouncementPage,
} from '@/lib/funding-scout/opening-quality'
import { isTurkishCandidate } from '@/lib/funding-scout/turkey-priority'
import { discoverFromWebSearch } from '@/lib/funding-scout/discover-search'
import { isWebSearchAvailable, webSearchProvider } from '@/lib/funding-scout/web-search'

export interface FundingSource {
  id: string
  region: FundingRegion
  label: string
  rssUrl?: string
  fundingTypes: string[]
}

/** RSS + announcement targets — no generic portal placeholders. */
export const FUNDING_SOURCES: FundingSource[] = [
  { id: 'academicpositions', region: 'global', label: 'Academic Positions', rssUrl: 'https://academicpositions.com/find-jobs/rss', fundingTypes: ['phd_scholarship'] },
  { id: 'euraxess-jobs', region: 'eu', label: 'Euraxess Jobs', rssUrl: 'https://euraxess.ec.europa.eu/jobs/rss', fundingTypes: ['phd_scholarship', 'fellowship'] },
  { id: 'jobs-ac-uk-phd', region: 'uk', label: 'jobs.ac.uk PhD', rssUrl: 'https://www.jobs.ac.uk/search/rss?q=phd+scholarship', fundingTypes: ['phd_scholarship'] },
  { id: 'scholarshipdb', region: 'global', label: 'ScholarshipDB', rssUrl: 'https://scholarshipdb.net/rss/scholarships', fundingTypes: ['phd_scholarship'] },
]

export function announcementPagesForSettings(settings: FundingSettings): AnnouncementPage[] {
  if (!isTurkishCandidate(settings)) {
    return ANNOUNCEMENT_PAGES.filter((p) => p.region !== 'turkey')
  }
  return [...ANNOUNCEMENT_PAGES]
}

export function sourcesForRegions(regions: string[], batchSize = 8): FundingSource[] {
  const set = new Set(regions)
  const matched = FUNDING_SOURCES.filter((s) => set.has(s.region) || set.has('global') || s.region === 'global')
  if (matched.length <= batchSize) return matched
  const day = new Date().getDate()
  const start = (day * 2) % matched.length
  return Array.from({ length: batchSize }, (_, i) => matched[(start + i) % matched.length])
}

const FETCH_HEADERS = { 'User-Agent': 'asliCo-FundingScout/1.0', Accept: 'application/rss+xml, */*' }

function decodeXmlEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function tagValue(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  return decodeXmlEntities(block.match(re)?.[1]?.trim() ?? '')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function parseFundingRss(feedUrl: string, region: FundingRegion, label: string, limit = 25): Promise<FundingCandidate[]> {
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20000), headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`RSS ${res.status}`)
  const xml = await res.text()
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return items.slice(0, limit).map((block) => {
    const title = tagValue(block, 'title') ?? 'Funding opportunity'
    const link = tagValue(block, 'link') ?? tagValue(block, 'id')
    const desc = stripHtml(tagValue(block, 'description') ?? tagValue(block, 'summary') ?? '')
    const hay = `${title} ${desc}`.toLowerCase()
    const deadline = parseDeadlineFromText(`${title}\n${desc}`)
    let fundingType: FundingCandidate['fundingType'] = 'phd_scholarship'
    if (hay.includes('fellowship') || hay.includes('postdoc')) fundingType = 'fellowship'
    else if (hay.includes('grant')) fundingType = 'project_grant'
    return {
      funder: label,
      title: title.slice(0, 300),
      fundingType,
      region,
      description: desc.slice(0, 8000) || title,
      opportunityUrl: link,
      deadline: deadline ?? undefined,
      source: `rss:${label}`,
      listingKind: 'live_opening' as const,
    }
  })
}

export async function discoverLiveOpenings(
  settings: FundingSettings,
  limits: {
    rssPerFeed: number
    sourceBatch: number
    announcementsPerPage: number
    searchQueries: number
    resultsPerQuery: number
  },
  disciplines: string[] = settings.disciplines,
): Promise<{ items: FundingCandidate[]; log: string[] }> {
  const log: string[] = []
  const raw: FundingCandidate[] = []

  const pages = announcementPagesForSettings(settings)
  const scraped = await fetchAllLiveAnnouncements(pages, limits.announcementsPerPage)
  raw.push(...scraped)
  log.push(`Announcement pages: ${scraped.length} live links`)

  const sources = sourcesForRegions(settings.regions, limits.sourceBatch)
  for (const source of sources) {
    if (!source.rssUrl) continue
    try {
      const rss = await parseFundingRss(source.rssUrl, source.region, source.label, limits.rssPerFeed)
      raw.push(...rss)
      log.push(`RSS ${source.label}: ${rss.length}`)
    } catch (err) {
      log.push(`RSS ${source.label}: ${err instanceof Error ? err.message : 'failed'}`)
    }
  }

  if (isWebSearchAvailable()) {
    log.push(`Web search discovery (${webSearchProvider()})`)
    const searched = await discoverFromWebSearch(settings, limits, disciplines)
    raw.push(...searched.items)
    log.push(...searched.log)
  } else {
    log.push('Web search: add TAVILY_API_KEY or BRAVE_SEARCH_API_KEY for live discovery')
  }

  return { items: raw, log }
}
