/** Fetch job page text and extract title-like hints (best-effort, no JS rendering). */
export async function scrapeJobUrl(url: string): Promise<{
  title?: string
  company?: string
  description: string
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'asliCo-Toolkit/1.0 (job-agent scrape)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Could not fetch URL (${res.status})`)
  }

  const html = await res.text()
  const text = stripHtml(html).slice(0, 50000)

  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim()

  let company: string | undefined
  let role: string | undefined
  if (title?.includes(' at ')) {
    const [r, c] = title.split(' at ')
    role = r?.trim()
    company = c?.replace(/\s*\|.*$/, '').trim()
  } else if (title?.includes(' · ')) {
    const parts = title.split(' · ')
    company = parts[0]?.trim()
    role = parts[1]?.trim()
  }

  const jsonLd = extractJsonLdJob(html)
  if (jsonLd) {
    return {
      title: jsonLd.title ?? title,
      company: jsonLd.company ?? company,
      description: jsonLd.description || text,
    }
  }

  return {
    title,
    company,
    description: text,
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractJsonLdJob(html: string): {
  title?: string
  company?: string
  description?: string
} | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]) as Record<string, unknown>
      const job = findJobPosting(data)
      if (job) {
        const hiring = job.hiringOrganization as { name?: string } | undefined
        return {
          title: String(job.title ?? ''),
          company: hiring?.name,
          description: String(job.description ?? ''),
        }
      }
    } catch {
      /* skip invalid json-ld */
    }
  }
  return null
}

function findJobPosting(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (obj['@type'] === 'JobPosting') return obj
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      const found = findJobPosting(item)
      if (found) return found
    }
  }
  return null
}

export function guessRoleFromScrape(title?: string, company?: string): string {
  if (!title) return ''
  if (company && title.toLowerCase().includes(company.toLowerCase())) {
    return title.replace(new RegExp(company, 'i'), '').replace(/[·|–-]/g, '').trim()
  }
  return title
}
