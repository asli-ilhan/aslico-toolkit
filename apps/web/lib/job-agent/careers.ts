import type { JobCandidate } from '@/lib/job-agent/feeds'

const JOB_LINK_RE =
  /href=["']([^"']*(?:\/jobs?\/|\/careers?\/|\/positions?\/|jobs\.lever\.co|boards\.greenhouse\.io|jobs\.ashbyhq\.com|workdayjobs\.com|myworkdayjobs\.com)[^"']*)["']/gi

const OPEN_APPLICATION_PHRASES = [
  'open application',
  'speculative application',
  'send your cv',
  'send your resume',
  'spontaneous application',
  'general application',
  'talent pool',
  'express interest',
  'no suitable role',
  'always looking for',
  'join our team',
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function absoluteUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function guessCompanyFromUrl(url: string, label?: string): string {
  if (label?.trim()) return label.trim()
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const part = host.split('.')[0]
    return part.charAt(0).toUpperCase() + part.slice(1)
  } catch {
    return 'Unknown'
  }
}

const CAREERS_JUNK_TITLE_RE =
  /\b(why |life at |inclusion at |working at |recruitment process|early careers|our culture|meet our|diversity and|belonging|graduate programme overview|about us|contact us|search jobs|job search|talent community)\b/i

const CAREERS_JUNK_PATH_RE =
  /\/(why-|life-at|inclusion|culture|diversity|early-careers|recruitment-process|about|our-people|stories|news|blog|events|search)(\/|$|\?)/i

const STRONG_JOB_URL_RE =
  /jobs\.lever\.co|boards\.greenhouse\.io|jobs\.ashbyhq\.com|myworkdayjobs\.com|workdayjobs\.com|\/jobs\/[^/]+|\/positions?\/[^/]+|jobid=|\/requisition\//i

function isCareersJunk(role: string, jobUrl: string): boolean {
  const hay = `${role} ${jobUrl}`.toLowerCase()
  if (CAREERS_JUNK_TITLE_RE.test(hay)) return true
  if (CAREERS_JUNK_PATH_RE.test(jobUrl)) return true
  if (STRONG_JOB_URL_RE.test(jobUrl)) return false
  const slug = jobUrl.split('/').filter(Boolean).pop() ?? ''
  if (slug.length < 8) return true
  if (/\b(engineer|scientist|researcher|analyst|developer|phd|intern|graduate|data|software|naval|maritime)\b/i.test(role)) {
    return false
  }
  return role.split(/\s+/).length <= 4 && !/\d/.test(slug)
}

function titleFromUrl(jobUrl: string): string {
  const slug = jobUrl.split('/').filter(Boolean).pop() ?? 'Role'
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\d{5,}/g, '')
    .trim()
    .slice(0, 80) || 'Role'
}

/** Scan a company careers page for job links and open-application opportunities. */
export async function scrapeCareersPage(
  careersUrl: string,
  label?: string,
): Promise<JobCandidate[]> {
  const res = await fetch(careersUrl, {
    headers: {
      'User-Agent': 'asliCo-Toolkit/1.0 (careers discovery)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(18000),
  })
  if (!res.ok) throw new Error(`Careers page ${res.status}`)

  const html = await res.text()
  const text = stripHtml(html).slice(0, 30000)
  const company = guessCompanyFromUrl(careersUrl, label)
  const jobs: JobCandidate[] = []
  const seen = new Set<string>()

  JOB_LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = JOB_LINK_RE.exec(html)) !== null) {
    const abs = absoluteUrl(careersUrl, match[1])
    if (!abs || seen.has(abs)) continue
    if (abs === careersUrl) continue
    const role = titleFromUrl(abs)
    if (isCareersJunk(role, abs)) continue
    seen.add(abs)
    jobs.push({
      company,
      role,
      jobDescription: text.slice(0, 8000),
      jobUrl: abs,
      source: 'careers_page',
    })
    if (jobs.length >= 25) break
  }

  const lower = text.toLowerCase()
  const openApply = OPEN_APPLICATION_PHRASES.some((p) => lower.includes(p))
  if (openApply || jobs.length === 0) {
    jobs.push({
      company,
      role: 'Open application / talent pool',
      jobDescription: `${text.slice(0, 6000)}\n\n[Careers page accepts general or speculative applications — tailor CV to ${company} and target domains.]`,
      jobUrl: careersUrl,
      source: 'careers_open',
    })
  }

  return jobs
}
