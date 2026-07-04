import type { FundingSettings } from '@/lib/funding-scout/types'

export function fundingScanLimits(settings: FundingSettings) {
  const deep = settings.scanDepth === 'deep'
  const turkish = settings.homeCountry === 'TR' || settings.citizenship === 'TR' || settings.regions.includes('turkey')
  return {
    maxPacks: deep ? (turkish ? 16 : 12) : turkish ? 12 : 8,
    rssPerFeed: deep ? 35 : 20,
    sourceBatch: deep ? 22 : 16,
    curatedAll: deep,
  }
}
