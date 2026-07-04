import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'

const FETCH_HEADERS = {
  'User-Agent': 'asliCo-FundingScout/1.0 (primary-source verify)',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
}

export interface PrimarySourceFetch {
  url: string
  title?: string
  text: string
  fetchedAt: string
  ok: boolean
  status?: number
  deadline?: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function metaContent(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)`, 'i')
  return html.match(re)?.[1]?.trim()
}

/** Fetch a funding call page and extract readable primary-source text. */
export async function fetchPrimarySource(url: string): Promise<PrimarySourceFetch> {
  const fetchedAt = new Date().toISOString()
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(18000),
      redirect: 'follow',
    })

    if (!res.ok) {
      return { url, text: '', fetchedAt, ok: false, status: res.status }
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('pdf')) {
      return {
        url,
        text: `[PDF document at ${url} — open manually for deadline and eligibility]`,
        fetchedAt,
        ok: true,
        status: res.status,
      }
    }

    const html = await res.text()
    const ogTitle = metaContent(html, 'og:title')
    const title = ogTitle ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const ogDesc = metaContent(html, 'og:description')
    const metaDesc = metaContent(html, 'description')
    const bodyText = stripHtml(html).slice(0, 45000)
    const text = [title, ogDesc, metaDesc, bodyText].filter(Boolean).join('\n\n').slice(0, 45000)
    const deadline = parseDeadlineFromText(text)

    return {
      url,
      title,
      text,
      fetchedAt,
      ok: text.length > 80,
      status: res.status,
      deadline,
    }
  } catch {
    return { url, text: '', fetchedAt, ok: false }
  }
}

export async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((item, j) => fn(item, i + j)))
    results.push(...batchResults)
  }
  return results
}
