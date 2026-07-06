import { termsForDomain } from '@/lib/job-agent/domain-aliases'

export type DocType = 'cv' | 'cover_letter' | 'portfolio' | 'other'

export type PackStatus =
  | 'discovered'
  | 'pack_ready'
  | 'pending_review'
  | 'approved'
  | 'submitted'
  | 'skipped'
  | 'rejected'

export type FunnelStage = 'none' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected'

export type ProfileVariant = 'default' | 'research' | 'industry' | 'gig'

export type AiRiskLevel = 'low' | 'medium' | 'high'

export type WatchlistKind = 'url' | 'rss' | 'keyword' | 'careers'

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'any'

export type ScanDepth = 'normal' | 'deep'

export interface EvidenceItem {
  id: string
  domain: string
  claim: string
  source?: string
}

export interface MasterProfile {
  summary: string
  domains: string[]
  languages: { language: string; level: string }[]
  constraints: {
    remotePreferred: boolean
    remoteOnly: boolean
    openToContract: boolean
    openToFreelance: boolean
    openToGig: boolean
    phdInProgress?: string
  }
  evidence: EvidenceItem[]
  antiAiPhrases?: string[]
}

export interface ProfileVariantData {
  label: string
  summary: string
  emphasis: string[]
}

export type ProfileVariantsMap = Partial<Record<ProfileVariant, ProfileVariantData>>

export interface SearchPreferences {
  domains: string[]
  domainWeights: Record<string, number>
  remoteRequired: boolean
  onsiteMinScore: number
  minFitScore: number
  regions: string[]
  employmentTypes: string[]
  gigPlatforms: string[]
  keywords: string[]
  excludeCompanies: string[]
  excludeRoles: string[]
  avoidSeniorTitles: boolean
  requireCompanyDomainMatch: boolean
  experienceLevel: ExperienceLevel
  experienceYears?: number
  targetCompanies: string[]
  rssFeeds: string[]
  nightlyEnabled: boolean
  /** normal = ~12 packs/run; deep = ~18 packs, more feeds & careers pages */
  scanDepth?: ScanDepth
  /** User rejection notes — injected into fit scoring prompts */
  scopeLearnings?: string
}

export const DOMAIN_WEIGHTS: Record<string, number> = {
  maritime: 1.25,
  offshore: 1.2,
  energy: 1.2,
  renewable_energy: 1.15,
  wind: 1.15,
  engineering: 1.1,
  digital_twin: 1.1,
  machine_learning: 1.1,
  data_science: 1.1,
  ai: 1.05,
  hci: 1.05,
  research: 1.0,
  other: 0.9,
}

export const DEFAULT_PREFERENCES: SearchPreferences = {
  domains: [
    'maritime',
    'offshore',
    'energy',
    'renewable_energy',
    'wind',
    'engineering',
    'digital_twin',
    'machine_learning',
    'data_science',
    'ai',
  ],
  domainWeights: DOMAIN_WEIGHTS,
  remoteRequired: true,
  onsiteMinScore: 85,
  minFitScore: 48,
  regions: ['remote_global', 'remote_eu', 'turkey'],
  employmentTypes: ['remote_ft', 'contract', 'freelance'],
  gigPlatforms: ['outlier', 'alignerr', 'remotasks', 'dataannotation'],
  keywords: [],
  excludeCompanies: [],
  excludeRoles: [],
  avoidSeniorTitles: true,
  requireCompanyDomainMatch: false,
  experienceLevel: 'mid',
  targetCompanies: [],
  rssFeeds: [],
  nightlyEnabled: false,
  scanDepth: 'normal',
}

/** Merge saved prefs with expanded defaults — adds new sector domains without removing user choices. */
export function mergeSearchPreferences(
  saved: Partial<SearchPreferences> | null | undefined,
): SearchPreferences {
  const merged = { ...DEFAULT_PREFERENCES, ...(saved ?? {}) }
  merged.domains = [...new Set([...DEFAULT_PREFERENCES.domains, ...(saved?.domains ?? [])])]
  merged.domainWeights = { ...DOMAIN_WEIGHTS, ...(saved?.domainWeights ?? {}) }
  return merged
}

export const GIG_PLATFORM_RISKS: Record<string, { level: AiRiskLevel; reason: string }> = {
  outlier: {
    level: 'high',
    reason: 'AI-assisted applications may violate platform ToS. Apply manually only.',
  },
  alignerr: {
    level: 'high',
    reason: 'AI-assisted applications may violate platform ToS. Apply manually only.',
  },
  remotasks: { level: 'high', reason: 'High automation detection risk.' },
  dataannotation: { level: 'medium', reason: 'Prefer manual submission.' },
}

export function detectAiRisk(
  company: string,
  jobUrl?: string | null,
): { level: AiRiskLevel; reason: string | null; autoSubmitBlocked: boolean } {
  const haystack = `${company} ${jobUrl ?? ''}`.toLowerCase()
  for (const [key, risk] of Object.entries(GIG_PLATFORM_RISKS)) {
    if (haystack.includes(key)) {
      return { ...risk, autoSubmitBlocked: risk.level === 'high' }
    }
  }
  if (haystack.includes('linkedin.com')) {
    return {
      level: 'medium',
      reason: 'LinkedIn Easy Apply. Review before auto-assist.',
      autoSubmitBlocked: false,
    }
  }
  return { level: 'low', reason: null, autoSubmitBlocked: false }
}

export function isCompanyExcluded(company: string, exclude: string[]): boolean {
  const c = company.toLowerCase().trim()
  return exclude.some((e) => e && c.includes(e.toLowerCase().trim()))
}

export function computeDomainFit(
  jobText: string,
  profileDomains: string[],
  weights: Record<string, number> = DOMAIN_WEIGHTS,
): Record<string, number> {
  const hay = jobText.toLowerCase()
  const result: Record<string, number> = {}
  for (const domain of profileDomains) {
    const key = domain.toLowerCase()
    const terms = termsForDomain(key)
    const hits = terms.filter((t) => t.trim().length > 1 && hay.includes(t.trim())).length
    if (hits > 0) {
      result[domain] = Math.min(100, Math.round(hits * 22 * (weights[domain] ?? 1)))
    }
  }
  return result
}

export function adjustFitScore(
  baseScore: number,
  domainFit: Record<string, number>,
  preferences: SearchPreferences,
): number {
  const domainValues = Object.values(domainFit)
  const boost =
    domainValues.length > 0
      ? domainValues.reduce((a, b) => a + b, 0) / domainValues.length / 100
      : 0
  let score = baseScore * (1 + boost * 0.15)
  score = Math.min(100, Math.max(0, Math.round(score)))
  if (score < preferences.minFitScore) return score
  return score
}

export function matchesKeywords(jobText: string, keywords: string[]): boolean {
  if (!keywords.length) return true
  const hay = jobText.toLowerCase()
  return keywords.some((k) => k && hay.includes(k.toLowerCase().trim()))
}

export function defaultFollowUpDate(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + 7)
  return d.toISOString()
}
