export type TravelVibe = 'offbeat' | 'authentic' | 'high-society' | 'hidden-gem'

export interface UnusualDestination {
  name: string
  region: string
  country: string
  vibe: TravelVibe[]
  why: string
}

/** Curated off-the-beaten-path & insider picks worldwide. */
export const UNUSUAL_DESTINATIONS: UnusualDestination[] = [
  { name: 'Faroe Islands', region: 'North Atlantic', country: 'Denmark', vibe: ['offbeat', 'hidden-gem'], why: 'Dramatic cliffs, tiny capital, almost no crowds' },
  { name: 'Matera', region: 'Basilicata', country: 'Italy', vibe: ['authentic', 'hidden-gem'], why: 'Ancient sassi caves — before the mass-tourism wave' },
  { name: 'Lofoten Islands', region: 'Arctic Norway', country: 'Norway', vibe: ['offbeat', 'hidden-gem'], why: 'Fishing villages above the Arctic Circle' },
  { name: 'Bhutan', region: 'Himalayas', country: 'Bhutan', vibe: ['offbeat', 'authentic'], why: 'High-value low-volume tourism by design' },
  { name: 'São Tomé and Príncipe', region: 'Gulf of Guinea', country: 'São Tomé', vibe: ['offbeat', 'hidden-gem'], why: 'Colonial cacao islands few travellers reach' },
  { name: 'Gstaad', region: 'Bernese Oberland', country: 'Switzerland', vibe: ['high-society', 'authentic'], why: 'Old-money alpine society, discreet luxury' },
  { name: 'Salzburg Festival fringe', region: 'Salzburg', country: 'Austria', vibe: ['high-society', 'authentic'], why: 'Opera season — society calendar, not package tours' },
  { name: 'Oman — Musandam', region: 'Musandam', country: 'Oman', vibe: ['offbeat', 'authentic'], why: 'Fjords of Arabia, understated wealth' },
  { name: 'Puglia — Ostuni', region: 'Puglia', country: 'Italy', vibe: ['authentic', 'hidden-gem'], why: 'White hill town, agriturismo, slow Italy' },
  { name: 'Colonia del Sacramento', region: 'Río de la Plata', country: 'Uruguay', vibe: ['authentic', 'hidden-gem'], why: 'Portuguese quarter, Buenos Aires escape' },
  { name: 'Kakheti wine region', region: 'Kakheti', country: 'Georgia', vibe: ['offbeat', 'authentic'], why: 'Qvevri wine in family cellars' },
  { name: 'Haida Gwaii', region: 'British Columbia', country: 'Canada', vibe: ['offbeat', 'hidden-gem'], why: 'First Nations art and Pacific edge-of-world' },
  { name: 'Comporta', region: 'Alentejo coast', country: 'Portugal', vibe: ['high-society', 'hidden-gem'], why: 'Discreet Portuguese riviera before overcrowding' },
  { name: 'Luang Prabang at dawn', region: 'Northern Laos', country: 'Laos', vibe: ['authentic', 'offbeat'], why: 'Monks, Mekong, French-Lao calm' },
  { name: 'Socotra Island', region: 'Indian Ocean', country: 'Yemen', vibe: ['offbeat', 'hidden-gem'], why: 'Alien landscapes, extremely remote' },
  { name: 'Isle of Harris', region: 'Outer Hebrides', country: 'Scotland', vibe: ['offbeat', 'authentic'], why: 'Tweed, emptiness, North Atlantic light' },
  { name: 'Merida Yucatan', region: 'Yucatán', country: 'Mexico', vibe: ['authentic', 'hidden-gem'], why: 'Colonial centre beyond Cancún noise' },
  { name: 'Kotor Bay hinterland', region: 'Montenegro', country: 'Montenegro', vibe: ['hidden-gem', 'authentic'], why: 'Behind the cruise-ship waterfront' },
  { name: 'Naoshima', region: 'Seto Inland Sea', country: 'Japan', vibe: ['offbeat', 'high-society'], why: 'Art island pilgrimage, Tadao Ando' },
  { name: 'Patagonia — El Chaltén', region: 'Santa Cruz', country: 'Argentina', vibe: ['offbeat', 'hidden-gem'], why: 'Fitz Roy trails without Torres del Paine crowds' },
]

export const DEFAULT_VIBES: TravelVibe[] = ['offbeat', 'authentic', 'high-society', 'hidden-gem']

export function pickRandomDestination(vibes?: TravelVibe[]): UnusualDestination {
  const pool =
    vibes?.length ?
      UNUSUAL_DESTINATIONS.filter((d) => d.vibe.some((v) => vibes.includes(v)))
    : UNUSUAL_DESTINATIONS
  const list = pool.length ? pool : UNUSUAL_DESTINATIONS
  return list[Math.floor(Math.random() * list.length)]!
}

export function nearbyRegions(destination: string): string[] {
  const map: Record<string, string[]> = {
    london: ['Kent', 'Sussex', 'Cotswolds', 'Norfolk coast'],
    istanbul: ['Princes Islands', 'Bursa', 'Şile', 'Gallipoli peninsula'],
    paris: ['Champagne', 'Loire Valley châteaux', 'Normandy villages'],
    'new york': ['Hudson Valley', 'Fire Island', 'Catskills'],
    rome: ['Umbria', 'Sabina', 'Tivoli hills'],
    singapore: ['Bintan', 'Malacca', 'Tioman Island'],
    dubai: ['Hatta', 'Musandam', 'Al Ain oasis'],
    tokyo: ['Nikko', 'Kamakura', 'Izu Peninsula'],
  }
  const key = destination.toLowerCase().trim()
  for (const [k, regions] of Object.entries(map)) {
    if (key.includes(k)) return regions
  }
  return [`countryside near ${destination}`, `coast near ${destination}`]
}
