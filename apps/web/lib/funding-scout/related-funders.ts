/** Known funders — relevant even when listing text lacks discipline keywords. */

export interface RelatedFunder {
  label: string
  patterns: string[]
  regions: string[]
  sectors: string[]
  url?: string
}

export const RELATED_FUNDERS: RelatedFunder[] = [
  { label: 'TÜBİTAK', patterns: ['tubitak', 'tübitak', '2210', '2214', '2247'], regions: ['turkey'], sectors: ['research', 'engineering'] },
  { label: 'YÖK 100/2000', patterns: ['yök', 'yok 100', '100/2000', '1002000'], regions: ['turkey'], sectors: ['research'] },
  { label: 'KYK', patterns: ['kyk', 'kredi ve yurtlar', 'yurtlar kurumu'], regions: ['turkey'], sectors: ['research'] },
  { label: 'İTÜ', patterns: ['itu', 'i̇tü', 'istanbul technical', 'istanbul teknik'], regions: ['turkey'], sectors: ['research', 'engineering', 'maritime'] },
  { label: 'İTÜ BAP', patterns: ['itu bap', 'i̇tü bap', 'bap.itu'], regions: ['turkey'], sectors: ['research'] },
  { label: 'Mevlana', patterns: ['mevlana'], regions: ['turkey'], sectors: ['research'] },
  { label: 'Marie Skłodowska-Curie', patterns: ['marie curie', 'msca', 'ms ca'], regions: ['eu'], sectors: ['research'] },
  { label: 'Horizon Europe', patterns: ['horizon europe', 'horizon 2020'], regions: ['eu'], sectors: ['research', 'energy'] },
  { label: 'Euraxess', patterns: ['euraxess'], regions: ['eu', 'global'], sectors: ['research'] },
  { label: 'UKRI', patterns: ['ukri', 'epsrc', 'nerc', 'esrc'], regions: ['uk'], sectors: ['research', 'engineering'] },
  { label: 'CSC', patterns: ['china scholarship', 'csc scholarship', 'csc '], regions: ['china'], sectors: ['research'] },
  { label: 'MEXT', patterns: ['mext', 'monbukagakusho'], regions: ['japan'], sectors: ['research'] },
  { label: 'JSPS', patterns: ['jsps'], regions: ['japan'], sectors: ['research'] },
  { label: 'KAUST', patterns: ['kaust'], regions: ['gulf'], sectors: ['research', 'energy', 'ai'] },
  { label: 'Qatar Foundation', patterns: ['qatar foundation', 'qnrf', 'hbku'], regions: ['gulf'], sectors: ['research'] },
  { label: 'DAAD', patterns: ['daad'], regions: ['eu', 'global'], sectors: ['research'] },
  { label: 'Fulbright', patterns: ['fulbright'], regions: ['americas', 'global'], sectors: ['research'] },
  { label: 'Commonwealth', patterns: ['commonwealth scholarship'], regions: ['uk', 'global'], sectors: ['research'] },
  { label: 'DNV', patterns: ['dnv'], regions: ['eu', 'global'], sectors: ['maritime', 'energy'] },
  { label: "Lloyd's Register Foundation", patterns: ['lloyd', "lloyd's register"], regions: ['uk', 'global'], sectors: ['maritime', 'engineering'] },
  { label: 'BP', patterns: [' bp ', 'british petroleum'], regions: ['uk', 'global'], sectors: ['energy'] },
  { label: 'Shell', patterns: ['shell'], regions: ['uk', 'global'], sectors: ['energy'] },
  { label: 'Equinor', patterns: ['equinor'], regions: ['eu', 'global'], sectors: ['energy', 'offshore'] },
  { label: 'Siemens', patterns: ['siemens'], regions: ['eu', 'global'], sectors: ['energy', 'engineering'] },
  { label: 'Ørsted', patterns: ['orsted', 'ørsted'], regions: ['eu'], sectors: ['wind', 'renewable_energy'] },
  { label: 'Vestas', patterns: ['vestas'], regions: ['eu', 'global'], sectors: ['wind'] },
  { label: 'FindAPhD', patterns: ['findaphd'], regions: ['uk', 'global'], sectors: ['research'] },
  { label: 'ProFellow', patterns: ['profellow'], regions: ['global'], sectors: ['research'] },
  { label: 'NWO', patterns: ['nwo', 'netherlands organisation'], regions: ['eu'], sectors: ['research'] },
  { label: 'Erasmus Mundus', patterns: ['erasmus mundus', 'emjmd'], regions: ['eu', 'global'], sectors: ['research'] },
]

export function matchRelatedFunder(name: string): RelatedFunder | null {
  const hay = name.toLowerCase()
  for (const f of RELATED_FUNDERS) {
    if (f.patterns.some((p) => hay.includes(p.trim()))) return f
  }
  return null
}

export function isRelatedFunder(name: string): boolean {
  return matchRelatedFunder(name) !== null
}
