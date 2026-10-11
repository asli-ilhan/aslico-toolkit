import type { SupabaseClient } from '@supabase/supabase-js'
import { youtubePlaylistForUnit } from './youtube'
import { activeImmersionPicks, type ImmersionDoneMap } from './immersion-pool'
import type { TutorLanguage } from './rotation'
import type { CurriculumUnit } from './curriculum'

export async function fetchImmersionDone(
  supabase: SupabaseClient,
  userId: string,
): Promise<ImmersionDoneMap> {
  try {
    const { data } = await supabase
      .from('language_tutor_settings')
      .select('immersion_done')
      .eq('user_id', userId)
      .maybeSingle()
    const raw = data?.immersion_done
    if (raw && typeof raw === 'object') return raw as ImmersionDoneMap
  } catch {
    // column may not exist yet
  }
  return {}
}

export async function saveImmersionDone(
  supabase: SupabaseClient,
  userId: string,
  done: ImmersionDoneMap,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('language_tutor_settings').upsert(
      {
        user_id: userId,
        immersion_done: done,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save failed' }
  }
}

export async function fetchImmersionBundle(
  supabase: SupabaseClient,
  userId: string,
  language: TutorLanguage,
  unit?: CurriculumUnit | null,
) {
  const done = await fetchImmersionDone(supabase, userId)
  const picks = activeImmersionPicks(language, done, 3)
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

  const isFrA2 = language === 'fr'
  return {
    films: picks.films,
    books: picks.books,
    doneFilms: picks.doneFilms,
    doneBooks: picks.doneBooks,
    cultureBooks,
    youtubeUrl,
    why: isFrA2
      ? 'A2 immersion — FR subtitles first, then off scene-by-scene; shadow short dialogues; note connectors.'
      : 'A1–A2 beginner immersion — subtitles on, repeat scenes, read aloud.',
    cefr: isFrA2 ? 'A2' : 'A1–A2',
  }
}
