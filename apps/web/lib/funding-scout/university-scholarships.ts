import type { FundingCandidate } from '@/lib/funding-scout/types'

const ITU_SCHOLARSHIPS: FundingCandidate[] = [
  {
    funder: 'İTÜ',
    title: 'Lisansüstü Eğitim Enstitüsü Burs ve Destek Programları',
    fundingType: 'phd_scholarship',
    region: 'turkey',
    description: 'Istanbul Technical University Graduate School — PhD scholarships, tuition waivers, monthly stipends for doctoral students. Maritime, ocean engineering, AI, shipbuilding departments.',
    opportunityUrl: 'https://lee.itu.edu.tr/lee/burslar-ve-destekler',
    source: 'curated:itu',
    fullFunding: true,
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  },
  {
    funder: 'İTÜ BAP',
    title: 'Bilimsel Araştırma Projeleri (BAP) — doktora araştırmacı desteği',
    fundingType: 'project_grant',
    region: 'turkey',
    description: 'ITU Scientific Research Projects Coordination — faculty-led grants; PhD students funded as researchers. Engineering, maritime, AI.',
    opportunityUrl: 'https://bap.itu.edu.tr/',
    source: 'curated:itu',
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  },
  {
    funder: 'İTÜ',
    title: 'Uluslararası Ortak Doktora / Çift Diploma Programları',
    fundingType: 'phd_scholarship',
    region: 'turkey',
    description: 'ITU joint/double PhD programmes with partner universities (Netherlands TU Delft corridor, European partners, China co-supervision). Bilateral agreements.',
    opportunityUrl: 'https://lee.itu.edu.tr/',
    source: 'curated:itu',
    fullFunding: true,
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  },
  {
    funder: 'İTÜ',
    title: 'Araştırma Görevlisi / Doktora Bursiyeri kadroları',
    fundingType: 'phd_scholarship',
    region: 'turkey',
    description: 'ITU research assistant and PhD fellow positions — paid doctoral study in engineering faculties. Check faculty announcements.',
    opportunityUrl: 'https://www.itu.edu.tr/itu-arastirma-gorevlisi-ve-doktora-bursiyeri-alimlari',
    source: 'curated:itu',
    fullFunding: true,
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  },
  {
    funder: 'İTÜ Denizcilik Fakültesi',
    title: 'Gemi İnşaatı ve Deniz Bilimleri Doktora Bursları',
    fundingType: 'phd_scholarship',
    region: 'turkey',
    description: 'ITU Faculty of Naval Architecture and Ocean Engineering — PhD scholarships and project-funded positions. Maritime AI, offshore, digital twin.',
    opportunityUrl: 'https://denizcilik.itu.edu.tr/',
    source: 'curated:itu',
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  },
]

const UNIVERSITY_ALIASES: { re: RegExp; opportunities: FundingCandidate[] }[] = [
  { re: /\b(istanbul technical|i̇stanbul teknik|itu\b|i\.t\.u\.|istanbul teknik üni)/i, opportunities: ITU_SCHOLARSHIPS },
]

/** Match home-university name to institution-specific scholarships. */
export function universityOpportunitiesFor(homeUniversity: string): FundingCandidate[] {
  const hay = homeUniversity.trim()
  if (!hay) return []

  for (const { re, opportunities } of UNIVERSITY_ALIASES) {
    if (re.test(hay)) return opportunities
  }

  return [{
    funder: homeUniversity,
    title: 'Üniversite lisansüstü burs ve araştırma destekleri',
    fundingType: 'phd_scholarship',
    region: 'turkey',
    description: `${homeUniversity} — check Graduate School (Enstitü) website for PhD scholarships, BAP/research projects, and research assistant positions.`,
    opportunityUrl: undefined,
    source: 'curated:home-university',
    priorityTier: 'home_university',
    listingKind: 'program_catalog',
  }]
}
