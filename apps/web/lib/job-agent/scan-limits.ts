import type { SearchPreferences } from '@/lib/job-agent/types'

export type ScanDepth = 'normal' | 'deep'

export interface ScanLimits {
  maxPacks: number
  rssPerFeed: number
  employerBatch: number
  maritimeBatch: number
  remoteOkLimit: number
  remotiveLimit: number
  maxRankedEval: number
  maxRssFeeds: number
}

export function scanLimits(preferences: SearchPreferences): ScanLimits {
  const deep = preferences.scanDepth === 'deep'
  return {
    maxPacks: deep ? 8 : 3,
    rssPerFeed: deep ? 25 : 10,
    employerBatch: deep ? 8 : 3,
    maritimeBatch: deep ? 6 : 2,
    remoteOkLimit: deep ? 100 : 60,
    remotiveLimit: deep ? 80 : 50,
    maxRankedEval: deep ? 30 : 12,
    maxRssFeeds: deep ? 12 : 5,
  }
}
