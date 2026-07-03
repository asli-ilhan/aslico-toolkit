import { parseNewsRssFeed } from '@/lib/newsletter/scrape'
import type { TravelVibe } from './destinations'

export interface TravelPick {
  title: string
  url: string
  source: string
  snippet?: string
  vibe: TravelVibe
  kind: 'place' | 'event' | 'dining' | 'experience' | 'nearby'
}

const MASS_TOURISM_PENALTY =
  /\b(top 10 things|must see|instagram spot|crowded|tourist trap|bucket list tiktok)\b/i

function googleNewsUrl(query: string, locale: string): string {
  const hl = locale === 'tr' ? 'tr' : 'en'
  const gl = locale === 'tr' ? 'TR' : 'US'
  const ceid = locale === 'tr' ? 'TR:tr' : 'US:en'
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`
}

const VIBE_QUERIES: Record<TravelVibe, (place: string) => string[]> = {
  offbeat: (p) => [
    `${p} off the beaten path travel`,
    `${p} unusual things to do locals`,
    `${p} underrated travel secret`,
  ],
  authentic: (p) => [
    `${p} authentic local culture not touristy`,
    `${p} traditional neighbourhood visit`,
    `${p} local food market insider`,
  ],
  'high-society': (p) => [
    `${p} exclusive private event gala`,
    `${p} members club art dinner society`,
    `${p} luxury insider travel discreet`,
  ],
  'hidden-gem': (p) => [
    `${p} hidden gem travel 2026`,
    `${p} secret places few tourists`,
    `${p} undiscovered destination near ${p}`,
  ],
}

function classifyKind(title: string, snippet: string): TravelPick['kind'] {
  const t = `${title} ${snippet}`.toLowerCase()
  if (/restaurant|dining|chef|michelin|supper/.test(t)) return 'dining'
  if (/festival|gala|ball|opera|exhibition|private view/.test(t)) return 'event'
  if (/museum|gallery|villa|palace|village|island|hike|trail/.test(t)) return 'place'
  if (/experience|retreat|workshop|tour/.test(t)) return 'experience'
  return 'experience'
}

export async function discoverTravelPicks(opts: {
  destination: string
  nearby?: string[]
  vibes: TravelVibe[]
  locale: string
  interests?: string[]
  avoidMassTourism?: boolean
}): Promise<TravelPick[]> {
  const queries: Array<{ q: string; vibe: TravelVibe; nearby?: boolean }> = []

  for (const vibe of opts.vibes) {
    for (const q of VIBE_QUERIES[vibe](opts.destination).slice(0, 2)) {
      queries.push({ q, vibe })
    }
  }

  for (const region of (opts.nearby ?? []).slice(0, 3)) {
    queries.push({
      q: `${region} day trip unusual hidden gem`,
      vibe: 'hidden-gem',
      nearby: true,
    })
  }

  for (const interest of (opts.interests ?? []).slice(0, 2)) {
    queries.push({
      q: `${opts.destination} ${interest} exclusive experience`,
      vibe: 'offbeat',
    })
  }

  const jobs = queries.map(({ q, vibe, nearby }) =>
    parseNewsRssFeed(googleNewsUrl(q, opts.locale), 'Travel scout').then((items) =>
      items.map((item) => ({ item, vibe, nearby: !!nearby })),
    ).catch(() => []),
  )

  const batches = await Promise.all(jobs)
  const seen = new Set<string>()
  const picks: TravelPick[] = []

  for (const batch of batches) {
    for (const { item, vibe, nearby } of batch) {
      const key = item.url.split('?')[0] ?? item.url
      if (seen.has(key)) continue
      const text = `${item.title} ${item.snippet}`
      if (opts.avoidMassTourism && MASS_TOURISM_PENALTY.test(text)) continue
      seen.add(key)
      picks.push({
        title: item.title,
        url: item.url,
        source: item.feedLabel,
        snippet: item.snippet,
        vibe,
        kind: nearby ? 'nearby' : classifyKind(item.title, item.snippet),
      })
    }
  }

  return picks.slice(0, 28)
}

export function groupPicksByVibe(picks: TravelPick[]): Record<TravelVibe, TravelPick[]> {
  const out: Record<TravelVibe, TravelPick[]> = {
    offbeat: [],
    authentic: [],
    'high-society': [],
    'hidden-gem': [],
  }
  for (const p of picks) {
    out[p.vibe].push(p)
  }
  return out
}
