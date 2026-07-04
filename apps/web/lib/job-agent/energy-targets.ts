/** Energy / utilities / renewables companies — careers pages rotated into nightly scans. */
export interface EnergyTarget {
  company: string
  category: string
  careersUrl: string
}

export const ENERGY_TARGETS: EnergyTarget[] = [
  { company: 'Equinor', category: 'Oil & gas / offshore wind', careersUrl: 'https://www.equinor.com/careers' },
  { company: 'Ørsted', category: 'Offshore wind', careersUrl: 'https://orsted.com/careers' },
  { company: 'Vestas', category: 'Wind OEM', careersUrl: 'https://www.vestas.com/en/careers' },
  { company: 'Siemens Energy', category: 'Energy technology', careersUrl: 'https://www.siemens-energy.com/global/en/company/jobs.html' },
  { company: 'ABB', category: 'Power / automation', careersUrl: 'https://global.abb/group/en/careers' },
  { company: 'Schneider Electric', category: 'Energy management', careersUrl: 'https://www.se.com/ww/en/about-us/careers/' },
  { company: 'Iberdrola', category: 'Utilities / renewables', careersUrl: 'https://www.iberdrola.com/careers' },
  { company: 'RWE', category: 'Utilities / renewables', careersUrl: 'https://www.rwe.com/careers/' },
  { company: 'Vattenfall', category: 'Utilities', careersUrl: 'https://careers.vattenfall.com/' },
  { company: 'EDF', category: 'Utilities / nuclear', careersUrl: 'https://www.edf.fr/en/the-edf-group/join-us' },
  { company: 'Engie', category: 'Utilities / energy services', careersUrl: 'https://www.engie.com/en/jobs' },
  { company: 'Statkraft', category: 'Renewables / hydro', careersUrl: 'https://www.statkraft.com/careers/' },
  { company: 'DNV', category: 'Energy / maritime assurance', careersUrl: 'https://www.dnv.com/careers/' },
  { company: 'Worley', category: 'Energy engineering', careersUrl: 'https://www.worley.com/careers' },
  { company: 'Wood', category: 'Energy / consulting', careersUrl: 'https://www.woodplc.com/careers' },
  { company: 'Arup', category: 'Engineering consultancy', careersUrl: 'https://www.arup.com/careers' },
  { company: 'WSP', category: 'Engineering consultancy', careersUrl: 'https://www.wsp.com/en-us/careers' },
  { company: 'Fugro', category: 'Geo / offshore data', careersUrl: 'https://www.fugro.com/careers' },
  { company: 'Kongsberg', category: 'Maritime / digital', careersUrl: 'https://www.kongsberg.com/careers/' },
  { company: 'GE Vernova', category: 'Power / renewables', careersUrl: 'https://jobs.gecareers.com/vernova/global/en' },
]

export function energyBatchForRun(runIndex = 0, batchSize = 8): EnergyTarget[] {
  const all = ENERGY_TARGETS
  if (all.length <= batchSize) return all
  const start = (runIndex * batchSize) % all.length
  return Array.from({ length: batchSize }, (_, i) => all[(start + i) % all.length])
}
