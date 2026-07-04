import type { SearchPreferences } from '@/lib/job-agent/types'
import {
  DOMAIN_ALIASES,
  hasIndustrySignals,
  isKnownSectorCompany,
  isTechnicalRole,
  relevanceDomains,
  termsForDomain,
} from '@/lib/job-agent/domain-aliases'
import { isRelatedEmployer, matchRelatedEmployer } from '@/lib/job-agent/related-employers'

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

/** Minimum alignment score when domain match is required (soft gate). */
const DOMAIN_MATCH_MIN_SCORE = 8

export interface DomainAlignment {
  score: number
  matchedDomains: string[]
  companyHits: number
  descriptionHits: number
  /** Technical role at a company with sector/industry signals. */
  technicalAdjacent?: boolean
  /** Company name matches energy/maritime/engineering sector list. */
  knownSectorCompany?: boolean
  /** Matched from curated related-employer list (BP, Siemens, etc.). */
  relatedEmployer?: string
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
    const terms = termsForDomain(domain)
    const companyMatch = terms.some((t) => t.trim().length > 1 && companyHay.includes(t.trim()))
    const descMatch = terms.some((t) => t.trim().length > 1 && descHay.includes(t.trim()))
    if (companyMatch) {
      companyHits++
      matchedDomains.push(domain)
    } else if (descMatch) {
      descriptionHits++
      matchedDomains.push(domain)
    }
  }

  const related = matchRelatedEmployer(company)
  if (related) {
    for (const sector of related.employer.sectors) {
      if (!matchedDomains.includes(sector)) matchedDomains.push(sector)
    }
    companyHits = Math.max(companyHits, 2)
  }

  const knownSectorCompany = isKnownSectorCompany(company)
  if (knownSectorCompany && !matchedDomains.includes('energy')) {
    matchedDomains.push('energy')
    companyHits++
  }

  const unique = [...new Set(matchedDomains)]
  let score = 0
  if (companyHits > 0) score += Math.min(60, companyHits * 28)
  if (descriptionHits > 0) score += Math.min(45, descriptionHits * 14)
  if (related) score = Math.max(score, related.alignmentScore)
  else if (knownSectorCompany) score = Math.min(100, score + 18)
  score = Math.min(100, score)

  const role = jobText.split('\n')[0] ?? jobText
  const technicalAdjacent =
    isTechnicalRole(role) &&
    (hasIndustrySignals(descHay) || knownSectorCompany || related !== null)

  if (related && isTechnicalRole(role)) {
    score = Math.min(100, Math.max(score, 78))
  } else if (technicalAdjacent) {
    score = Math.min(100, Math.max(score, 35))
  }

  return {
    score,
    matchedDomains: unique,
    companyHits,
    descriptionHits,
    technicalAdjacent,
    knownSectorCompany,
    relatedEmployer: related?.employer.label,
  }
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

/** Minimum alignment for soft relevance (strict mode off). */
const SOFT_RELEVANCE_MIN = 10

/** Roles that are almost never relevant unless at a known sector employer. */
const IRRELEVANT_ROLE_RE =
  /\b(customer support|call center|sales development|account executive|business development representative|recruiter|talent acquisition|copywriter|content writer|social media manager|virtual assistant|bookkeeper|payroll|hr generalist|legal counsel|paralegal|receptionist|data entry)\b/i

function passesSoftRelevanceGate(
  job: { company: string; role: string; jobDescription: string },
  alignment: DomainAlignment,
): boolean {
  if (alignment.relatedEmployer || alignment.knownSectorCompany) return true
  if (alignment.score >= SOFT_RELEVANCE_MIN) return true
  if (alignment.technicalAdjacent) return true

  const combined = `${job.role} ${job.jobDescription}`.toLowerCase()
  if (isTechnicalRole(job.role) && hasIndustrySignals(combined)) return true
  if (isTechnicalRole(job.role) && alignment.score >= 6) return true

  if (IRRELEVANT_ROLE_RE.test(job.role) && !alignment.knownSectorCompany && !alignment.relatedEmployer) {
    return false
  }

  return false
}

function passesStrictDomainGate(
  job: { company: string; role: string; jobDescription: string },
  alignment: DomainAlignment,
  preferences: SearchPreferences,
): boolean {
  if (preferences.requireCompanyDomainMatch === false) return true

  if (isRelatedEmployer(job.company)) return true
  if (alignment.relatedEmployer) return true

  if (alignment.score >= DOMAIN_MATCH_MIN_SCORE) return true
  if (alignment.knownSectorCompany) return true
  if (alignment.technicalAdjacent) return true

  const combined = `${job.role} ${job.jobDescription}`.toLowerCase()
  if (isTechnicalRole(job.role) && hasIndustrySignals(combined)) return true

  return false
}

export function evaluateJobRelevance(
  job: { company: string; role: string; jobDescription: string },
  preferences: SearchPreferences,
  profileDomains: string[],
  preferenceDomains: string[] = preferences.domains ?? [],
): RelevanceVerdict {
  const excludeRoles = [...DEFAULT_EXCLUDE_ROLES, ...(preferences.excludeRoles ?? [])]

  const domains = relevanceDomains(profileDomains, preferenceDomains)
  const alignment = computeCompanyDomainAlignment(
    job.company,
    `${job.role} ${job.jobDescription}`,
    domains,
  )

  if (isRoleExcluded(job.role, excludeRoles)) {
    if (alignment.score < 45 && !alignment.technicalAdjacent) {
      return { pass: false, reason: `Excluded role pattern: ${job.role}`, alignment }
    }
  }

  if (!passesStrictDomainGate(job, alignment, preferences)) {
    return {
      pass: false,
      reason: `No sector/domain match for ${job.company} · ${job.role}`,
      alignment,
    }
  }

  if (!passesSoftRelevanceGate(job, alignment)) {
    return {
      pass: false,
      reason: `Not related enough (needs sector employer, tech+industry role, or domain signal): ${job.company} · ${job.role}`,
      alignment,
    }
  }

  if (preferences.avoidSeniorTitles !== false && isSeniorOrLeadRole(job.role)) {
    if (alignment.score < 35 && !alignment.knownSectorCompany) {
      return {
        pass: false,
        reason: `Senior/lead title without sector fit: ${job.role}`,
        alignment,
      }
    }
  }

  if (isManagementRole(job.role) && alignment.score < 30 && !alignment.knownSectorCompany) {
    return {
      pass: false,
      reason: `Management role outside target sectors: ${job.company}`,
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
    'Highlight fit for energy, maritime, offshore, renewables, and engineering consultancies when relevant.',
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
  if (alignment.score >= 60) score = Math.min(100, score + 14)
  else if (alignment.score >= 40) score = Math.min(100, score + 8)
  else if (alignment.score >= 20) score = Math.min(100, score + 4)
  else if (alignment.relatedEmployer) score = Math.min(100, score + 10)
  else if (alignment.technicalAdjacent) score = Math.min(100, score + 6)
  else if (
    alignment.score < DOMAIN_MATCH_MIN_SCORE &&
    preferences.requireCompanyDomainMatch !== false
  ) {
    score = Math.round(score * 0.72)
  }
  return Math.min(100, Math.max(0, Math.round(score)))
}

/** Re-export for tests and fit scoring. */
export { DOMAIN_ALIASES, relevanceDomains }

export function rankCandidatesByRelevance<
  T extends { company: string; role: string; jobDescription: string },
>(
  candidates: T[],
  preferences: SearchPreferences,
  profileDomains: string[],
  preferenceDomains: string[] = preferences.domains ?? [],
): { job: T; alignment: DomainAlignment; priority: number }[] {
  return candidates
    .map((job) => {
      const verdict = evaluateJobRelevance(job, preferences, profileDomains, preferenceDomains)
      if (!verdict.pass) return null
      const a = verdict.alignment
      let priority = a.score
      if (a.relatedEmployer) priority += 55
      if (a.knownSectorCompany) priority += 22
      if (a.technicalAdjacent) priority += 12
      return { job, alignment: a, priority }
    })
    .filter((x): x is { job: T; alignment: DomainAlignment; priority: number } => x !== null)
    .sort((a, b) => b.priority - a.priority)
}
