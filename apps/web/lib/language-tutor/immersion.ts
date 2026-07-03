import type { SupabaseClient } from '@supabase/supabase-js'
import { IMMERSION_PICKS, youtubePlaylistForUnit } from './youtube'
import type { TutorLanguage } from './rotation'
import type { CurriculumUnit } from './curriculum'

export async function fetchImmersionBundle(
  supabase: SupabaseClient,
  userId: string,
  language: TutorLanguage,
  unit?: CurriculumUnit | null,
) {
  const picks = IMMERSION_PICKS[language]
  const youtubeUrl = unit ? youtubePlaylistForUnit(unit.id, unit.youtubeTopic, language) : null

  let cultureBooks: Array<{ title: string; author: string | null; status: string }> = []
  try {
    const { data } = await supabase
      .from('culture_tracker_books')
      .select('title, author, status')
      .eq('user_id', userId)
      .eq('language', language)
      .in('status', ['want_to_read', 'reading'])
      .limit(8)
    cultureBooks = (data ?? []) as typeof cultureBooks
  } catch {
    // culture tracker optional
  }

  return {
    films: picks.films,
    books: picks.books,
    cultureBooks,
    youtubeUrl,
    why: 'A1–A2 beginner immersion — subtitles on, repeat scenes, read aloud.',
    cefr: 'A1–A2',
  }
}
