import type { FundingCandidate, FundingSettings } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'
import { pickDiscoveryQueries } from '@/lib/funding-scout/search-queries'
import { isAllowedSearchResult, isWebSearchAvailable, webSearch, type WebSearchHit } from '@/lib/funding-scout/web-search'

const FUNDING_SIGNAL_RE =
  /\b(burs|scholarship|fellowship|doktora|phd|doctoral|grant|hibe|2210|2214|2247|msca|marie curie|studentship|stipend|call for|başvuru|basvuru)\b/i

const DISCIPLINE_RE =
  /\b(maritime|ocean|offshore|energy|renewable|wind|machine learning|data science|engineering|digital twin|ai\b|hydrodynamic|cfd|ship|naval|gemi|deniz)\b/i

const OFF_TOPIC_RE =
  /\b(mrc\b|bbsrc|stfc|obesity|wildfire|biomarker|biomedical|political science|populist|parliamentar|proof of concept|drive35)\b/i

const POSTDOC_RE = /\b(postdoc|postdoctoral|post-doctoral)\b/i

const PRIORITY_FUNDER_RE =
  /\b(tubitak|tübitak|yök|kyk|itu|i̇tü|csc|msca|nwo|fulbright|delft|cotutelle|2210|2214|horizon europe|marie curie)\b/i

function inferFundingType(text: string): FundingCandidate['fundingType'] {
  const hay = text.toLowerCase()
  if (hay.includes('fellowship') || hay.includes('postdoc')) return 'fellowship'
  if (hay.includes('grant') || hay.includes('project')) return 'project_grant'
  return 'phd_scholarship'
}

function inferRegion(hit: WebSearchHit, settings: FundingSettings): FundingCandidate['region'] {
  const blob = `${hit.url} ${hit.title} ${hit.snippet}`.toLowerCase()
  if (/tubitak|tübitak|yok\.gov|itu\.edu|\.tr\b|kyk|100\/2000/.test(blob)) return 'turkey'
  if (/\.cn\b|csc\.edu|china scholarship/.test(blob)) return 'china'
  if (/\.nl\b|netherlands|nwo\.nl|tudelft/.test(blob)) return 'eu'
  if (/\.jp\b|mext|jsps/.test(blob)) return 'japan'
  if (/kaust|qatar|uae|saudi/.test(blob)) return 'gulf'
  if (/\.uk\b|ukri|findaphd/.test(blob)) return 'uk'
  if (/euraxess|europa\.eu|horizon europe|msca/.test(blob)) return 'eu'
  if (/fulbright|\.edu\b|nsf\.gov/.test(blob)) return 'americas'
  if (settings.regions.includes('global')) return 'global'
  return settings.regions[0] ?? 'global'
}

function inferFunder(hit: WebSearchHit): string {
  try {
    const host = new URL(hit.url).hostname.replace(/^www\./, '')
    const parts = host.split('.')
    if (parts.length >= 2) return parts[parts.length - 2].toUpperCase()
    return host
  } catch {
    return 'Web search'
  }
}

function hitToCandidate(hit: WebSearchHit, settings: FundingSettings, query: string): FundingCandidate | null {
  const blob = `${hit.title} ${hit.snippet}`
  if (!FUNDING_SIGNAL_RE.test(blob)) return null
  if (OFF_TOPIC_RE.test(blob)) return null
  if (settings.phdStage === 'starting' && POSTDOC_RE.test(blob)) return null
  if (!DISCIPLINE_RE.test(blob) && !PRIORITY_FUNDER_RE.test(blob)) return null

  const deadline = parseDeadlineFromText(blob)
  return {
    funder: inferFunder(hit),
    title: hit.title.slice(0, 300),
    fundingType: inferFundingType(blob),
    region: inferRegion(hit, settings),
    description: `${hit.snippet}\n\nDiscovered via search: "${query}"`.slice(0, 8000),
    opportunityUrl: hit.url,
    deadline: deadline ?? undefined,
    source: `search:${hit.source}`,
    listingKind: 'live_opening',
  }
}

export async function discoverFromWebSearch(
  settings: FundingSettings,
  limits: { searchQueries: number; resultsPerQuery: number },
  disciplines: string[],
): Promise<{ items: FundingCandidate[]; log: string[] }> {
  const log: string[] = []
  if (!isWebSearchAvailable()) {
    log.push('Web search: TAVILY_API_KEY not set — skipping discovery')
    return { items: [], log }
  }

  const queries = pickDiscoveryQueries(settings, disciplines, limits.searchQueries)
  const seen = new Set<string>()
  const items: FundingCandidate[] = []

  for (const query of queries) {
    try {
      const hits = await webSearch(query, limits.resultsPerQuery)
      let added = 0
      for (const hit of hits) {
        if (!isAllowedSearchResult(hit.url) || seen.has(hit.url)) continue
        const candidate = hitToCandidate(hit, settings, query)
        if (!candidate) continue
        seen.add(hit.url)
        items.push(candidate)
        added++
      }
      log.push(`Search "${query.slice(0, 40)}": ${added} funding hits`)
    } catch (err) {
      log.push(`Search failed: ${query.slice(0, 30)} — ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return { items, log }
}
