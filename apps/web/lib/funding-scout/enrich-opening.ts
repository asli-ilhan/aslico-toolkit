import type { FundingCandidate } from '@/lib/funding-scout/types'
import { parseDeadlineFromText } from '@/lib/funding-scout/deadline'
import { fetchPrimarySource, mapInBatches } from '@/lib/funding-scout/fetch-primary'
import { isWebSearchAvailable, verifyOpeningSearch, type WebSearchHit } from '@/lib/funding-scout/web-search'

export interface EnrichedFundingCandidate extends FundingCandidate {
  listingDescription: string
  primarySourceText?: string
  primarySourceFetchedAt?: string
  primarySourceUrl?: string
  searchVerificationSnippets?: WebSearchHit[]
}

export function composeEnrichedDescription(enriched: EnrichedFundingCandidate): string {
  let text = enriched.listingDescription
  if (enriched.primarySourceText) {
    text += `\n\n--- PRIMARY SOURCE (${enriched.primarySourceFetchedAt ?? 'fetched'}) ---\n${enriched.primarySourceText}`
  }
  if (enriched.searchVerificationSnippets?.length) {
    const block = enriched.searchVerificationSnippets
      .map((h) => `[${h.title}] ${h.url}\n${h.snippet}`)
      .join('\n\n')
    text += `\n\n--- WEB VERIFICATION SNIPPETS ---\n${block}`
  }
  return text.slice(0, 25000)
}

export async function enrichOpening(
  opp: FundingCandidate,
  options?: { fetchPrimary?: boolean; verifySearch?: boolean },
): Promise<EnrichedFundingCandidate> {
  const fetchPrimary = options?.fetchPrimary !== false
  const verifySearch = options?.verifySearch !== false && isWebSearchAvailable()

  const enriched: EnrichedFundingCandidate = {
    ...opp,
    listingDescription: opp.description,
  }

  if (opp.source.startsWith('curated:')) {
    return enriched
  }

  if (fetchPrimary && opp.opportunityUrl) {
    const primary = await fetchPrimarySource(opp.opportunityUrl)
    if (primary.ok && primary.text) {
      enriched.primarySourceText = primary.text
      enriched.primarySourceFetchedAt = primary.fetchedAt
      enriched.primarySourceUrl = primary.url
      if (!enriched.deadline && primary.deadline) {
        enriched.deadline = primary.deadline
      }
    }
  }

  if (verifySearch) {
    const hits = await verifyOpeningSearch(opp.funder, opp.title)
    if (hits.length) {
      enriched.searchVerificationSnippets = hits
      if (!enriched.deadline) {
        const block = hits.map((h) => h.snippet).join(' ')
        enriched.deadline = parseDeadlineFromText(block) ?? enriched.deadline
      }
    }
  }

  return enriched
}

export async function enrichOpeningsBatch(
  openings: FundingCandidate[],
  options?: { concurrency?: number; fetchPrimary?: boolean; verifySearch?: boolean },
): Promise<EnrichedFundingCandidate[]> {
  const concurrency = options?.concurrency ?? 3
  return mapInBatches(openings, concurrency, (opp) => enrichOpening(opp, options))
}
