import type { ScanLimits } from '@/lib/job-agent/scan-limits'
import type { JobCandidate } from './feeds'

const JSON_HEADERS: Record<string, string> = {
  'User-Agent':
    'asliCo-Toolkit-JobAgent/1.0 (https://aslico-toolkit.vercel.app; remote job discovery)',
  Accept: 'application/json',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function companyFromTitle(title: string): { company: string; role: string } {
  const t = title.trim()
  if (t.includes(' at ')) {
    const [role, company] = t.split(' at ')
    return { role: role?.trim() || t, company: company?.trim() || 'Unknown' }
  }
  if (t.includes(' - ')) {
    const [role, company] = t.split(' - ')
    return { role: role?.trim() || t, company: company?.trim() || 'Unknown' }
  }
  return { role: t, company: 'Unknown' }
}

export async function fetchRemoteOkJobs(limit = 100): Promise<JobCandidate[]> {
  const res = await fetch('https://remoteok.com/api', {
    signal: AbortSignal.timeout(20000),
    headers: JSON_HEADERS,
  })
  if (!res.ok) throw new Error(`RemoteOK API ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>[]
  return data
    .filter((row) => typeof row.position === 'string' && row.id)
    .slice(0, limit)
    .map((row) => ({
      company: String(row.company ?? 'Unknown').trim(),
      role: String(row.position).trim(),
      jobDescription: stripHtml(String(row.description ?? '')).slice(0, 12000),
      jobUrl: String(row.url ?? `https://remoteok.com/remote-jobs/${row.slug ?? row.id}`),
      source: 'remoteok_api',
    }))
}

export async function fetchRemotiveApiJobs(limit = 80): Promise<JobCandidate[]> {
  const res = await fetch('https://remotive.com/api/remote-jobs', {
    signal: AbortSignal.timeout(20000),
    headers: JSON_HEADERS,
  })
  if (!res.ok) throw new Error(`Remotive API ${res.status}`)

  const data = (await res.json()) as { jobs?: Record<string, unknown>[] }
  return (data.jobs ?? [])
    .slice(0, limit)
    .map((j) => ({
      company: String(j.company_name ?? 'Unknown').trim(),
      role: String(j.title ?? 'Role').trim(),
      jobDescription: stripHtml(String(j.description ?? '')).slice(0, 12000),
      jobUrl: String(j.url ?? ''),
      source: 'remotive_api',
    }))
}

interface MuseJob {
  name: string
  contents?: string
  company?: { name?: string }
  refs?: { landing_page?: string }
}

export async function fetchTheMuseJobs(pages = 4): Promise<JobCandidate[]> {
  const jobs: JobCandidate[] = []
  for (let page = 0; page < pages; page++) {
    const url = `https://www.themuse.com/api/public/jobs?page=${page}&location=Remote&page_size=25`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: JSON_HEADERS })
    if (!res.ok) throw new Error(`The Muse API ${res.status}`)
    const data = (await res.json()) as { results?: MuseJob[] }
    for (const j of data.results ?? []) {
      jobs.push({
        company: j.company?.name?.trim() || companyFromTitle(j.name).company,
        role: j.name?.trim() || 'Role',
        jobDescription: stripHtml(j.contents ?? '').slice(0, 12000),
        jobUrl: j.refs?.landing_page,
        source: 'themuse_api',
      })
    }
    if (!(data.results?.length ?? 0)) break
  }
  return jobs
}

interface WorkingNomadsJob {
  title: string
  description?: string
  url?: string
  company_name?: string
}

export async function fetchWorkingNomadsJobs(): Promise<JobCandidate[]> {
  const res = await fetch('https://www.workingnomads.co/api/exposed_jobs/', {
    signal: AbortSignal.timeout(20000),
    headers: {
      ...JSON_HEADERS,
      'User-Agent': 'Mozilla/5.0 (compatible; asliCo-Toolkit/1.0)',
    },
  })
  if (!res.ok) throw new Error(`Working Nomads API ${res.status}`)

  const data = (await res.json()) as WorkingNomadsJob[]
  return (data ?? []).slice(0, 120).map((j) => {
    const parsed = companyFromTitle(j.title ?? '')
    return {
      company: j.company_name?.trim() || parsed.company,
      role: parsed.role,
      jobDescription: stripHtml(j.description ?? j.title ?? '').slice(0, 12000),
      jobUrl: j.url,
      source: 'workingnomads_api',
    }
  })
}

/** Adzuna aggregates Indeed, Glassdoor, Monster and others (official API). */
export async function fetchAdzunaJobs(
  searchTerms: string[],
  countries = ['us', 'gb', 'de', 'ca', 'au'],
): Promise<JobCandidate[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []

  const query = searchTerms.slice(0, 5).join(' ') || 'software engineer'
  const what = `remote ${query}`.trim()
  const jobs: JobCandidate[] = []

  for (const country of countries) {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('what', what)
    url.searchParams.set('results_per_page', '50')
    url.searchParams.set('max_days_old', '14')

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15000),
        headers: JSON_HEADERS,
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        results?: {
          company?: { display_name?: string }
          title?: string
          description?: string
          redirect_url?: string
        }[]
      }
      for (const r of data.results ?? []) {
        jobs.push({
          company: r.company?.display_name?.trim() || 'Unknown',
          role: r.title?.trim() || 'Role',
          jobDescription: stripHtml(r.description ?? '').slice(0, 12000),
          jobUrl: r.redirect_url,
          source: `adzuna_${country}`,
        })
      }
    } catch {
      /* try next country */
    }
  }
  return jobs
}

/** Jooble indexes LinkedIn, Indeed, Glassdoor and 70+ boards (official API). */
export async function fetchJoobleJobs(searchTerms: string[]): Promise<JobCandidate[]> {
  const apiKey = process.env.JOOBLE_API_KEY
  if (!apiKey) return []

  const keywords = searchTerms.slice(0, 6).join(' ') || 'remote machine learning engineer'
  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...JSON_HEADERS },
    body: JSON.stringify({ keywords, location: 'remote', page: 1 }),
  })
  if (!res.ok) throw new Error(`Jooble API ${res.status}`)

  const data = (await res.json()) as {
    jobs?: { title?: string; company?: string; snippet?: string; link?: string; location?: string }[]
  }
  return (data.jobs ?? []).slice(0, 80).map((j) => ({
    company: j.company?.trim() || 'Unknown',
    role: j.title?.trim() || 'Role',
    jobDescription: stripHtml(`${j.snippet ?? ''} ${j.location ?? ''}`).slice(0, 12000),
    jobUrl: j.link,
    source: 'jooble_agg',
  }))
}

/** Findwork.dev — developer jobs (requires free API token). */
export async function fetchFindworkJobs(searchTerms: string[]): Promise<JobCandidate[]> {
  const token = process.env.FINDWORK_API_KEY
  if (!token) return []

  const search = encodeURIComponent(searchTerms.slice(0, 3).join(' ') || 'machine learning remote')
  const res = await fetch(`https://findwork.dev/api/jobs/?search=${search}&location=remote`, {
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Token ${token}`, ...JSON_HEADERS },
  })
  if (!res.ok) throw new Error(`Findwork API ${res.status}`)

  const data = (await res.json()) as {
    results?: { role?: string; company_name?: string; description?: string; url?: string }[]
  }
  return (data.results ?? []).slice(0, 50).map((j) => ({
    company: j.company_name?.trim() || 'Unknown',
    role: j.role?.trim() || 'Role',
    jobDescription: stripHtml(j.description ?? '').slice(0, 12000),
    jobUrl: j.url,
    source: 'findwork_api',
  }))
}

export interface AggregatorFetchResult {
  jobs: JobCandidate[]
  logs: string[]
  warnings: string[]
}

export async function collectAggregatorJobs(
  searchTerms: string[],
  limits?: Pick<ScanLimits, 'remoteOkLimit' | 'remotiveLimit'>,
): Promise<AggregatorFetchResult> {
  const jobs: JobCandidate[] = []
  const logs: string[] = []
  const warnings: string[] = []

  const remoteOkLimit = limits?.remoteOkLimit ?? 120
  const remotiveLimit = limits?.remotiveLimit ?? 100

  const tasks: { name: string; run: () => Promise<JobCandidate[]> }[] = [
    { name: 'RemoteOK', run: () => fetchRemoteOkJobs(remoteOkLimit) },
    { name: 'Remotive API', run: () => fetchRemotiveApiJobs(remotiveLimit) },
    { name: 'The Muse', run: () => fetchTheMuseJobs(4) },
    { name: 'Working Nomads', run: () => fetchWorkingNomadsJobs() },
    { name: 'Findwork', run: () => fetchFindworkJobs(searchTerms) },
    { name: 'Adzuna (Indeed/Glassdoor agg.)', run: () => fetchAdzunaJobs(searchTerms) },
    { name: 'Jooble (LinkedIn/Indeed agg.)', run: () => fetchJoobleJobs(searchTerms) },
  ]

  for (const task of tasks) {
    try {
      const batch = await task.run()
      if (batch.length) {
        jobs.push(...batch)
        logs.push(`${task.name}: ${batch.length} jobs`)
      } else if (task.name.includes('Adzuna') && !process.env.ADZUNA_APP_ID) {
        /* logged once below */
      } else if (task.name.includes('Jooble') && !process.env.JOOBLE_API_KEY) {
        /* logged once below */
      } else {
        logs.push(`${task.name}: 0 jobs`)
      }
    } catch (err) {
      logs.push(`${task.name} failed: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
    warnings.push(
      'Adzuna not configured — add ADZUNA_APP_ID + ADZUNA_APP_KEY (free at developer.adzuna.com) for Indeed/Glassdoor listings.',
    )
  }
  if (!process.env.JOOBLE_API_KEY) {
    warnings.push(
      'Jooble not configured — add JOOBLE_API_KEY (free at jooble.org/api/about) for LinkedIn/Indeed/Glassdoor listings.',
    )
  }

  return { jobs, logs, warnings }
}
