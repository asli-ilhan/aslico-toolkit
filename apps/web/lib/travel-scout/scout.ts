import type { SupabaseClient } from '@supabase/supabase-js'
import { generateTravelScout } from '@aslico/ai'
import { discoverCitiesFromCalendar } from '@/lib/culture-tracker/cities'
import {
  DEFAULT_VIBES,
  nearbyRegions,
  pickRandomDestination,
  type TravelVibe,
} from '@/lib/travel-scout/destinations'
import { discoverTravelPicks } from '@/lib/travel-scout/discover'

export interface TravelScoutSettings {
  preferredVibes: TravelVibe[]
  interests: string[]
  avoidMassTourism: boolean
}

export async function fetchTravelSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<TravelScoutSettings> {
  const { data } = await supabase
    .from('travel_scout_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    preferredVibes: ((data?.preferred_vibes as string[] | undefined)?.length ?
        data!.preferred_vibes
      : DEFAULT_VIBES) as TravelVibe[],
    interests: (data?.interests as string[] | undefined) ?? [],
    avoidMassTourism: data?.avoid_mass_tourism ?? true,
  }
}

export interface RunTravelScoutOpts {
  mode: 'trip' | 'random'
  destination?: string
  startDate?: string
  endDate?: string
  locale: string
}

export async function runTravelScout(
  supabase: SupabaseClient,
  userId: string,
  opts: RunTravelScoutOpts,
) {
  const settings = await fetchTravelSettings(supabase, userId)
  let destination = opts.destination?.trim()
  let region: string | undefined
  let country: string | undefined
  let randomWhy: string | undefined
  let mode = opts.mode

  if (mode === 'random' || !destination) {
    const picked = pickRandomDestination(settings.preferredVibes)
    destination = `${picked.name}, ${picked.country}`
    region = picked.region
    country = picked.country
    randomWhy = picked.why
    mode = 'random'
    if (!opts.startDate) {
      const start = new Date()
      start.setDate(start.getDate() + 21)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      opts.startDate = start.toISOString().slice(0, 10)
      opts.endDate = end.toISOString().slice(0, 10)
    }
  }

  if (!destination) {
    const calendarCities = await discoverCitiesFromCalendar(supabase, userId, 90)
    destination = calendarCities[0] ?? 'London'
  }

  const nearby = nearbyRegions(destination.split(',')[0]!.trim())
  const picks = await discoverTravelPicks({
    destination,
    nearby,
    vibes: settings.preferredVibes,
    locale: opts.locale,
    interests: settings.interests,
    avoidMassTourism: settings.avoidMassTourism,
  })

  const generated = await generateTravelScout({
    locale: opts.locale,
    destination,
    region,
    country,
    startDate: opts.startDate,
    endDate: opts.endDate,
    mode,
    vibes: settings.preferredVibes,
    picks,
    nearbyRegions: nearby,
    randomWhy,
  })

  const reportKey = `${mode}:${destination.toLowerCase().replace(/\s+/g, '-')}:${opts.startDate ?? 'open'}`

  return { generated, destination, reportKey, mode, startDate: opts.startDate, endDate: opts.endDate }
}
