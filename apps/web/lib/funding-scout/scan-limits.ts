import type { FundingSettings } from '@/lib/funding-scout/types'

export function fundingScanLimits(settings: FundingSettings) {
  const deep = settings.scanDepth === 'deep'
  return {
    maxPacks: deep ? 3 : 2,
    rssPerFeed: deep ? 12 : 8,
    sourceBatch: deep ? 4 : 3,
    announcementsPerPage: deep ? 10 : 8,
    maxAnnouncementPages: deep ? 7 : 5,
    maxRssFeeds: deep ? 4 : 3,
    searchQueries: deep ? 4 : 2,
    resultsPerQuery: deep ? 4 : 3,
    enrichConcurrency: 2,
    evalWindow: deep ? 3 : 2,
    maxEvaluate: deep ? 12 : 8,
  }
}
