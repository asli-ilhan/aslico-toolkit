export interface NewsHeadline {
  title: string
  url: string
  source: string
  snippet?: string
  publishedAt?: string
}

export interface RssNewsItem {
  title: string
  url: string
  snippet: string
  publishedAt?: string
  feedLabel: string
}

export async function parseNewsRssFeed(url: string, feedLabel?: string): Promise<RssNewsItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'asliCo-Toolkit/1.0 (newsletter)' },
  })
  if (!res.ok) throw new Error(`RSS ${res.status}`)

  const xml = await res.text()
  const items: RssNewsItem[] = []
  const label = feedLabel ?? new URL(url).hostname

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks) {
    const title = cleanXmlText(
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1],
    )
    let link = cleanXmlText(
      block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1],
    )
    if (!link) {
      link = cleanXmlText(block.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i)?.[1])
    }
    const desc = cleanXmlText(
      block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] ??
        block.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1],
    )
    const pubDate = cleanXmlText(
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1],
    )

    if (!title || !link?.startsWith('http')) continue

    items.push({
      title,
      url: link,
      snippet: desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280),
      publishedAt: pubDate,
      feedLabel: label,
    })
  }

  return items
}

function cleanXmlText(raw?: string): string {
  if (!raw) return ''
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function googleNewsRssUrl(query: string, locale: string): string {
  const hl = locale === 'tr' ? 'tr' : locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'en'
  const gl =
    locale === 'tr' ? 'TR'
    : locale === 'fr' ? 'FR'
    : locale === 'es' ? 'ES'
    : 'US'
  const ceid =
    locale === 'tr' ? 'TR:tr'
    : locale === 'fr' ? 'FR:fr'
    : locale === 'es' ? 'ES:es'
    : 'US:en'
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`
}

function interestScore(text: string, interests: string[]): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const interest of interests) {
    for (const word of interest.toLowerCase().split(/[\s,+/]+/)) {
      if (word.length > 2 && lower.includes(word)) score += 2
    }
    if (lower.includes(interest.toLowerCase())) score += 3
  }
  return score
}

function dedupeByUrl(items: NewsHeadline[]): NewsHeadline[] {
  const seen = new Set<string>()
  const out: NewsHeadline[] = []
  for (const item of items) {
    const key = item.url.split('?')[0] ?? item.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function scrapeNewsHeadlines(opts: {
  interests: string[]
  customFeeds: string[]
  locale: string
  maxItems?: number
}): Promise<NewsHeadline[]> {
  const maxItems = opts.maxItems ?? 12
  const collected: NewsHeadline[] = []
  const errors: string[] = []

  const interestQueries = opts.interests.filter(Boolean).slice(0, 8)
  const feedJobs: Array<Promise<RssNewsItem[]>> = []

  for (const interest of interestQueries) {
    feedJobs.push(
      parseNewsRssFeed(googleNewsRssUrl(interest, opts.locale), `Google News · ${interest}`).catch(
        () => [],
      ),
    )
  }

  for (const feedUrl of opts.customFeeds.filter(Boolean).slice(0, 10)) {
    feedJobs.push(parseNewsRssFeed(feedUrl).catch((e) => {
      errors.push(`${feedUrl}: ${e instanceof Error ? e.message : 'failed'}`)
      return []
    }))
  }

  const batches = await Promise.all(feedJobs)
  for (const batch of batches) {
    for (const item of batch) {
      collected.push({
        title: item.title,
        url: item.url,
        source: item.feedLabel,
        snippet: item.snippet || undefined,
        publishedAt: item.publishedAt,
      })
    }
  }

  const scored = collected
    .map((h) => ({
      ...h,
      _score: interestScore(`${h.title} ${h.snippet ?? ''}`, opts.interests),
    }))
    .sort((a, b) => b._score - a._score)

  const withScore = scored.filter((h) => h._score > 0)
  const pool = withScore.length >= 4 ? withScore : scored

  return dedupeByUrl(pool.map(({ _score: _, ...h }) => h)).slice(0, maxItems)
}
