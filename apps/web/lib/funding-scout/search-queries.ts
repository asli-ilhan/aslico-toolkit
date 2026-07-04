import type { FundingSettings } from '@/lib/funding-scout/types'
import { isTurkishCandidate } from '@/lib/funding-scout/turkey-priority'

function hasRegion(settings: FundingSettings, region: string): boolean {
  return settings.regions.includes(region as FundingSettings['regions'][number])
}

/** Category-based discovery queries — one target per query, 2–6 words where possible. */
export function buildDiscoveryQueries(settings: FundingSettings, disciplines: string[]): string[] {
  const year = new Date().getFullYear()
  const field = disciplines.slice(0, 2).join(' ') || 'maritime engineering'
  const queries: string[] = []

  if (isTurkishCandidate(settings)) {
    queries.push(`TÜBİTAK 2210 ${year} başvuru`)
    queries.push('TÜBİTAK 2247 yurtdışı doktora')
    queries.push('YÖK 100/2000 doktora duyuru')
    queries.push('KYK yurt dışı lisansüstü')
    if (settings.homeUniversity) {
      queries.push(`${settings.homeUniversity} doktora burs ilan`)
    }
    queries.push('Fulbright Türkiye doktora burs')
  }

  if (hasRegion(settings, 'eu') || hasRegion(settings, 'global')) {
    queries.push(`MSCA doctoral network ${year} call`)
    queries.push('Erasmus Mundus PhD scholarship open')
    queries.push(`NWO PhD fellowship ${field}`)
    queries.push(`Horizon Europe PhD ${field}`)
  }

  if (hasRegion(settings, 'china') || settings.partnerCountries.includes('china')) {
    queries.push(`CSC scholarship PhD ${year}`)
    queries.push('China co-supervision PhD grant')
  }

  if (settings.partnerCountries.includes('netherlands')) {
    queries.push('TU Delft PhD scholarship open')
    queries.push('Netherlands cotutelle PhD funding')
  }

  if (hasRegion(settings, 'japan')) {
    queries.push(`MEXT scholarship ${year}`)
    queries.push('JSPS fellowship doctoral')
  }

  if (hasRegion(settings, 'gulf')) {
    queries.push('KAUST PhD fellowship application')
    queries.push('Qatar research PhD scholarship')
  }

  if (hasRegion(settings, 'uk')) {
    queries.push(`UKRI PhD studentship ${field}`)
    queries.push(`FindAPhD ${field} funded`)
  }

  if (hasRegion(settings, 'americas')) {
    queries.push('Fulbright foreign student PhD')
  }

  if (hasRegion(settings, 'korea')) {
    queries.push('KGSP graduate scholarship')
  }

  queries.push(`PhD scholarship ${field} ${year}`)
  queries.push('digital twin maritime PhD funding')
  queries.push('CFD hydrodynamics PhD scholarship')

  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))]
  return unique
}

export function pickDiscoveryQueries(settings: FundingSettings, disciplines: string[], limit: number): string[] {
  const all = buildDiscoveryQueries(settings, disciplines)
  if (all.length <= limit) return all
  const day = new Date().getDate()
  const start = day % all.length
  return Array.from({ length: limit }, (_, i) => all[(start + i) % all.length])
}
