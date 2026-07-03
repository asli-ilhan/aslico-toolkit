import type { SupabaseClient } from '@supabase/supabase-js'
import { generateCultureScout } from '@aslico/ai'
import {
  booksForTopics,
  DEFAULT_BOOK_TOPICS,
  DEFAULT_LANGUAGES,
  type BookCategory,
  type BookLanguage,
} from '@/lib/culture-tracker/books-canon'
import {
  cityVisitWindows,
  discoverCitiesFromCalendar,
  mergeCities,
} from '@/lib/culture-tracker/cities'
import { scoutCityEvents } from '@/lib/culture-tracker/events-scout'

export interface CultureSettings {
  homeCities: string[]
  interests: string[]
  bookTopics: BookCategory[]
  favoriteAuthors: string[]
  spotifyArtists: string[]
  languages: BookLanguage[]
}

const DEFAULT_HOME = ['London', 'Istanbul']

export async function fetchCultureSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<CultureSettings> {
  const { data } = await supabase
    .from('culture_tracker_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    homeCities: (data?.home_cities as string[] | undefined)?.length ?
        (data!.home_cities as string[])
      : DEFAULT_HOME,
    interests: (data?.interests as string[] | undefined) ?? [],
    bookTopics: ((data?.book_topics as string[] | undefined)?.length ?
        data!.book_topics
      : DEFAULT_BOOK_TOPICS) as BookCategory[],
    favoriteAuthors: (data?.favorite_authors as string[] | undefined) ?? [],
    spotifyArtists: (data?.spotify_artists as string[] | undefined) ?? [],
    languages: ((data?.languages as string[] | undefined)?.length ?
        data!.languages
      : DEFAULT_LANGUAGES) as BookLanguage[],
  }
}

export async function runCultureScout(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
) {
  const settings = await fetchCultureSettings(supabase, userId)
  const calendarCities = await discoverCitiesFromCalendar(supabase, userId)
  const cities = mergeCities(calendarCities, settings.homeCities)
  const windows = await cityVisitWindows(supabase, userId, cities)

  const citySections = await Promise.all(
    cities.map(async (city) => {
      const win = windows.find((w) => w.city === city)
      const events = await scoutCityEvents(city, {
        locale,
        spotifyArtists: settings.spotifyArtists,
        interests: settings.interests,
      })
      return {
        city,
        visitFrom: win?.from,
        visitTo: win?.to,
        events,
        highlights: events
          .filter((e) => e.kind === 'exhibition' || e.kind === 'concert' || e.kind === 'theater')
          .slice(0, 4)
          .map((e) => e.title),
      }
    }),
  )

  const canonBooks = booksForTopics(settings.bookTopics, settings.languages, 6)
  const issueDate = new Date().toISOString().slice(0, 10)

  const generated = await generateCultureScout({
    locale,
    date: issueDate,
    cities: citySections,
    canonBooks,
    interests: settings.interests,
    bookTopics: settings.bookTopics,
    spotifyArtists: settings.spotifyArtists,
  })

  return { generated, issueDate, cities }
}
