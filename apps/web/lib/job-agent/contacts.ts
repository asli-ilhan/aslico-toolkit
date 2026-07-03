export interface ContactCandidate {
  name: string
  title: string
  email: string
  source: 'hunter' | 'scrape' | 'pattern' | 'page'
  confidence: number
}

const JOB_BOARD_HOSTS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'indeed.com',
  'linkedin.com',
  'smartrecruiters.com',
  'myworkdayjobs.com',
  'bamboohr.com',
  'jobvite.com',
]

export function extractCompanyDomain(jobUrl?: string | null, company?: string): string | null {
  if (jobUrl) {
    try {
      const u = new URL(jobUrl)
      const host = u.hostname.replace(/^www\./, '')

      if (host.includes('boards.greenhouse.io')) {
        const m = u.pathname.match(/\/([^/]+)\/jobs/)
        if (m?.[1]) return slugToDomain(m[1])
      }
      if (host.includes('jobs.lever.co')) {
        const m = u.pathname.match(/\/([^/]+)/)
        if (m?.[1]) return slugToDomain(m[1])
      }
      if (host.includes('jobs.ashbyhq.com')) {
        const m = u.pathname.match(/\/([^/]+)/)
        if (m?.[1]) return slugToDomain(m[1])
      }

      if (!JOB_BOARD_HOSTS.some((b) => host.includes(b))) {
        return host
      }
    } catch {
      /* invalid url */
    }
  }

  if (company) {
    return slugToDomain(company)
  }

  return null
}

function slugToDomain(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40)
  return slug ? `${slug}.com` : ''
}

export async function discoverContacts(
  company: string,
  role: string,
  jobUrl?: string | null,
): Promise<ContactCandidate[]> {
  const domain = extractCompanyDomain(jobUrl, company)
  const found = new Map<string, ContactCandidate>()

  if (domain) {
    const hunter = await hunterDomainSearch(domain)
    for (const c of hunter) found.set(c.email.toLowerCase(), c)

    const patterns = patternEmails(domain)
    for (const c of patterns) {
      if (!found.has(c.email.toLowerCase())) found.set(c.email.toLowerCase(), c)
    }

    const scraped = await scrapePublicEmails(domain)
    for (const c of scraped) {
      if (!found.has(c.email.toLowerCase())) found.set(c.email.toLowerCase(), c)
    }
  }

  return [...found.values()].slice(0, 25)
}

async function hunterDomainSearch(domain: string): Promise<ContactCandidate[]> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return []

  try {
    const url = new URL('https://api.hunter.io/v2/domain-search')
    url.searchParams.set('domain', domain)
    url.searchParams.set('api_key', key)
    url.searchParams.set('limit', '15')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []

    const json = (await res.json()) as {
      data?: {
        emails?: {
          value: string
          first_name?: string
          last_name?: string
          position?: string
          confidence?: number
          type?: string
        }[]
      }
    }

    return (json.data?.emails ?? [])
      .filter((e) => e.value && !isGenericNoise(e.value))
      .map((e) => ({
        name: [e.first_name, e.last_name].filter(Boolean).join(' ') || e.value.split('@')[0],
        title: e.position ?? e.type ?? 'Contact',
        email: e.value,
        source: 'hunter' as const,
        confidence: (e.confidence ?? 50) / 100,
      }))
  } catch {
    return []
  }
}

function patternEmails(domain: string): ContactCandidate[] {
  const prefixes = [
    { email: `careers@${domain}`, title: 'Careers' },
    { email: `jobs@${domain}`, title: 'Recruiting' },
    { email: `recruiting@${domain}`, title: 'Recruiting' },
    { email: `talent@${domain}`, title: 'Talent' },
    { email: `hr@${domain}`, title: 'Human Resources' },
  ]

  return prefixes.map((p) => ({
    name: p.title,
    title: p.title,
    email: p.email,
    source: 'pattern' as const,
    confidence: 0.35,
  }))
}

async function scrapePublicEmails(domain: string): Promise<ContactCandidate[]> {
  const paths = ['', '/about', '/team', '/careers', '/contact', '/company']
  const emails = new Map<string, ContactCandidate>()

  for (const path of paths) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        headers: { 'User-Agent': 'asliCo-Toolkit/1.0 (outreach discovery)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue

      const html = await res.text()
      const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
      for (const raw of matches) {
        const email = raw.toLowerCase()
        if (!email.endsWith(`@${domain}`) || isGenericNoise(email)) continue
        if (!emails.has(email)) {
          emails.set(email, {
            name: email.split('@')[0].replace(/[._]/g, ' '),
            title: 'Team',
            email,
            source: 'scrape',
            confidence: 0.5,
          })
        }
      }
    } catch {
      /* skip unreachable paths */
    }
  }

  return [...emails.values()]
}

function isGenericNoise(email: string): boolean {
  const local = email.split('@')[0].toLowerCase()
  const blocked = ['noreply', 'no-reply', 'donotreply', 'support', 'info', 'hello', 'contact', 'sales', 'press']
  return blocked.some((b) => local === b || local.startsWith(`${b}.`))
}
