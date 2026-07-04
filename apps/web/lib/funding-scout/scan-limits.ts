import type { FundingSettings } from '@/lib/funding-scout/types'

export function fundingScanLimits(settings: FundingSettings) {
  const deep = settings.scanDepth === 'deep'
  return {
    maxPacks: deep ? 6 : 4,
    rssPerFeed: deep ? 30 : 18,
    sourceBatch: deep ? 6 : 4,
    announcementsPerPage: deep ? 22 : 14,
    searchQueries: deep ? 10 : 6,
    resultsPerQuery: deep ? 5 : 4,
    enrichConcurrency: deep ? 4 : 3,
  }
}
