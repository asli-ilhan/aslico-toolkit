import type { FundingCandidate, FundingSettings } from '@/lib/funding-scout/types'

export interface EligibilityResult {
  eligible: boolean
  score: number
  hardBlock: boolean
  reasons: string[]
  flags: string[]
}

const HARD_BLOCK_RULES: { re: RegExp; reason: string; unlessCitizenship?: string[] }[] = [
  { re: /\b(us citizens? only|united states citizens? only|americans? only)\b/i, reason: 'US citizenship required' },
  { re: /\b(uk nationals? only|british citizens? only|uk citizens? only)\b/i, reason: 'UK nationality required' },
  { re: /\b(eu nationals? only|eea nationals? only|european union citizens? only)\b/i, reason: 'EU nationality required' },
  { re: /\b(chinese citizens? only|prc nationals? only|mainland china citizens? only)\b/i, reason: 'Chinese citizenship required' },
  { re: /\b(undergraduate only|bachelor(?:'s)? only|master(?:'s)? students? only)\b/i, reason: 'Not open to PhD applicants' },
  { re: /\b(postdoc(?:toral)? only|post-doctoral only)\b/i, reason: 'Postdoc only — not for new PhD intake' },
  { re: /\b(already enrolled|currently enrolled phd|existing phd students? only)\b/i, reason: 'Requires already enrolled PhD student' },
]

const COMMONWEALTH_CITIZENSHIPS = new Set([
  'UK', 'GB', 'AU', 'CA', 'NZ', 'IN', 'PK', 'NG', 'KE', 'GH', 'ZA', 'MY', 'SG', 'BD', 'LK',
])

const JOINT_RE = /\b(joint phd|joint doctoral|double degree|dual degree|cotutelle|co-?supervis|joint supervision|sandwich phd)\b/i
const CHINA_RE = /\b(china|csc|chinese university|peking|tsinghua|zhejiang|shanghai jiao tong)\b/i
const NL_RE = /\b(netherlands|holland|dutch|nwo|tu delft|eindhoven|wageningen|utrecht|groningen|leiden|amsterdam|erasmus mundus)\b/i
const TR_ABROAD_RE = /\b(tubitak 2214|2214-a|research fellowship abroad|yurtdisi|overseas phd|yurtdışı doktora)\b/i
const KYK_RE = /\b(kyk|kredi ve yurtlar|yurtlar kurumu|lisansustu burs|lisansüstü burs)\b/i
const ITU_RE = /\b(itu|i̇tü|istanbul technical|istanbul teknik|itu bap|bap\.itu)\b/i
const YOK_RE = /\b(yök|yok 100|100\/2000|1002000|mevlana)\b/i
const MSCA_RE = /\b(marie skłodowska-curie|msca|doctoral network|dn\b|horizon europe)\b/i
const BILATERAL_RE = /\b(bilateral|university partnership|memorandum|mou|twinning|exchange agreement)\b/i

function hay(opp: FundingCandidate): string {
  return `${opp.funder} ${opp.title} ${opp.description}`.toLowerCase()
}

function hasPartner(settings: FundingSettings, ...keys: string[]): boolean {
  const partners = settings.partnerCountries.map((c) => c.toLowerCase())
  return keys.some((k) => partners.includes(k))
}

function isCommonwealthFunder(opp: FundingCandidate): boolean {
  const h = hay(opp)
  return /\bcommonwealth\b/i.test(h) || opp.funder.toLowerCase().includes('commonwealth')
}

function citizenshipCode(settings: FundingSettings): string {
  return (settings.homeCountry || settings.citizenship || 'TR').toUpperCase()
}

export function checkFundingEligibility(opp: FundingCandidate, settings: FundingSettings): EligibilityResult {
  const text = `${opp.funder} ${opp.title} ${opp.description}`
  const h = hay(opp)
  const reasons: string[] = []
  const flags: string[] = []
  let score = 20

  const citizenship = citizenshipCode(settings)

  for (const rule of HARD_BLOCK_RULES) {
    if (rule.re.test(text)) {
      if (rule.unlessCitizenship?.includes(citizenship)) continue
      return {
        eligible: false,
        score: 0,
        hardBlock: true,
        reasons: [rule.reason],
        flags: ['hard_block'],
      }
    }
  }

  if (isCommonwealthFunder(opp) && !COMMONWEALTH_CITIZENSHIPS.has(citizenship)) {
    return {
      eligible: false,
      score: 5,
      hardBlock: true,
      reasons: ['Commonwealth scholarships — Turkish citizens not eligible'],
      flags: ['commonwealth_block'],
    }
  }

  if (settings.phdStage === 'starting' && /\b(must hold a phd|phd degree required|completed doctorate)\b/i.test(text)) {
    return {
      eligible: false,
      score: 0,
      hardBlock: true,
      reasons: ['Requires completed PhD'],
      flags: ['hard_block'],
    }
  }

  if (citizenship === 'TR' || citizenship === 'TURKEY') {
    score += 8
    if (/tubitak|tübitak|yök|turkish nationals?|turkey|kyk/i.test(text)) {
      score += 25
      flags.push('turkish_national')
      reasons.push('Open to Turkish nationals')
    }
    if (KYK_RE.test(h)) {
      score += 30
      flags.push('kyk')
      reasons.push('KYK — lisansüstü burs/kredi')
    }
    if (YOK_RE.test(h)) {
      score += 28
      flags.push('yok')
      reasons.push('YÖK burs programı')
    }
    if (ITU_RE.test(h) && settings.homeUniversity && ITU_RE.test(settings.homeUniversity.toLowerCase())) {
      score += 35
      flags.push('itu_home')
      reasons.push('İTÜ — ana üniversite bursları')
    } else if (ITU_RE.test(h)) {
      score += 15
      flags.push('itu')
    }
  }

  if (hasPartner(settings, 'china') && CHINA_RE.test(h)) {
    score += 18
    flags.push('china_path')
    reasons.push('China / CSC pathway')
    if (settings.supervisionModel === 'co_supervision' && /\b(co-?supervis|joint|visiting|sandwich)\b/i.test(h)) {
      score += 22
      flags.push('china_co_supervision')
      reasons.push('Supports China co-supervision model')
    }
  }

  if (hasPartner(settings, 'netherlands', 'holland') && NL_RE.test(h)) {
    score += 18
    flags.push('netherlands_path')
    reasons.push('Netherlands / Dutch pathway')
  }

  if (
    (settings.supervisionModel === 'joint_phd' || settings.supervisionModel === 'cotutelle') &&
    JOINT_RE.test(h)
  ) {
    score += 20
    flags.push('joint_phd')
    reasons.push('Joint / cotutelle PhD structure')
  }

  if (settings.supervisionModel === 'co_supervision' && /\b(co-?supervis|dual supervisor|visiting scholar)\b/i.test(h)) {
    score += 15
    flags.push('co_supervision')
    reasons.push('Co-supervision friendly')
  }

  if (settings.partnershipNotes.trim() && BILATERAL_RE.test(h)) {
    score += 12
    flags.push('bilateral_partnership')
    reasons.push('Bilateral / partnership programme')
  }

  if (TR_ABROAD_RE.test(h) && citizenship.startsWith('TR')) {
    score += 28
    flags.push('tubitak_2214')
    reasons.push('TÜBİTAK 2214 — research abroad (fits NL/China co-supervision)')
  }

  if (MSCA_RE.test(h)) {
    score += 15
    flags.push('msca')
    reasons.push('MSCA — international mobility, joint supervision possible')
  }

  if (opp.region === 'global' || settings.regions.includes(opp.region)) {
    score += 8
  }

  if (settings.phdStartMonth) {
    const [y, m] = settings.phdStartMonth.split('-').map(Number)
    if (y && m) {
      flags.push(`phd_start_${settings.phdStartMonth}`)
      if (settings.phdStage === 'starting') {
        reasons.push(`PhD intake target: ${settings.phdStartMonth}`)
      }
    }
  }

  if (settings.homeUniversity.trim() && settings.partnershipNotes.trim()) {
    score += 5
    flags.push('home_uni_partnership')
  }

  const passThreshold = settings.strictEligibility ? 40 : 28

  return {
    eligible: score >= passThreshold,
    score: Math.min(100, score),
    hardBlock: false,
    reasons: reasons.length ? reasons : ['General research funding — verify eligibility manually'],
    flags,
  }
}

export function passesEligibilityGate(result: EligibilityResult, settings: FundingSettings): boolean {
  if (result.hardBlock) return false
  if (!settings.strictEligibility) return result.score >= 20
  return result.eligible
}
