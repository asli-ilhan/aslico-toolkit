import type { FundingCandidate, FundingSettings } from '@/lib/funding-scout/types'
import { matchRelatedFunder } from '@/lib/funding-scout/related-funders'
import { checkFundingEligibility } from '@/lib/funding-scout/eligibility'

const RESEARCH_RE = /\b(phd|doctoral|fellowship|scholarship|stipend|grant|funding|research|msca|burs)\b/i
const DISCIPLINE_RE = /\b(maritime|ocean|offshore|energy|renewable|wind|machine learning|data science|engineering|digital twin|ai\b|vessel|turbine)\b/i
const BLOCK_RE = /\b(undergraduate only|us citizens only|uk nationals only)\b/i

export interface FundingRelevance {
  score: number
  relatedFunder?: string
  reasons: string[]
}

export function scoreFundingRelevance(opp: FundingCandidate, settings: FundingSettings): FundingRelevance {
  const hay = `${opp.funder} ${opp.title} ${opp.description}`.toLowerCase()
  const reasons: string[] = []
  let score = 0

  if (opp.priorityTier === 'turkey_national') {
    score += 70
    reasons.push('Turkey national priority (TÜBİTAK/YÖK/KYK)')
  }
  if (opp.priorityTier === 'home_university') {
    score += 65
    reasons.push('Home university scholarship')
  }

  const related = matchRelatedFunder(opp.funder)
  if (related) { score += 45; reasons.push(`Known funder: ${related.label}`) }

  const homeUni = settings.homeUniversity.trim().toLowerCase()
  if (homeUni && hay.includes(homeUni.split(/\s+/)[0])) {
    score += 25
    reasons.push('Matches home university')
  }

  if (settings.regions.includes(opp.region) || opp.region === 'global') { score += 15 }
  if (settings.fundingTypes.includes(opp.fundingType)) { score += 12 }
  if (RESEARCH_RE.test(hay) || /\b(burs|bursu|burslar)\b/i.test(hay)) { score += 20; reasons.push('Research funding') }
  if (DISCIPLINE_RE.test(hay)) { score += 18; reasons.push('Discipline match') }
  if (opp.fullFunding) { score += 10 }
  if (BLOCK_RE.test(hay)) score -= 40
  return { score: Math.min(100, Math.max(0, score)), relatedFunder: related?.label, reasons }
}

export function passesFundingRelevance(opp: FundingCandidate, settings: FundingSettings) {
  const relevance = scoreFundingRelevance(opp, settings)
  if (opp.listingKind === 'live_opening') {
    return { pass: true as const, relevance }
  }
  if (relevance.relatedFunder) return { pass: true as const, relevance }
  if (relevance.score >= 28) return { pass: true as const, relevance }
  if (DISCIPLINE_RE.test(`${opp.title} ${opp.description}`) && RESEARCH_RE.test(hay(opp))) {
    return { pass: true as const, relevance }
  }
  return { pass: false as const, relevance, reason: `Low relevance (${relevance.score})` }
}

function hay(opp: FundingCandidate) {
  return `${opp.funder} ${opp.title} ${opp.description}`.toLowerCase()
}

export function rankFundingCandidates(candidates: FundingCandidate[], settings: FundingSettings) {
  return candidates
    .map((opp) => {
      const v = passesFundingRelevance(opp, settings)
      if (!v.pass) return null
      const eligibility = checkFundingEligibility(opp, settings)
      if (eligibility.hardBlock) return null
      return {
        opp,
        relevance: v.relevance,
        eligibility,
        priority:
          (opp.listingKind === 'live_opening' ? 50 : 0) +
          v.relevance.score +
          (v.relevance.relatedFunder ? 30 : 0) +
          eligibility.score * 0.6,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.priority - a.priority)
}
