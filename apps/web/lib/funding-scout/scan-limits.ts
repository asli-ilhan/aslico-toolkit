import type { FundingSettings } from '@/lib/funding-scout/types'

export function fundingScanLimits(settings: FundingSettings) {
  const deep = settings.scanDepth === 'deep'
  return { maxPacks: deep ? 12 : 8, rssPerFeed: deep ? 35 : 20, sourceBatch: deep ? 18 : 12, curatedAll: deep }
}
