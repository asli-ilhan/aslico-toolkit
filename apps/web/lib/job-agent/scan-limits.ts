import type { SearchPreferences } from '@/lib/job-agent/types'

export type ScanDepth = 'normal' | 'deep'

export interface ScanLimits {
  maxPacks: number
  rssPerFeed: number
  employerBatch: number
  maritimeBatch: number
  remoteOkLimit: number
  remotiveLimit: number
}

export function scanLimits(preferences: SearchPreferences): ScanLimits {
  const deep = preferences.scanDepth === 'deep'
  return {
    maxPacks: deep ? 18 : 12,
    rssPerFeed: deep ? 50 : 35,
    employerBatch: deep ? 18 : 12,
    maritimeBatch: deep ? 15 : 8,
    remoteOkLimit: deep ? 150 : 120,
    remotiveLimit: deep ? 120 : 100,
  }
}
