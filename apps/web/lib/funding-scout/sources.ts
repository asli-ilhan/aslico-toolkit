import type { FundingCandidate, FundingRegion } from '@/lib/funding-scout/types'

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
  { id: 'tubitak', region: 'turkey', label: 'TÜBİTAK', portalUrl: 'https://www.tubitak.gov.tr/en/scholarships', fundingTypes: ['phd_scholarship', 'project_grant'] },
  { id: 'csc', region: 'china', label: 'CSC', portalUrl: 'https://www.csc.edu.cn/', fundingTypes: ['phd_scholarship'] },
  { id: 'mext', region: 'japan', label: 'MEXT', portalUrl: 'https://www.studyinjapan.go.jp/', fundingTypes: ['phd_scholarship'] },
  { id: 'jsps', region: 'japan', label: 'JSPS', portalUrl: 'https://www.jsps.go.jp/english/', fundingTypes: ['fellowship'] },
  { id: 'gks', region: 'korea', label: 'GKS', portalUrl: 'https://www.studyinkorea.go.kr/', fundingTypes: ['phd_scholarship'] },
  { id: 'kaust', region: 'gulf', label: 'KAUST', portalUrl: 'https://www.kaust.edu.sa/en/study/phd', fundingTypes: ['phd_scholarship'] },
  { id: 'qf', region: 'gulf', label: 'Qatar Foundation', portalUrl: 'https://www.qf.org.qa/', fundingTypes: ['phd_scholarship'] },
  { id: 'profellow', region: 'americas', label: 'ProFellow', portalUrl: 'https://www.profellow.com/', fundingTypes: ['fellowship'] },
  { id: 'fulbright-tr', region: 'turkey', label: 'Fulbright Turkey', portalUrl: 'https://fulbright.org.tr/', fundingTypes: ['fellowship'] },
  { id: 'ukri', region: 'uk', label: 'UKRI', portalUrl: 'https://www.ukri.org/opportunity/', fundingTypes: ['project_grant'] },
  { id: 'lrf', region: 'uk', label: "Lloyd's Register Foundation", portalUrl: 'https://www.lrfoundation.org.uk/funding', fundingTypes: ['project_grant'] },
  { id: 'academicpositions', region: 'global', label: 'Academic Positions', rssUrl: 'https://academicpositions.com/find-jobs/rss', fundingTypes: ['phd_scholarship'] },
]

export const CURATED_OPPORTUNITIES: FundingCandidate[] = [
  { funder: 'TÜBİTAK', title: '2210-A National PhD Fellowship', fundingType: 'phd_scholarship', region: 'turkey', description: 'Turkish national PhD scholarship. Engineering, maritime, AI.', opportunityUrl: 'https://www.tubitak.gov.tr/en/scholarships', source: 'curated', fullFunding: true },
  { funder: 'Marie Skłodowska-Curie', title: 'Doctoral Networks (DN)', fundingType: 'phd_scholarship', region: 'eu', description: 'EU doctoral networks — maritime, energy, ML.', opportunityUrl: 'https://marie-sklodowska-curie-actions.ec.europa.eu/actions/doctoral-networks', source: 'curated', fullFunding: true },
  { funder: 'CSC', title: 'Chinese Government Scholarship — PhD', fundingType: 'phd_scholarship', region: 'china', description: 'Full scholarship for international PhD in China.', opportunityUrl: 'https://www.csc.edu.cn/', source: 'curated', fullFunding: true },
  { funder: 'MEXT', title: 'MEXT Research Student', fundingType: 'phd_scholarship', region: 'japan', description: 'Japanese government graduate scholarship.', opportunityUrl: 'https://www.studyinjapan.go.jp/', source: 'curated', fullFunding: true },
  { funder: 'KAUST', title: 'KAUST PhD Fellowship', fundingType: 'phd_scholarship', region: 'gulf', description: 'Full tuition, stipend, housing. AI, energy, engineering.', opportunityUrl: 'https://www.kaust.edu.sa/en/study/phd', source: 'curated', fullFunding: true },
  { funder: 'Commonwealth', title: 'Commonwealth PhD Scholarships', fundingType: 'phd_scholarship', region: 'uk', description: 'UK PhD for Commonwealth citizens.', opportunityUrl: 'https://cscuk.fcdo.gov.uk/scholarships/', source: 'curated', fullFunding: true },
  { funder: 'DNV', title: 'DNV Research Collaborations', fundingType: 'fellowship', region: 'eu', description: 'Maritime, energy, assurance research.', opportunityUrl: 'https://www.dnv.com/research/', source: 'curated' },
  { funder: "Lloyd's Register Foundation", title: 'Maritime Safety Grants', fundingType: 'project_grant', region: 'uk', description: 'Maritime safety and engineering grants.', opportunityUrl: 'https://www.lrfoundation.org.uk/funding', source: 'curated' },
  { funder: 'Ørsted', title: 'Offshore Wind Research', fundingType: 'fellowship', region: 'eu', description: 'Renewable energy PhD partnerships.', opportunityUrl: 'https://orsted.com/careers/students', source: 'curated' },
  { funder: 'DAAD', title: 'DAAD PhD Scholarships Germany', fundingType: 'phd_scholarship', region: 'eu', description: 'Research in Germany for international graduates.', opportunityUrl: 'https://www.daad.de/en/', source: 'curated', fullFunding: true },
]

export function sourcesForRegions(regions: string[], batchSize = 12): FundingSource[] {
  const set = new Set(regions)
  const matched = FUNDING_SOURCES.filter((s) => set.has(s.region) || set.has('global'))
  if (matched.length <= batchSize) return matched
  const day = new Date().getDate()
  const start = (day * 3) % matched.length
  return Array.from({ length: batchSize }, (_, i) => matched[(start + i) % matched.length])
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
    let fundingType: FundingCandidate['fundingType'] = 'phd_scholarship'
    if (hay.includes('fellowship') || hay.includes('postdoc')) fundingType = 'fellowship'
    else if (hay.includes('grant')) fundingType = 'project_grant'
    return { funder: label, title: title.slice(0, 300), fundingType, region, description: desc.slice(0, 8000) || title, opportunityUrl: link, source: `rss:${label}` }
  })
}

export async function fetchPortalListings(source: FundingSource): Promise<FundingCandidate[]> {
  if (!source.portalUrl) return []
  return [{
    funder: source.label,
    title: `${source.label} — funding portal`,
    fundingType: (source.fundingTypes[0] ?? 'phd_scholarship') as FundingCandidate['fundingType'],
    region: source.region,
    description: `Open funding listings at ${source.label}. PhD, fellowship, grants for maritime, energy, AI, engineering.`,
    opportunityUrl: source.portalUrl,
    source: `portal:${source.id}`,
  }]
}
