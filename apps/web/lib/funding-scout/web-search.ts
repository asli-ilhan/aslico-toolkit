export interface WebSearchHit {
  title: string
  url: string
  snippet: string
  source: 'tavily' | 'brave'
}

const BLOCKED_HOSTS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
]

const LOW_PRIORITY_HOSTS = ['linkedin.com', 'wikipedia.org', 'medium.com']

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

export function isAllowedSearchResult(url: string): boolean {
  const host = hostOf(url)
  if (!host) return false
  return !BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
}

function searchHitScore(hit: WebSearchHit): number {
  const host = hostOf(hit.url) ?? ''
  let score = 0
  if (/\.gov(\.|$)|\.edu(\.|$)|\.ac\.|europa\.eu|tubitak|yok\.gov|itu\.edu/.test(host)) score += 4
  if (LOW_PRIORITY_HOSTS.some((h) => host.includes(h))) score -= 2
  const hay = `${hit.title} ${hit.snippet}`.toLowerCase()
  if (/\b(deadline|apply|application|başvuru|basvuru|call for|scholarship|burs|fellowship|grant)\b/.test(hay)) {
    score += 2
  }
  if (/20(25|26|27)/.test(hay)) score += 1
  return score
}

export function isWebSearchAvailable(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY)
}

export function webSearchProvider(): 'tavily' | 'brave' | null {
  if (process.env.TAVILY_API_KEY) return 'tavily'
  if (process.env.BRAVE_SEARCH_API_KEY) return 'brave'
  return null
}

async function tavilySearch(query: string, maxResults: number): Promise<WebSearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) return []

  const json = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string }[]
  }

  return (json.results ?? [])
    .filter((r) => r.url && isAllowedSearchResult(r.url))
    .map((r) => ({
      title: String(r.title ?? 'Result'),
      url: String(r.url),
      snippet: String(r.content ?? '').slice(0, 1200),
      source: 'tavily' as const,
    }))
}

async function braveSearch(query: string, maxResults: number): Promise<WebSearchHit[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return []

  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(Math.min(maxResults, 10)))

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) return []

  const json = (await res.json()) as {
    web?: { results?: { title?: string; url?: string; description?: string }[] }
  }

  return (json.web?.results ?? [])
    .filter((r) => r.url && isAllowedSearchResult(r.url))
    .map((r) => ({
      title: String(r.title ?? 'Result'),
      url: String(r.url),
      snippet: String(r.description ?? '').slice(0, 1200),
      source: 'brave' as const,
    }))
}

/** Run web search using Tavily (preferred) or Brave Search API. */
export async function webSearch(query: string, maxResults = 5): Promise<WebSearchHit[]> {
  const provider = webSearchProvider()
  if (!provider) return []

  const hits = provider === 'tavily' ?
    await tavilySearch(query, maxResults)
  : await braveSearch(query, maxResults)

  return hits
    .sort((a, b) => searchHitScore(b) - searchHitScore(a))
    .slice(0, maxResults)
}

/** Targeted verification query for a specific opening. */
export async function verifyOpeningSearch(
  funder: string,
  title: string,
  maxResults = 3,
): Promise<WebSearchHit[]> {
  const shortTitle = title.replace(/\s+/g, ' ').slice(0, 70)
  const year = new Date().getFullYear()
  const query = `"${funder}" ${shortTitle} scholarship deadline apply ${year}`
  return webSearch(query, maxResults)
}
