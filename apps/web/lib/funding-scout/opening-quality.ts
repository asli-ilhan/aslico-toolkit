import type { FundingCandidate } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'

const FETCH_HEADERS = {
  'User-Agent': 'asliCo-FundingScout/1.0 (live openings)',
  Accept: 'text/html,application/xhtml+xml,application/rss+xml,*/*',
}

const GENERIC_TITLE_RE =
  /\b(portal|funding portal|resmi burs|programı$|programme$|— funding|scholarships? page|home page)\b/i

const CALL_SIGNAL_RE =
  /\b(call for|now open|applications? open|apply by|apply until|deadline|closing date|başvur|basvuru|duyuru|ilan|açık|acik|opening|intake|cohort|contest|call\s*#\d|202[5-9]|son başvuru|application period|call is open)\b/i

const FUNDING_LINK_RE =
  /\b(burs|scholarship|fellowship|doktora|phd|doctoral|grant|hibe|2210|2214|2247|100\/2000|msca|marie curie|cotutelle|co-supervis|position|studentship|vacancy|stipend)\b/i

const LINK_TAG_RE = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function absoluteUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href, base)
    if (!/^https?:$/i.test(u.protocol)) return null
    return u.toString()
  } catch {
    return null
  }
}

function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length
  } catch {
    return 0
  }
}

/** True when this looks like a concrete call / posting, not a generic program catalog entry. */
export function isSpecificOpening(opp: FundingCandidate): boolean {
  if (opp.priorityTier === 'turkey_national' || opp.priorityTier === 'home_university') return true
  if (opp.source.startsWith('curated:turkey-priority')) return true
  if (opp.listingKind === 'live_opening') return true
  if (opp.listingKind === 'program_catalog') return false
  if (opp.source.startsWith('portal:')) return false
  if (opp.source.startsWith('curated:')) return false

  const title = opp.title.trim()
  const hay = `${title} ${opp.description}`.toLowerCase()

  if (GENERIC_TITLE_RE.test(title)) return false
  if (title.length < 12) return false

  if (opp.source.startsWith('rss:') || opp.source.startsWith('announcement:')) {
    return FUNDING_LINK_RE.test(hay) || CALL_SIGNAL_RE.test(hay) || Boolean(opp.deadline)
  }

  if (opp.deadline) return true
  if (CALL_SIGNAL_RE.test(hay) && FUNDING_LINK_RE.test(hay)) return true

  const url = opp.opportunityUrl
  if (url && pathDepth(url) >= 3 && FUNDING_LINK_RE.test(hay)) return true

  return false
}

export function filterLiveOpenings(candidates: FundingCandidate[]): FundingCandidate[] {
  return candidates.filter(isSpecificOpening)
}

export interface AnnouncementPage {
  funder: string
  url: string
  region: FundingCandidate['region']
}

export const ANNOUNCEMENT_PAGES: AnnouncementPage[] = [
  { funder: 'TÜBİTAK', url: 'https://www.tubitak.gov.tr/tr/duyurular', region: 'turkey' },
  { funder: 'TÜBİTAK', url: 'https://www.tubitak.gov.tr/tr/burslar/lisansustu-burs-programlari', region: 'turkey' },
  { funder: 'YÖK 100/2000', url: 'https://1002000.yok.gov.tr/tr/announcements', region: 'turkey' },
  { funder: 'YÖK 100/2000', url: 'https://1002000.yok.gov.tr/', region: 'turkey' },
  { funder: 'Fulbright Turkey', url: 'https://fulbright.org.tr/burslar/', region: 'turkey' },
  { funder: 'İTÜ', url: 'https://lee.itu.edu.tr/lee/duyurular', region: 'turkey' },
  { funder: 'İTÜ', url: 'https://www.itu.edu.tr/itu-arastirma-gorevlisi-ve-doktora-bursiyeri-alimlari', region: 'turkey' },
  { funder: 'UKRI', url: 'https://www.ukri.org/opportunity/', region: 'uk' },
  { funder: 'Marie Skłodowska-Curie', url: 'https://marie-sklodowska-curie-actions.ec.europa.eu/actions/doctoral-networks', region: 'eu' },
  { funder: 'FindAPhD', url: 'https://www.findaphd.com/phds/maritime/?PG=1', region: 'uk' },
  { funder: 'FindAPhD', url: 'https://www.findaphd.com/phds/engineering/?PG=1', region: 'uk' },
  { funder: 'Euraxess', url: 'https://euraxess.ec.europa.eu/jobs/search?keywords=phd', region: 'eu' },
]

export async function scrapeAnnouncementPage(page: AnnouncementPage, limit = 20): Promise<FundingCandidate[]> {
  const res = await fetch(page.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${page.funder} announcements ${res.status}`)
  const html = await res.text()
  const pageText = stripHtml(html).slice(0, 50000)
  const results: FundingCandidate[] = []
  const seen = new Set<string>()

  LINK_TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LINK_TAG_RE.exec(html)) !== null && results.length < limit) {
    const href = match[1]
    const linkText = stripHtml(match[2]).trim()
    if (!linkText || linkText.length < 8) continue
    const abs = absoluteUrl(page.url, href)
    if (!abs || seen.has(abs) || abs === page.url) continue

    const contextStart = Math.max(0, match.index - 200)
    const contextEnd = Math.min(html.length, match.index + 400)
    const context = stripHtml(html.slice(contextStart, contextEnd))
    const blob = `${linkText} ${context}`.toLowerCase()

    if (!FUNDING_LINK_RE.test(blob) && !CALL_SIGNAL_RE.test(blob)) continue
    if (/^(devam|read more|more|tümü|detay|home|anasayfa)$/i.test(linkText)) continue

    seen.add(abs)
    const deadline = parseDeadlineFromText(`${linkText}\n${context}\n${pageText.slice(0, 2000)}`)
    let fundingType: FundingCandidate['fundingType'] = 'phd_scholarship'
    if (/\bfellowship\b/i.test(blob)) fundingType = 'fellowship'
    else if (/\bgrant\b/i.test(blob)) fundingType = 'project_grant'

    results.push({
      funder: page.funder,
      title: linkText.slice(0, 300),
      fundingType,
      region: page.region,
      description: `${linkText}. ${context}`.slice(0, 8000),
      opportunityUrl: abs,
      deadline: deadline ?? undefined,
      source: `announcement:${page.funder}`,
      listingKind: 'live_opening',
    })
  }

  return results
}

export async function fetchAllLiveAnnouncements(
  pages: AnnouncementPage[],
  perPage = 15,
): Promise<{ items: FundingCandidate[]; log: string[] }> {
  const all: FundingCandidate[] = []
  const log: string[] = []
  for (const page of pages) {
    try {
      const items = await scrapeAnnouncementPage(page, perPage)
      all.push(...items)
      log.push(`  ${page.funder}: ${items.length} links`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed'
      log.push(`  ${page.funder}: scrape failed — ${msg}`)
    }
  }
  return { items: all, log }
}
