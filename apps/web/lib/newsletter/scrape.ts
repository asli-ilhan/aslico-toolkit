import {
  DEFAULT_INTERESTS,
  NEWS_TOPICS,
  type NewsTopicId,
} from './sources'

export interface NewsHeadline {
  title: string
  url: string
  source: string
  snippet?: string
  publishedAt?: string
  topic?: NewsTopicId
}

export interface NewsTopicSection {
  topicId: NewsTopicId
  topicLabel: string
  headlines: NewsHeadline[]
}

export interface ScrapeResult {
  headlines: NewsHeadline[]
  topicSections: NewsTopicSection[]
}

export interface RssNewsItem {
  title: string
  url: string
  snippet: string
  publishedAt?: string
  feedLabel: string
  topic?: NewsTopicId
}

export async function parseNewsRssFeed(
  url: string,
  feedLabel?: string,
  topic?: NewsTopicId,
): Promise<RssNewsItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'asliCo-Toolkit/1.0 (newsletter)' },
  })
  if (!res.ok) throw new Error(`RSS ${res.status}`)

  const xml = await res.text()
  const label = feedLabel ?? new URL(url).hostname
  const rssItems = parseRssItems(xml, label, topic)
  if (rssItems.length) return rssItems
  return parseAtomEntries(xml, label, topic)
}

function parseRssItems(xml: string, label: string, topic?: NewsTopicId): RssNewsItem[] {
  const items: RssNewsItem[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks) {
    const parsed = parseItemBlock(block, label, topic)
    if (parsed) items.push(parsed)
  }
  return items
}

function parseAtomEntries(xml: string, label: string, topic?: NewsTopicId): RssNewsItem[] {
  const items: RssNewsItem[] = []
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  for (const block of entryBlocks) {
    const title = cleanXmlText(
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1],
    )
    let link = cleanXmlText(
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1],
    )
    if (!link) {
      link = cleanXmlText(
        block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1],
      )
    }
    const summary = cleanXmlText(
      block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1] ??
        block.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1],
    )
    const published = cleanXmlText(
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ??
        block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1],
    )
    if (!title || !link?.startsWith('http')) continue
    items.push({
      title,
      url: link,
      snippet: summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280),
      publishedAt: published,
      feedLabel: label,
      topic,
    })
  }
  return items
}

function parseItemBlock(block: string, label: string, topic?: NewsTopicId): RssNewsItem | null {
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
  const pubDate = cleanXmlText(block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1])

  if (!title || !link?.startsWith('http')) return null

  return {
    title,
    url: link,
    snippet: desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280),
    publishedAt: pubDate,
    feedLabel: label,
    topic,
  }
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

const FASHION_KEYWORDS =
  /\b(fashion week|haute couture|runway|vogue|designer collection|luxury fashion|business of fashion|harper'?s bazaar|tatler)\b/i

const MARITIME_BOOST_KEYWORDS =
  /\b(shipbuilding|ocean engineering|maritime|vessel|shipping|shipyard|naval|offshore|ais\b|digital twin|hull|propeller|fleet)\b/i

function interestScore(text: string, interests: string[]): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const interest of interests) {
    for (const word of interest.toLowerCase().split(/[\s,+/]+/)) {
      if (word.length > 2 && lower.includes(word)) score += 2
    }
    if (lower.includes(interest.toLowerCase())) score += 3
  }
  if (MARITIME_BOOST_KEYWORDS.test(text)) score += 6
  if (FASHION_KEYWORDS.test(text)) score -= 12
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

function toHeadline(item: RssNewsItem): NewsHeadline {
  return {
    title: item.title,
    url: item.url,
    source: item.feedLabel,
    snippet: item.snippet || undefined,
    publishedAt: item.publishedAt,
    topic: item.topic,
  }
}

async function fetchFeedBatch(jobs: Array<Promise<RssNewsItem[]>>): Promise<RssNewsItem[]> {
  const batches = await Promise.all(jobs)
  return batches.flat()
}

export async function scrapeNewsHeadlines(opts: {
  interests?: string[]
  customFeeds?: string[]
  locale: string
  maxItems?: number
}): Promise<ScrapeResult> {
  const interests =
    opts.interests?.filter(Boolean).length ? opts.interests!.filter(Boolean) : DEFAULT_INTERESTS
  const customFeeds = opts.customFeeds?.filter(Boolean) ?? []
  const locale = opts.locale

  const feedJobs: Array<Promise<RssNewsItem[]>> = []

  for (const topic of NEWS_TOPICS) {
    for (const feed of topic.feeds) {
      feedJobs.push(
        parseNewsRssFeed(feed.url, feed.label, topic.id).catch(() => []),
      )
    }
    for (const query of topic.googleQueries.slice(0, 4)) {
      feedJobs.push(
        parseNewsRssFeed(
          googleNewsRssUrl(query, locale),
          `Google News · ${query}`,
          topic.id,
        ).catch(() => []),
      )
    }
  }

  for (const interest of interests.slice(0, 12)) {
    feedJobs.push(
      parseNewsRssFeed(googleNewsRssUrl(interest, locale), `Google News · ${interest}`).catch(
        () => [],
      ),
    )
  }

  for (const feedUrl of customFeeds.slice(0, 20)) {
    feedJobs.push(
      parseNewsRssFeed(feedUrl).catch(() => []),
    )
  }

  const collected = await fetchFeedBatch(feedJobs)
  const headlines: NewsHeadline[] = collected.map((item) => toHeadline(item))

  const scored = dedupeByUrl(headlines)
    .map((h) => {
      const text = `${h.title} ${h.snippet ?? ''}`
      return {
        ...h,
        _score: interestScore(text, interests),
      }
    })
    .sort((a, b) => b._score - a._score)

  const topicSections: NewsTopicSection[] = []

  for (const topic of NEWS_TOPICS) {
    const topicLabel = locale === 'tr' ? topic.labelTr : topic.labelEn
    const ranked = scored
      .filter((h) => h.topic === topic.id)
      .sort((a, b) => b._score - a._score)
      .slice(0, topic.perTopicCap)
      .map(({ _score: _, ...h }) => h)

    if (ranked.length) {
      topicSections.push({ topicId: topic.id, topicLabel, headlines: ranked })
    }
  }

  const maxItems = opts.maxItems ?? 45
  const flat = dedupeByUrl(
    topicSections.flatMap((s) => s.headlines).concat(
      scored.slice(0, maxItems).map(({ _score: _, ...h }) => h),
    ),
  ).slice(0, maxItems)

  return { headlines: flat, topicSections: topicSections.filter((s) => s.headlines.length > 0) }
}

/** @deprecated Use scrapeNewsHeadlines which returns ScrapeResult */
export async function scrapeNewsHeadlinesFlat(opts: Parameters<typeof scrapeNewsHeadlines>[0]): Promise<NewsHeadline[]> {
  const result = await scrapeNewsHeadlines(opts)
  return result.headlines
}
