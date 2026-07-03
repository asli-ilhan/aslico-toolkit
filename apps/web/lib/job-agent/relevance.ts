import type { SearchPreferences } from '@/lib/job-agent/types'

export const DEFAULT_EXCLUDE_ROLES = [
  'senior',
  'sr.',
  'sr ',
  'lead',
  'principal',
  'staff engineer',
  'director',
  'vp ',
  'vice president',
  'head of',
  'chief ',
  'cto',
  'ceo',
  'cfo',
  'coo',
  'president',
  'executive',
  'managing director',
  'team manager',
  'engineering manager',
  'product manager',
  'program manager',
  'people manager',
]

const MANAGEMENT_PATTERNS = [
  /\bmanager\b/i,
  /\bmanagement\b/i,
  /\bdirector\b/i,
  /\bhead of\b/i,
  /\bvp\b/i,
  /\bvice president\b/i,
  /\bchief\b/i,
]

const SENIOR_PATTERNS = [
  /\bsenior\b/i,
  /\bsr\.?\b/i,
  /\blead\b/i,
  /\bprincipal\b/i,
  /\bstaff\b/i,
  /\barchitect\b/i,
  /\bdistinguished\b/i,
]

const DOMAIN_ALIASES: Record<string, string[]> = {
  maritime: [
    'maritime',
    'shipping',
    'vessel',
    'ship',
    'fleet',
    'port',
    'marine',
    'naval',
    'offshore vessel',
    'classification society',
    'dnv',
    'lloyd',
    'bureau veritas',
  ],
  offshore: ['offshore', 'subsea', 'oil and gas', 'rig', 'platform', 'fpso', 'drilling'],
  renewable_energy: ['renewable', 'solar', 'green energy', 'clean energy', 'hydrogen'],
  wind: ['wind', 'turbine', 'offshore wind', 'onshore wind', 'vestas', 'siemens gamesa'],
  digital_twin: ['digital twin', 'simulation', 'iot', 'telemetry', 'twins'],
  machine_learning: ['machine learning', 'ml ', 'deep learning', 'neural', 'pytorch', 'tensorflow'],
  data_science: ['data science', 'analytics', 'statistics', 'data scientist', 'bi developer'],
  ai: [' artificial intelligence', ' ai ', 'llm', 'genai', 'nlp'],
  hci: ['hci', 'human-computer', 'ux research', 'usability'],
  research: ['phd', 'research', 'academic', 'r&d', 'postdoc'],
}

export interface DomainAlignment {
  score: number
  matchedDomains: string[]
  companyHits: number
  descriptionHits: number
}

export function computeCompanyDomainAlignment(
  company: string,
  jobText: string,
  profileDomains: string[],
): DomainAlignment {
  const companyHay = company.toLowerCase()
  const descHay = `${company} ${jobText}`.toLowerCase()
  const matchedDomains: string[] = []
  let companyHits = 0
  let descriptionHits = 0

  for (const domain of profileDomains) {
    const key = domain.toLowerCase()
    const terms = DOMAIN_ALIASES[key] ?? [key.replace(/_/g, ' ')]
    const companyMatch = terms.some((t) => companyHay.includes(t.trim()))
    const descMatch = terms.some((t) => descHay.includes(t.trim()))
    if (companyMatch) {
      companyHits++
      matchedDomains.push(domain)
    } else if (descMatch) {
      descriptionHits++
      matchedDomains.push(domain)
    }
  }

  const unique = [...new Set(matchedDomains)]
  let score = 0
  if (companyHits > 0) score += Math.min(60, companyHits * 30)
  if (descriptionHits > 0) score += Math.min(40, descriptionHits * 15)
  score = Math.min(100, score)

  return { score, matchedDomains: unique, companyHits, descriptionHits }
}

export function isRoleExcluded(role: string, patterns: string[]): boolean {
  const hay = role.toLowerCase()
  return patterns.some((p) => p && hay.includes(p.toLowerCase().trim()))
}

export function isManagementRole(role: string): boolean {
  return MANAGEMENT_PATTERNS.some((re) => re.test(role))
}

export function isSeniorOrLeadRole(role: string): boolean {
  return SENIOR_PATTERNS.some((re) => re.test(role))
}

export interface RelevanceVerdict {
  pass: boolean
  reason?: string
  alignment: DomainAlignment
}

export function evaluateJobRelevance(
  job: { company: string; role: string; jobDescription: string },
  preferences: SearchPreferences,
  profileDomains: string[],
): RelevanceVerdict {
  const excludeRoles = [
    ...DEFAULT_EXCLUDE_ROLES,
    ...(preferences.excludeRoles ?? []),
  ]

  const alignment = computeCompanyDomainAlignment(
    job.company,
    `${job.role} ${job.jobDescription}`,
    profileDomains,
  )

  if (isRoleExcluded(job.role, excludeRoles)) {
    if (alignment.score < 55) {
      return { pass: false, reason: `Excluded role pattern: ${job.role}`, alignment }
    }
  }

  if (preferences.requireCompanyDomainMatch !== false && alignment.score < 20) {
    return {
      pass: false,
      reason: `No domain match for ${job.company} · ${job.role}`,
      alignment,
    }
  }

  if (preferences.avoidSeniorTitles !== false && isSeniorOrLeadRole(job.role)) {
    if (alignment.score < 50) {
      return {
        pass: false,
        reason: `Senior/lead title without strong domain fit: ${job.role}`,
        alignment,
      }
    }
  }

  if (isManagementRole(job.role) && alignment.score < 45) {
    return {
      pass: false,
      reason: `Management role outside target domains: ${job.company}`,
      alignment,
    }
  }

  return { pass: true, alignment }
}

export function experienceNoteForCv(preferences: SearchPreferences): string {
  const level = preferences.experienceLevel ?? 'mid'
  const lines = [
    'Do NOT inflate seniority. Candidate is NOT senior-level.',
    `Target seniority: ${level} (individual contributor / researcher).`,
    'Emphasize PhD research, contracts, and hands-on technical delivery — not people management.',
  ]
  if (preferences.experienceYears) {
    lines.push(`Experience to reflect: ~${preferences.experienceYears} years relevant work.`)
  }
  return lines.join(' ')
}

export function boostFitWithAlignment(
  fitScore: number,
  alignment: DomainAlignment,
  preferences: SearchPreferences,
): number {
  let score = fitScore
  if (alignment.score >= 60) score = Math.min(100, score + 12)
  else if (alignment.score >= 40) score = Math.min(100, score + 6)
  else if (alignment.score < 20 && preferences.requireCompanyDomainMatch !== false) {
    score = Math.round(score * 0.55)
  }
  return Math.min(100, Math.max(0, Math.round(score)))
}
