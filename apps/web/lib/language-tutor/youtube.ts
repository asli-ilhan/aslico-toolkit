import type { TutorLanguage } from './rotation'

/** Curated YouTube videos per curriculum unit (unknown ids fall back to search). */
export const YOUTUBE_PLAYLISTS: Record<string, string> = {
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
  const level = language === 'fr' ? 'A2' : 'beginner'
  const q = `${topic} ${language === 'ar' ? 'MSA' : language} ${level} lesson`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

export function youtubePlaylistForUnit(
  unitId: string,
  topic: string,
  language: TutorLanguage,
): string {
  return YOUTUBE_PLAYLISTS[unitId] ?? youtubeSearchUrl(topic, language)
}

/** @deprecated Prefer IMMERSION_POOL + activeImmersionPicks */
export { IMMERSION_POOL as IMMERSION_PICKS } from './immersion-pool'
