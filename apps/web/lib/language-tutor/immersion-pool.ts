import type { TutorLanguage } from './rotation'

/** Larger pools — active list filters out completed titles. */
export const IMMERSION_POOL: Record<TutorLanguage, { films: string[]; books: string[] }> = {
  fr: {
    films: [
      'Les Intouchables',
      "Le Fabuleux Destin d'Amélie Poulain",
      'Petit Nicolas',
      'Le Petit Prince (film)',
      'Kirikou et la sorcière',
      'Astérix et Obélix : Mission Cléopâtre',
      'La Famille Bélier',
      'OSS 117 : Le Caire, nid d’espions',
      'Les Choristes',
      'Bienvenue chez les Ch’tis',
    ],
    books: [
      'Le Petit Nicolas',
      'Short Stories in French (A2)',
      "L'Étranger (graded / with notes)",
      'Le Petit Prince',
      'Easy French Reader',
      'Grammaire Progressive du Français (A2 exercises)',
      'Café Crème / Alter Ego A2 dialogues',
      'Contes de Perrault (adapted)',
    ],
  },
  es: {
    films: [
      'Volver',
      'El laberinto del fauno',
      'Coco',
      'El secreto de sus ojos',
      'Diarios de motocicleta',
      'Roma',
      'También la lluvia',
    ],
    books: [
      'El Principito',
      'Cien años de soledad (simplified)',
      'La sombra del viento',
      'Short Stories in Spanish (A2)',
      'Easy Spanish Reader',
    ],
  },
  ar: {
    films: [
      'Caramel (Sukkar banat)',
      'Theeb',
      'Wadjda',
      'Capernaum',
      'The Square (Al Midan)',
    ],
    books: [
      'Kalila wa Dimna (stories)',
      'Arabic graded readers A1',
      'Alf Layla wa Layla (adapted)',
      'Arabic Stories for Language Learners',
      'Madinah Arabic graded texts',
    ],
  },
}

export type ImmersionDoneMap = Partial<
  Record<TutorLanguage, { films?: string[]; books?: string[] }>
>

export function activeImmersionPicks(
  language: TutorLanguage,
  done: ImmersionDoneMap | null | undefined,
  limit = 3,
): { films: string[]; books: string[]; doneFilms: string[]; doneBooks: string[] } {
  const pool = IMMERSION_POOL[language]
  const doneFilms = new Set(done?.[language]?.films ?? [])
  const doneBooks = new Set(done?.[language]?.books ?? [])
  const films = pool.films.filter((t) => !doneFilms.has(t)).slice(0, limit)
  const books = pool.books.filter((t) => !doneBooks.has(t)).slice(0, limit)
  return {
    films,
    books,
    doneFilms: [...doneFilms],
    doneBooks: [...doneBooks],
  }
}
