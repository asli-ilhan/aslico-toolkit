import type { SupabaseClient } from '@supabase/supabase-js'

const KNOWN_CITIES = [
  'London',
  'Istanbul',
  'İstanbul',
  'Paris',
  'Berlin',
  'Amsterdam',
  'New York',
  'Boston',
  'San Francisco',
  'Los Angeles',
  'Singapore',
  'Tokyo',
  'Dubai',
  'Athens',
  'Rome',
  'Madrid',
  'Barcelona',
  'Lisbon',
  'Vienna',
  'Zurich',
  'Geneva',
  'Copenhagen',
  'Stockholm',
  'Oslo',
  'Helsinki',
  'Milan',
  'Munich',
  'Brussels',
  'Dublin',
  'Edinburgh',
  'Hong Kong',
  'Seoul',
  'Sydney',
  'Melbourne',
  'Toronto',
  'Montreal',
  'Chicago',
  'Washington',
  'Ankara',
  'Izmir',
  'Antalya',
]

const FLIGHT_PATTERN =
  /\b(flight|fly(?:ing)?|depart(?:ure)?|arriv(?:e|al)|✈|→|->|to\s+[A-Z][a-z]+|from\s+[A-Z][a-z]+|LH\d+|TK\d+|BA\d+|AF\d+|LX\d+|EK\d+)\b/i

function normalizeCity(name: string): string {
  if (name === 'İstanbul') return 'Istanbul'
  return name.trim()
}

function extractCitiesFromText(text: string): string[] {
  const found: string[] = []
  for (const city of KNOWN_CITIES) {
    const re = new RegExp(`\\b${city.replace('.', '\\.')}\\b`, 'i')
    if (re.test(text)) found.push(normalizeCity(city))
  }
  const toMatch = text.match(/\b(?:to|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g)
  if (toMatch) {
    for (const m of toMatch) {
      const city = m.replace(/^(to|in|at)\s+/i, '').trim()
      if (city.length > 2 && city.length < 30) found.push(city)
    }
  }
  return found
}

export async function discoverCitiesFromCalendar(
  supabase: SupabaseClient,
  userId: string,
  horizonDays = 120,
): Promise<string[]> {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + horizonDays)

  const { data } = await supabase
    .from('calendar_events')
    .select('title, description, starts_at, ends_at')
    .eq('user_id', userId)
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
    .order('starts_at', { ascending: true })

  const cities = new Set<string>()

  for (const ev of data ?? []) {
    const blob = `${ev.title ?? ''} ${ev.description ?? ''}`
    const isTravel = FLIGHT_PATTERN.test(blob)
    for (const c of extractCitiesFromText(blob)) {
      if (isTravel || KNOWN_CITIES.some((k) => k.toLowerCase() === c.toLowerCase())) {
        cities.add(normalizeCity(c))
      }
    }
  }

  return [...cities]
}

export function mergeCities(calendarCities: string[], homeCities: string[]): string[] {
  const merged = new Set<string>()
  for (const c of [...homeCities, ...calendarCities]) {
    const n = normalizeCity(c)
    if (n) merged.add(n)
  }
  return [...merged].slice(0, 8)
}

export interface CityWindow {
  city: string
  from: string
  to: string
}

/** Rough visit windows from calendar events mentioning each city. */
export async function cityVisitWindows(
  supabase: SupabaseClient,
  userId: string,
  cities: string[],
): Promise<CityWindow[]> {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 120)

  const { data } = await supabase
    .from('calendar_events')
    .select('title, description, starts_at, ends_at')
    .eq('user_id', userId)
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())

  const windows: CityWindow[] = []

  for (const city of cities) {
    const hits = (data ?? []).filter((ev) => {
      const blob = `${ev.title ?? ''} ${ev.description ?? ''}`
      return new RegExp(`\\b${city}\\b`, 'i').test(blob)
    })
    if (!hits.length) {
      windows.push({
        city,
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      })
      continue
    }
    const dates = hits.map((h) => new Date(h.starts_at).getTime())
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    min.setDate(min.getDate() - 2)
    max.setDate(max.getDate() + 3)
    windows.push({
      city,
      from: min.toISOString().slice(0, 10),
      to: max.toISOString().slice(0, 10),
    })
  }

  return windows
}
