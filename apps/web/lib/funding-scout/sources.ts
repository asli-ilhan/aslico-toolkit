import type { FundingCandidate, FundingRegion, FundingSettings } from '@/lib/funding-scout/types'
import { isTurkishCandidate, TURKEY_PRIORITY_OPPORTUNITIES } from '@/lib/funding-scout/turkey-priority'
import { universityOpportunitiesFor } from '@/lib/funding-scout/university-scholarships'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'

export interface FundingSource {
  id: string
  region: FundingRegion
  label: string
  rssUrl?: string
  portalUrl?: string
  fundingTypes: string[]
}

export const FUNDING_SOURCES: FundingSource[] = [
  { id: 'findaphd', region: 'uk', label: 'FindAPhD', portalUrl: 'https://www.findaphd.com/phds/maritime/', fundingTypes: ['phd_scholarship'] },
  { id: 'euraxess', region: 'eu', label: 'Euraxess', portalUrl: 'https://euraxess.ec.europa.eu/jobs/search', fundingTypes: ['phd_scholarship', 'fellowship'] },
  { id: 'msca', region: 'eu', label: 'Marie Skłodowska-Curie', portalUrl: 'https://marie-sklodowska-curie-actions.ec.europa.eu/', fundingTypes: ['fellowship'] },
  { id: 'daad', region: 'eu', label: 'DAAD', portalUrl: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/', fundingTypes: ['phd_scholarship'] },
  { id: 'tubitak', region: 'turkey', label: 'TÜBİTAK', portalUrl: 'https://www.tubitak.gov.tr/tr/burslar/lisansustu-burs-programlari', fundingTypes: ['phd_scholarship', 'project_grant'] },
  { id: 'yok-1002000', region: 'turkey', label: 'YÖK 100/2000', portalUrl: 'https://1002000.yok.gov.tr/', fundingTypes: ['phd_scholarship'] },
  { id: 'yok-mevlana', region: 'turkey', label: 'YÖK Mevlana', portalUrl: 'https://mevlana.yok.gov.tr/', fundingTypes: ['phd_scholarship'] },
  { id: 'kyk', region: 'turkey', label: 'KYK', portalUrl: 'https://www.kyk.gov.tr/', fundingTypes: ['phd_scholarship'] },
  { id: 'csc', region: 'china', label: 'CSC', portalUrl: 'https://www.csc.edu.cn/', fundingTypes: ['phd_scholarship'] },
  { id: 'mext', region: 'japan', label: 'MEXT', portalUrl: 'https://www.studyinjapan.go.jp/', fundingTypes: ['phd_scholarship'] },
  { id: 'jsps', region: 'japan', label: 'JSPS', portalUrl: 'https://www.jsps.go.jp/english/', fundingTypes: ['fellowship'] },
  { id: 'gks', region: 'korea', label: 'GKS', portalUrl: 'https://www.studyinkorea.go.kr/', fundingTypes: ['phd_scholarship'] },
  { id: 'kaust', region: 'gulf', label: 'KAUST', portalUrl: 'https://www.kaust.edu.sa/en/study/phd', fundingTypes: ['phd_scholarship'] },
  { id: 'qf', region: 'gulf', label: 'Qatar Foundation', portalUrl: 'https://www.qf.org.qa/', fundingTypes: ['phd_scholarship'] },
  { id: 'profellow', region: 'americas', label: 'ProFellow', portalUrl: 'https://www.profellow.com/', fundingTypes: ['fellowship'] },
  { id: 'fulbright-tr', region: 'turkey', label: 'Fulbright Turkey', portalUrl: 'https://fulbright.org.tr/burslar/', fundingTypes: ['fellowship'] },
  { id: 'ukri', region: 'uk', label: 'UKRI', portalUrl: 'https://www.ukri.org/opportunity/', fundingTypes: ['project_grant'] },
  { id: 'lrf', region: 'uk', label: "Lloyd's Register Foundation", portalUrl: 'https://www.lrfoundation.org.uk/funding', fundingTypes: ['project_grant'] },
  { id: 'academicpositions', region: 'global', label: 'Academic Positions', rssUrl: 'https://academicpositions.com/find-jobs/rss', fundingTypes: ['phd_scholarship'] },
]

/** International / joint programmes — rotated in scan; Turkey national list is separate. */
export const GLOBAL_CURATED_OPPORTUNITIES: FundingCandidate[] = [
  { funder: 'CSC', title: 'CSC PhD with Joint Supervision (China)', fundingType: 'phd_scholarship', region: 'china', description: 'Chinese Government Scholarship for international PhD with Chinese co-supervisor. Joint supervision, visiting researcher periods. Open to Turkish nationals.', opportunityUrl: 'https://www.csc.edu.cn/', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'Marie Skłodowska-Curie', title: 'Doctoral Networks (DN)', fundingType: 'phd_scholarship', region: 'eu', description: 'EU doctoral networks with international mobility — joint supervision, secondments. Maritime, energy, ML.', opportunityUrl: 'https://marie-sklodowska-curie-actions.ec.europa.eu/actions/doctoral-networks', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'Erasmus Mundus', title: 'Joint Doctorate (JMD)', fundingType: 'phd_scholarship', region: 'eu', description: 'Joint/double degree PhD across EU and partner universities. Cotutelle-style supervision. International applicants including Turkey.', opportunityUrl: 'https://www.eacea.ec.europa.eu/scholarships/emjmd-catalogue_en', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'NWO', title: 'PhD programmes & bilateral research (Netherlands)', fundingType: 'phd_scholarship', region: 'eu', description: 'Dutch Research Council funded PhD positions. University partnerships with Turkey. Joint supervision with Dutch and foreign co-supervisors.', opportunityUrl: 'https://www.nwo.nl/en/funding', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'DAAD', title: 'DAAD PhD / bi-national supervision', fundingType: 'phd_scholarship', region: 'eu', description: 'Research in Germany/NL corridor for international graduates. Cotutelle and co-supervision models.', opportunityUrl: 'https://www.daad.de/en/', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'MEXT', title: 'MEXT Research Student', fundingType: 'phd_scholarship', region: 'japan', description: 'Japanese government graduate scholarship.', opportunityUrl: 'https://www.studyinjapan.go.jp/', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'KAUST', title: 'KAUST PhD Fellowship', fundingType: 'phd_scholarship', region: 'gulf', description: 'Full tuition, stipend, housing. AI, energy, engineering.', opportunityUrl: 'https://www.kaust.edu.sa/en/study/phd', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'Commonwealth', title: 'Commonwealth PhD Scholarships', fundingType: 'phd_scholarship', region: 'uk', description: 'UK PhD for Commonwealth citizens only — not open to Turkish nationals.', opportunityUrl: 'https://cscuk.fcdo.gov.uk/scholarships/', source: 'curated:global', fullFunding: true, priorityTier: 'global' },
  { funder: 'DNV', title: 'DNV Research Collaborations', fundingType: 'fellowship', region: 'eu', description: 'Maritime, energy, assurance research.', opportunityUrl: 'https://www.dnv.com/research/', source: 'curated:global', priorityTier: 'global' },
  { funder: "Lloyd's Register Foundation", title: 'Maritime Safety Grants', fundingType: 'project_grant', region: 'uk', description: 'Maritime safety and engineering grants.', opportunityUrl: 'https://www.lrfoundation.org.uk/funding', source: 'curated:global', priorityTier: 'global' },
  { funder: 'Ørsted', title: 'Offshore Wind Research', fundingType: 'fellowship', region: 'eu', description: 'Renewable energy PhD partnerships.', opportunityUrl: 'https://orsted.com/careers/students', source: 'curated:global', priorityTier: 'global' },
]

/** @deprecated use GLOBAL_CURATED_OPPORTUNITIES */
export const CURATED_OPPORTUNITIES = GLOBAL_CURATED_OPPORTUNITIES

export function buildCuratedBatch(settings: FundingSettings, deep: boolean): FundingCandidate[] {
  const batch: FundingCandidate[] = []

  if (isTurkishCandidate(settings)) {
    batch.push(...TURKEY_PRIORITY_OPPORTUNITIES)
  }

  if (settings.homeUniversity.trim()) {
    batch.push(...universityOpportunitiesFor(settings.homeUniversity))
  }

  batch.push(...(deep ? GLOBAL_CURATED_OPPORTUNITIES : GLOBAL_CURATED_OPPORTUNITIES.slice(0, 8)))
  return batch
}

export function sourcesForRegions(regions: string[], batchSize = 12): FundingSource[] {
  const set = new Set(regions)
  const turkeyAlways = FUNDING_SOURCES.filter((s) => s.region === 'turkey')
  const rest = FUNDING_SOURCES.filter((s) => s.region !== 'turkey' && (set.has(s.region) || set.has('global')))

  if (!set.has('turkey') && !isTurkishCandidate({ regions })) {
    if (rest.length <= batchSize) return rest
    const day = new Date().getDate()
    const start = (day * 3) % rest.length
    return Array.from({ length: batchSize }, (_, i) => rest[(start + i) % rest.length])
  }

  const turkeyCount = turkeyAlways.length
  const restBatch = Math.max(4, batchSize - turkeyCount)
  let rotated = rest
  if (rest.length > restBatch) {
    const day = new Date().getDate()
    const start = (day * 3) % rest.length
    rotated = Array.from({ length: restBatch }, (_, i) => rest[(start + i) % rest.length])
  }
  return [...turkeyAlways, ...rotated]
}

const FETCH_HEADERS = { 'User-Agent': 'asliCo-FundingScout/1.0', Accept: 'application/rss+xml, */*' }

function decodeXmlEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function tagValue(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  return decodeXmlEntities(block.match(re)?.[1]?.trim() ?? '')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function parseFundingRss(feedUrl: string, region: FundingRegion, label: string, limit = 25): Promise<FundingCandidate[]> {
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(20000), headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`RSS ${res.status}`)
  const xml = await res.text()
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return items.slice(0, limit).map((block) => {
    const title = tagValue(block, 'title') ?? 'Funding opportunity'
    const link = tagValue(block, 'link') ?? tagValue(block, 'id')
    const desc = stripHtml(tagValue(block, 'description') ?? tagValue(block, 'summary') ?? '')
    const hay = `${title} ${desc}`.toLowerCase()
    const deadline = parseDeadlineFromText(`${title}\n${desc}`)
    let fundingType: FundingCandidate['fundingType'] = 'phd_scholarship'
    if (hay.includes('fellowship') || hay.includes('postdoc')) fundingType = 'fellowship'
    else if (hay.includes('grant')) fundingType = 'project_grant'
    return {
      funder: label,
      title: title.slice(0, 300),
      fundingType,
      region,
      description: desc.slice(0, 8000) || title,
      opportunityUrl: link,
      deadline: deadline ?? undefined,
      source: `rss:${label}`,
    }
  })
}

export async function fetchPortalListings(source: FundingSource): Promise<FundingCandidate[]> {
  if (!source.portalUrl) return []
  return [{
    funder: source.label,
    title: `${source.label} — resmi burs / hibe portalı`,
    fundingType: (source.fundingTypes[0] ?? 'phd_scholarship') as FundingCandidate['fundingType'],
    region: source.region,
    description: `Resmi ${source.label} burs ve destek duyuruları. Doktora, lisansüstü burs, proje hibeleri. PhD, fellowship, grants for maritime, energy, AI, engineering.`,
    opportunityUrl: source.portalUrl,
    source: `portal:${source.id}`,
    priorityTier: source.region === 'turkey' ? 'turkey_national' : undefined,
  }]
}
