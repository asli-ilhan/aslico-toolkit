import targets from './data/maritime-targets.json'

export interface MaritimeTarget {
  company: string
  category: string
  careersUrl: string
  fit: string
  remote: string
}

export const MARITIME_TARGETS: MaritimeTarget[] = targets as MaritimeTarget[]

export function maritimeCareersUrls(): string[] {
  return [...new Set(MARITIME_TARGETS.map((t) => t.careersUrl).filter(Boolean))]
}

export function maritimeTargetByCompany(company: string): MaritimeTarget | undefined {
  const key = company.toLowerCase().trim()
  return MARITIME_TARGETS.find((t) => t.company.toLowerCase().includes(key) || key.includes(t.company.toLowerCase()))
}

/** Per nightly run — rotate through targets to avoid timeouts. */
export function maritimeBatchForRun(runIndex = 0, batchSize = 25): MaritimeTarget[] {
  const all = MARITIME_TARGETS
  if (all.length <= batchSize) return all
  const start = (runIndex * batchSize) % all.length
  const batch: MaritimeTarget[] = []
  for (let i = 0; i < batchSize; i++) {
    batch.push(all[(start + i) % all.length])
  }
  return batch
}
