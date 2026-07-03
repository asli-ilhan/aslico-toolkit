import { parseNewsRssFeed } from '@/lib/newsletter/scrape'

export interface CultureEventPick {
  title: string
  url: string
  source: string
  snippet?: string
  kind: 'exhibition' | 'concert' | 'theater' | 'festival' | 'other'
}

function googleNewsUrl(query: string, locale: string): string {
  const hl = locale === 'tr' ? 'tr' : 'en'
  const gl = locale === 'tr' ? 'TR' : 'US'
  const ceid = locale === 'tr' ? 'TR:tr' : 'US:en'
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`
}

function classifyKind(title: string, snippet: string): CultureEventPick['kind'] {
  const t = `${title} ${snippet}`.toLowerCase()
  if (/exhibition|museum|gallery|sergi|biennial/.test(t)) return 'exhibition'
  if (/concert|live music|festival|dj\b|orchestra/.test(t)) return 'concert'
  if (/theatre|theater|play\b|opera|ballet|tiyatro/.test(t)) return 'theater'
  if (/festival/.test(t)) return 'festival'
  return 'other'
}

export async function scoutCityEvents(
  city: string,
  opts: { locale: string; spotifyArtists?: string[]; interests?: string[] },
): Promise<CultureEventPick[]> {
  const queries = [
    `${city} museum exhibition 2026`,
    `${city} art gallery opening`,
    `${city} concert live music`,
    `${city} theatre play opera`,
    `${city} cultural events this month`,
  ]

  for (const artist of (opts.spotifyArtists ?? []).slice(0, 2)) {
    queries.push(`${artist} concert ${city}`)
  }
  for (const interest of (opts.interests ?? []).slice(0, 2)) {
    queries.push(`${city} ${interest} event`)
  }

  const jobs = queries.map((q) =>
    parseNewsRssFeed(googleNewsUrl(q, opts.locale), `Google · ${city}`).catch(() => []),
  )
  const batches = await Promise.all(jobs)
  const seen = new Set<string>()
  const picks: CultureEventPick[] = []

  for (const batch of batches) {
    for (const item of batch.slice(0, 4)) {
      const key = item.url.split('?')[0] ?? item.url
      if (seen.has(key)) continue
      seen.add(key)
      picks.push({
        title: item.title,
        url: item.url,
        source: item.feedLabel,
        snippet: item.snippet,
        kind: classifyKind(item.title, item.snippet),
      })
    }
  }

  return picks.slice(0, 10)
}
