export interface JobCandidate {
  company: string
  role: string
  jobDescription: string
  jobUrl?: string
  source: string
}

export const RSS_ITEMS_PER_FEED = 30
export const MAX_NIGHTLY_PACKS = 10

/** Built-in RSS feeds — always scanned alongside watchlist. */
export const BUILTIN_RSS_FEEDS = [
  // Remotive
  'https://remotive.com/remote-jobs/feed',
  // Jobicy (multiple categories)
  'https://jobicy.com/?feed=job_feed&posts_per_page=50',
  'https://jobicy.com/?feed=job_feed&job_categories=dev&posts_per_page=40',
  'https://jobicy.com/?feed=job_feed&job_categories=data-science&posts_per_page=40',
  'https://jobicy.com/?feed=job_feed&job_categories=engineering&posts_per_page=40',
  'https://jobicy.com/?feed=job_feed&job_categories=qa-testing&posts_per_page=30',
  'https://jobicy.com/?feed=job_feed&job_categories=marketing&posts_per_page=25',
  'https://jobicy.com/?feed=job_feed&job_categories=project-management&posts_per_page=25',
  // We Work Remotely
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
  'https://weworkremotely.com/categories/remote-data-jobs.rss',
  'https://weworkremotely.com/categories/remote-product-jobs.rss',
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'https://weworkremotely.com/categories/remote-management-jobs.rss',
  'https://weworkremotely.com/categories/remote-marketing-jobs.rss',
  'https://weworkremotely.com/categories/remote-sales-jobs.rss',
  'https://weworkremotely.com/categories/remote-copywriting-jobs.rss',
  // Other remote boards
  'https://himalayas.app/jobs/rss',
  'https://landing.jobs/feed',
  'https://justremote.co/remote-jobs.rss',
  'https://jobspresso.co/feed/',
  'https://dynamitejobs.com/company/remote-jobs.rss',
  'https://www.skipthedrive.com/feed/',
  // Built In (US tech)
  'https://builtin.com/jobs/remote/dev-engineering/remote/rss',
  'https://builtin.com/jobs/remote/data-analytics/remote/rss',
  'https://builtin.com/jobs/remote/product/remote/rss',
  'https://builtin.com/jobs/remote/marketing/remote/rss',
  'https://builtin.com/jobs/remote/operations/remote/rss',
]

/** Extra search terms merged with profile domains and user keywords. */
export const BUILTIN_DISCOVERY_KEYWORDS = [
  'machine learning',
  'data science',
  'data scientist',
  'ml engineer',
  'ai engineer',
  'research engineer',
  'research scientist',
  'python developer',
  'software engineer',
  'backend engineer',
  'full stack',
  'predictive maintenance',
  'maritime',
  'offshore',
  'renewable energy',
  'wind energy',
  'digital twin',
  'sensor data',
  'remote',
  'contract',
  'freelance',
  'analytics',
  'deep learning',
  'computer vision',
  'PhD',
  'tableau',
  'iot',
  'renewables',
  'offshore wind',
  'structural engineer',
  'consultant',
  'contractor',
]

const FETCH_HEADERS = {
  'User-Agent': 'asliCo-Toolkit-JobAgent/1.0 (+https://github.com/aslico/toolkit)',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function tagValue(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  return decodeXmlEntities(block.match(re)?.[1]?.trim() ?? '')
}

function parseTitleParts(title: string): { company: string; role: string } {
  const t = title.trim()
  if (t.includes(' at ')) {
    const [role, company] = t.split(' at ')
    return { role: role?.trim() || t, company: company?.trim() || 'Unknown' }
  }
  if (t.includes(': ')) {
    const [company, role] = t.split(': ')
    return { company: company?.trim() || 'Unknown', role: role?.trim() || t }
  }
  if (t.includes(' - ')) {
    const parts = t.split(' - ')
    if (parts.length >= 2) {
      return { role: parts[0]?.trim() || t, company: parts.slice(1).join(' - ').trim() || 'Unknown' }
    }
  }
  return { company: 'Unknown', role: t }
}

function itemFromBlock(block: string, source: string): JobCandidate | null {
  const title =
    tagValue(block, 'title') ??
    block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
  if (!title) return null

  const link =
    block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1]?.trim() ??
    tagValue(block, 'link') ??
    tagValue(block, 'guid')

  const companyTag = tagValue(block, 'company')
  const { company: parsedCompany, role } = parseTitleParts(title)
  const company = companyTag?.trim() || parsedCompany

  const desc =
    tagValue(block, 'description') ??
    tagValue(block, 'summary') ??
    tagValue(block, 'content') ??
    ''

  return {
    company,
    role,
    jobDescription: stripHtml(desc).slice(0, 12000),
    jobUrl: link,
    source,
  }
}

export async function parseRssFeed(url: string, source = 'rss'): Promise<JobCandidate[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: FETCH_HEADERS,
  })
  if (!res.ok) throw new Error(`RSS fetch ${res.status}`)
  const xml = await res.text()

  const items: JobCandidate[] = []
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ]

  for (const block of blocks) {
    const job = itemFromBlock(block, source)
    if (job) items.push(job)
  }
  return items
}

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  jobExcerpt?: string
  jobDescription?: string
  jobType?: string[]
  jobGeo?: string
}

export async function fetchJobicyJobs(options: {
  count?: number
  jobCategories?: string
  searchKeywords?: string
  searchRegion?: string
}): Promise<JobCandidate[]> {
  const params = new URLSearch('https://jobicy.com/api/v2/remote-jobs')
  params.set('count', String(options.count ?? 40))
  if (options.jobCategories) params.set('job_categories', options.jobCategories)
  if (options.searchKeywords) params.set('search_keywords', options.searchKeywords)
  if (options.searchRegion) params.set('search_region', options.searchRegion)

  const res = await fetch(params.toString(), {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', ...FETCH_HEADERS },
  })
  if (!res.ok) throw new Error(`Jobicy API ${res.status}`)

  const data = (await res.json()) as { jobs?: JobicyJob[] }
  return (data.jobs ?? []).map((j) => ({
    company: j.companyName?.trim() || 'Unknown',
    role: j.jobTitle?.trim() || 'Role',
    jobDescription: stripHtml(j.jobDescription ?? j.jobExcerpt ?? '').slice(0, 12000),
    jobUrl: j.url,
    source: 'jobicy_api',
  }))
}

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags?: string[]
}

export async function fetchArbeitnowJobs(): Promise<JobCandidate[]> {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', ...FETCH_HEADERS },
  })
  if (!res.ok) throw new Error(`Arbeitnow API ${res.status}`)

  const data = (await res.json()) as { data?: ArbeitnowJob[] }
  return (data.data ?? [])
    .filter((j) => j.remote)
    .slice(0, 60)
    .map((j) => ({
      company: j.company_name?.trim() || 'Unknown',
      role: j.title?.trim() || 'Role',
      jobDescription: stripHtml(j.description ?? '').slice(0, 12000),
      jobUrl: j.url ?? `https://www.arbeitnow.com/jobs/${j.slug}`,
      source: 'arbeitnow_api',
    }))
}

export async function collectJobicyPool(searchTerms: string[]): Promise<JobCandidate[]> {
  const jobs: JobCandidate[] = []
  const tasks: Promise<JobCandidate[]>[] = [
    fetchJobicyJobs({ count: 50 }),
    fetchJobicyJobs({ count: 40, jobCategories: 'dev' }),
    fetchJobicyJobs({ count: 40, jobCategories: 'data-science' }),
    fetchJobicyJobs({ count: 30, jobCategories: 'engineering' }),
    fetchJobicyJobs({ count: 25, jobCategories: 'qa-testing' }),
  ]

  for (const term of searchTerms.slice(0, 12)) {
    tasks.push(fetchJobicyJobs({ count: 25, searchKeywords: term }))
  }

  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'fulfilled') jobs.push(...r.value)
  }
  return jobs
}

export function uniqueFeedUrls(urls: string[]): string[] {
  return [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
}
