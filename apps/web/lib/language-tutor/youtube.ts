import type { TutorLanguage } from './rotation'

/** Curated beginner YouTube videos per curriculum unit (new units fall back to search). */
export const YOUTUBE_PLAYLISTS: Record<string, string> = {
  'fr-01': 'https://www.youtube.com/watch?v=Cb0pzP-PJzQ',
  'fr-02': 'https://www.youtube.com/watch?v=lj2e4vL_QZM',
  'fr-03': 'https://www.youtube.com/watch?v=3I2ab0t4KLo',
  'fr-04': 'https://www.youtube.com/watch?v=0druh1M5Pdc',
  'fr-05': 'https://www.youtube.com/watch?v=8y2Hj7b8q0Y',
  'fr-06': 'https://www.youtube.com/watch?v=8y2Hj7b8q0Y',
  'fr-07': 'https://www.youtube.com/watch?v=ZxXruY7llcc',
  'fr-08': 'https://www.youtube.com/watch?v=ZxXruY7llcc',
  'fr-09': 'https://www.youtube.com/watch?v=lj2e4vL_QZM',
  'fr-10': 'https://www.youtube.com/watch?v=Cb0pzP-PJzQ',
  'fr-11': 'https://www.youtube.com/watch?v=0druh1M5Pdc',
  'fr-12': 'https://www.youtube.com/watch?v=0druh1M5Pdc',
  'fr-13': 'https://www.youtube.com/watch?v=ZxXruY7llcc',
  'fr-14': 'https://www.youtube.com/watch?v=ZxXruY7llcc',
  'fr-15': 'https://www.youtube.com/watch?v=3I2ab0t4KLo',
  'fr-16': 'https://www.youtube.com/watch?v=Cb0pzP-PJzQ',
  'es-01': 'https://www.youtube.com/watch?v=1J8rqlz-KnE',
  'es-02': 'https://www.youtube.com/watch?v=h1cVv1n0jKc',
  'es-03': 'https://www.youtube.com/watch?v=ni0Xl-Xo6K0',
  'es-04': 'https://www.youtube.com/watch?v=gs6RlqVKbm0',
  'es-05': 'https://www.youtube.com/watch?v=1J8rqlz-KnE',
  'es-06': 'https://www.youtube.com/watch?v=gs6RlqVKbm0',
  'es-07': 'https://www.youtube.com/watch?v=ni0Xl-Xo6K0',
  'es-08': 'https://www.youtube.com/watch?v=h1cVv1n0jKc',
  'es-09': 'https://www.youtube.com/watch?v=1J8rqlz-KnE',
  'es-10': 'https://www.youtube.com/watch?v=ni0Xl-Xo6K0',
  'es-11': 'https://www.youtube.com/watch?v=gs6RlqVKbm0',
  'es-12': 'https://www.youtube.com/watch?v=ni0Xl-Xo6K0',
  'es-13': 'https://www.youtube.com/watch?v=h1cVv1n0jKc',
  'es-14': 'https://www.youtube.com/watch?v=h1cVv1n0jKc',
  'es-15': 'https://www.youtube.com/watch?v=1J8rqlz-KnE',
  'es-16': 'https://www.youtube.com/watch?v=gs6RlqVKbm0',
  'ar-01': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-02': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-03': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-04': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-05': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-06': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-07': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-08': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-09': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-10': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-11': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-12': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-13': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-14': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-15': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
  'ar-16': 'https://www.youtube.com/watch?v=bo6Y2sNs7j0',
}

export function youtubeSearchUrl(topic: string, language: TutorLanguage): string {
  const q = `${topic} ${language === 'ar' ? 'MSA' : language} beginner lesson`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

export function youtubePlaylistForUnit(
  unitId: string,
  topic: string,
  language: TutorLanguage,
): string {
  return YOUTUBE_PLAYLISTS[unitId] ?? youtubeSearchUrl(topic, language)
}

export const IMMERSION_PICKS: Record<TutorLanguage, { films: string[]; books: string[] }> = {
  fr: {
    films: ['Le Fabuleux Destin d\'Amélie Poulain', 'Les Intouchables', 'Persepolis'],
    books: ['Le Petit Prince', 'L\'Étranger', 'Bonjour Tristesse'],
  },
  es: {
    films: ['Volver', 'El laberinto del fauno', 'Coco'],
    books: ['El Principito', 'Cien años de soledad (simplified)', 'La sombra del viento'],
  },
  ar: {
    films: ['Caramel (Sukkar banat)', 'Theeb', 'Wadjda'],
    books: ['Kalila wa Dimna (stories)', 'Arabic graded readers A1', 'Alf Layla wa Layla (adapted)'],
  },
}
