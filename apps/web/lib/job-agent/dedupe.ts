import type { SupabaseClient } from '@supabase/supabase-js'

export interface JobCandidateRef {
  company: string
  role: string
  jobUrl?: string | null
}

/** Normalize URL for duplicate detection (host + path, no query/fragment). */
export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '').toLowerCase()
    return `${host}${path}`
  } catch {
    return url.trim().toLowerCase()
  }
}

export function normalizeJobKey(company: string, role: string): string {
  const c = company.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const r = role.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return `${c}::${r}`
}

const PIPELINE_STATUSES = new Set([
  'pending_review',
  'approved',
  'submitted',
  'discovered',
  'pack_ready',
])

interface StoredJob {
  jobUrl: string | null
  company: string
  role: string
  status: string
  submittedAt: string | null
}

export class JobDedupeIndex {
  private readonly byUrl = new Set<string>()
  private readonly appliedKeys = new Set<string>()
  private readonly pipelineKeys = new Set<string>()

  constructor(records: StoredJob[]) {
    for (const row of records) {
      const urlKey = normalizeJobUrl(row.jobUrl)
      if (urlKey) this.byUrl.add(urlKey)

      const key = normalizeJobKey(row.company, row.role)
      if (row.submittedAt || row.status === 'submitted') {
        this.appliedKeys.add(key)
        if (urlKey) this.byUrl.add(urlKey)
      }
      if (PIPELINE_STATUSES.has(row.status)) {
        this.pipelineKeys.add(key)
      }
    }
  }

  check(job: JobCandidateRef): { duplicate: boolean; reason?: string } {
    const urlKey = normalizeJobUrl(job.jobUrl)
    const key = normalizeJobKey(job.company, job.role)

    if (urlKey && this.byUrl.has(urlKey)) {
      return { duplicate: true, reason: 'Already seen (same URL)' }
    }
    if (this.appliedKeys.has(key)) {
      return { duplicate: true, reason: `Already applied: ${job.company}` }
    }
    if (this.pipelineKeys.has(key)) {
      return { duplicate: true, reason: `Already in inbox: ${job.company} · ${job.role}` }
    }
    return { duplicate: false }
  }

  /** Track jobs added in the same run to avoid duplicate packs. */
  remember(job: JobCandidateRef): void {
    const urlKey = normalizeJobUrl(job.jobUrl)
    const key = normalizeJobKey(job.company, job.role)
    if (urlKey) this.byUrl.add(urlKey)
    this.pipelineKeys.add(key)
  }
}

export async function loadJobDedupeIndex(
  supabase: SupabaseClient,
  userId: string,
): Promise<JobDedupeIndex> {
  const { data } = await supabase
    .from('application_packs')
    .select('job_url, company, role, status, submitted_at')
    .eq('user_id', userId)

  const records: StoredJob[] = (data ?? []).map((row) => ({
    jobUrl: row.job_url,
    company: row.company,
    role: row.role,
    status: row.status,
    submittedAt: row.submitted_at,
  }))

  return new JobDedupeIndex(records)
}

/** In-memory dedupe while collecting candidates from many feeds. */
export function dedupeCandidates<T extends JobCandidateRef>(jobs: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const job of jobs) {
    const urlKey = normalizeJobUrl(job.jobUrl)
    const key = urlKey ?? normalizeJobKey(job.company, job.role)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(job)
  }
  return out
}
