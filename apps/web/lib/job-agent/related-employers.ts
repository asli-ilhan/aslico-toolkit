/**
 * Employers that are inherently relevant to the candidate profile even when the
 * job posting itself does not mention maritime/energy/ML keywords.
 * Company name match is enough — no domain keyword required in the listing.
 */

export interface RelatedEmployer {
  /** Display name */
  label: string
  /** Normalized substrings — matched against normalized company name */
  patterns: string[]
  /** Sectors used for fit boost and domain tagging */
  sectors: string[]
  careersUrl?: string
}

export const RELATED_EMPLOYERS: RelatedEmployer[] = [
  // Energy & oil/gas
  { label: 'BP', patterns: ['bp', 'bp plc', 'british petroleum'], sectors: ['energy', 'offshore'], careersUrl: 'https://www.bp.com/en/global/corporate/careers.html' },
  { label: 'Shell', patterns: ['shell', 'shell plc'], sectors: ['energy', 'offshore'], careersUrl: 'https://www.shell.com/careers.html' },
  { label: 'Equinor', patterns: ['equinor', 'statoil'], sectors: ['energy', 'offshore', 'wind'], careersUrl: 'https://www.equinor.com/careers' },
  { label: 'TotalEnergies', patterns: ['totalenergies', 'total energies', 'total sa'], sectors: ['energy', 'renewable_energy'], careersUrl: 'https://careers.totalenergies.com/' },
  { label: 'Chevron', patterns: ['chevron'], sectors: ['energy', 'offshore'] },
  { label: 'ExxonMobil', patterns: ['exxon', 'exxonmobil'], sectors: ['energy', 'offshore'] },
  { label: 'ConocoPhillips', patterns: ['conocophillips', 'conoco phillips'], sectors: ['energy', 'offshore'] },

  // Industrial & engineering conglomerates
  {
    label: 'Siemens',
    patterns: ['siemens', 'siemens ag', 'siemens energy', 'siemens gamesa'],
    sectors: ['energy', 'engineering', 'digital_twin', 'wind'],
    careersUrl: 'https://jobs.siemens.com/',
  },
  {
    label: 'Rolls-Royce',
    patterns: ['rolls royce', 'rolls-royce', 'rollsroyce'],
    sectors: ['energy', 'maritime', 'engineering', 'offshore'],
    careersUrl: 'https://careers.rolls-royce.com/',
  },
  {
    label: 'Bentley Systems',
    patterns: ['bentley systems', 'bentley'],
    sectors: ['engineering', 'digital_twin'],
    careersUrl: 'https://www.bentley.com/careers/',
  },
  { label: 'GE Vernova', patterns: ['ge vernova', 'ge renewable', 'general electric', ' ge '], sectors: ['energy', 'wind', 'engineering'], careersUrl: 'https://jobs.gecareers.com/vernova/global/en' },
  { label: 'ABB', patterns: ['abb', 'abb ltd'], sectors: ['energy', 'engineering', 'maritime'], careersUrl: 'https://global.abb/group/en/careers' },
  { label: 'Schneider Electric', patterns: ['schneider', 'schneider electric'], sectors: ['energy', 'engineering'], careersUrl: 'https://www.se.com/ww/en/about-us/careers/' },
  { label: 'Honeywell', patterns: ['honeywell'], sectors: ['energy', 'engineering', 'digital_twin'] },
  { label: 'Emerson', patterns: ['emerson', 'emerson electric'], sectors: ['energy', 'engineering', 'offshore'] },
  { label: 'Rockwell Automation', patterns: ['rockwell'], sectors: ['engineering', 'digital_twin'] },
  { label: 'Hitachi Energy', patterns: ['hitachi energy', 'hitachi'], sectors: ['energy', 'engineering'] },

  // Renewables & utilities
  { label: 'Ørsted', patterns: ['orsted', 'ørsted'], sectors: ['wind', 'renewable_energy', 'offshore'], careersUrl: 'https://orsted.com/careers' },
  { label: 'Vestas', patterns: ['vestas'], sectors: ['wind', 'renewable_energy'], careersUrl: 'https://www.vestas.com/en/careers' },
  { label: 'Iberdrola', patterns: ['iberdrola'], sectors: ['renewable_energy', 'energy'], careersUrl: 'https://www.iberdrola.com/careers' },
  { label: 'RWE', patterns: ['rwe'], sectors: ['renewable_energy', 'energy'], careersUrl: 'https://www.rwe.com/careers/' },
  { label: 'Vattenfall', patterns: ['vattenfall'], sectors: ['energy', 'renewable_energy'], careersUrl: 'https://careers.vattenfall.com/' },
  { label: 'EDF', patterns: ['edf', 'electricite de france'], sectors: ['energy', 'renewable_energy'] },
  { label: 'Engie', patterns: ['engie'], sectors: ['energy', 'renewable_energy'] },
  { label: 'Statkraft', patterns: ['statkraft'], sectors: ['renewable_energy', 'energy'] },

  // Engineering consultancies & EPC
  { label: 'DNV', patterns: ['dnv', 'det norske veritas'], sectors: ['maritime', 'energy', 'offshore'], careersUrl: 'https://www.dnv.com/careers/' },
  { label: "Lloyd's Register", patterns: ['lloyd', "lloyd's", 'lr group'], sectors: ['maritime', 'energy'] },
  { label: 'Bureau Veritas', patterns: ['bureau veritas'], sectors: ['maritime', 'energy'] },
  { label: 'Worley', patterns: ['worley', 'worleyparsons'], sectors: ['energy', 'offshore', 'engineering'], careersUrl: 'https://www.worley.com/careers' },
  { label: 'Wood', patterns: ['wood plc', 'wood group', ' wood '], sectors: ['energy', 'offshore', 'engineering'], careersUrl: 'https://www.woodplc.com/careers' },
  { label: 'Arup', patterns: ['arup'], sectors: ['engineering', 'renewable_energy'], careersUrl: 'https://www.arup.com/careers' },
  { label: 'WSP', patterns: ['wsp'], sectors: ['engineering', 'renewable_energy'], careersUrl: 'https://www.wsp.com/en-us/careers' },
  { label: 'Fugro', patterns: ['fugro'], sectors: ['offshore', 'maritime', 'engineering'], careersUrl: 'https://www.fugro.com/careers' },
  { label: 'Kongsberg', patterns: ['kongsberg'], sectors: ['maritime', 'digital_twin', 'offshore'], careersUrl: 'https://www.kongsberg.com/careers/' },
  { label: 'Wärtsilä', patterns: ['wartsila', 'wärtsilä'], sectors: ['maritime', 'energy'] },

  // Maritime operators & tech
  { label: 'Maersk', patterns: ['maersk', 'apmoller'], sectors: ['maritime'] },
  { label: 'Windward', patterns: ['windward'], sectors: ['maritime', 'machine_learning', 'ai'] },
  { label: 'Kpler', patterns: ['kpler'], sectors: ['maritime', 'data_science'] },
  { label: 'Spire', patterns: ['spire global', 'spire maritime'], sectors: ['maritime', 'data_science'] },

  // Aerospace & defence (adjacent engineering / propulsion / digital twin)
  { label: 'Airbus', patterns: ['airbus'], sectors: ['engineering', 'digital_twin'] },
  { label: 'Safran', patterns: ['safran'], sectors: ['engineering', 'energy'] },
  { label: 'Thales', patterns: ['thales'], sectors: ['engineering', 'maritime', 'digital_twin'] },
  { label: 'Leonardo', patterns: ['leonardo'], sectors: ['engineering'] },
]

export interface RelatedEmployerMatch {
  employer: RelatedEmployer
  /** Fixed high alignment — company alone is the signal */
  alignmentScore: number
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function patternMatches(normalized: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase()
  if (!p) return false
  if (p.length <= 3) {
    // Short tokens (bp, ge, abb) — word boundary match
    return new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(
      ` ${normalized} `,
    )
  }
  return normalized.includes(p)
}

export function matchRelatedEmployer(company: string): RelatedEmployerMatch | null {
  const normalized = normalizeCompanyName(company)
  if (!normalized) return null

  for (const employer of RELATED_EMPLOYERS) {
    if (employer.patterns.some((p) => patternMatches(normalized, p))) {
      return { employer, alignmentScore: 72 }
    }
  }
  return null
}

export function isRelatedEmployer(company: string): boolean {
  return matchRelatedEmployer(company) !== null
}

/** Careers URLs from related employers — rotated into nightly scans. */
export function relatedEmployerCareersBatch(runIndex = 0, batchSize = 10): RelatedEmployer[] {
  const withUrls = RELATED_EMPLOYERS.filter((e) => e.careersUrl)
  if (withUrls.length <= batchSize) return withUrls
  const start = (runIndex * batchSize) % withUrls.length
  return Array.from({ length: batchSize }, (_, i) => withUrls[(start + i) % withUrls.length])
}
