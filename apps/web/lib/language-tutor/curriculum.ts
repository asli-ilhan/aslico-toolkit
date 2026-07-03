import type { TutorLanguage } from './rotation'

export interface CurriculumUnit {
  id: string
  language: TutorLanguage
  order: number
  topic: string
  grammarFocus: string
  youtubeTopic: string
}

const FR_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  { id: 'fr-01', order: 1, topic: 'Greetings & introductions', grammarFocus: 'Tu vs vous, être', youtubeTopic: 'French greetings beginner' },
  { id: 'fr-02', order: 2, topic: 'Numbers & basics', grammarFocus: 'Numbers 0-100', youtubeTopic: 'French numbers' },
  { id: 'fr-03', order: 3, topic: 'Present tense -er verbs', grammarFocus: 'Regular -er verbs', youtubeTopic: 'French present tense er verbs' },
  { id: 'fr-04', order: 4, topic: 'Questions & negation', grammarFocus: 'Est-ce que, ne...pas', youtubeTopic: 'French questions negation' },
  { id: 'fr-05', order: 5, topic: 'Articles & gender', grammarFocus: 'le/la/les, un/une', youtubeTopic: 'French articles gender' },
  { id: 'fr-06', order: 6, topic: 'Avoir & être deep dive', grammarFocus: 'Avoir vs être', youtubeTopic: 'French avoir etre' },
  { id: 'fr-07', order: 7, topic: 'Daily routine', grammarFocus: 'Reflexive verbs intro', youtubeTopic: 'French daily routine' },
  { id: 'fr-08', order: 8, topic: 'Past: passé composé', grammarFocus: 'Passé composé with avoir', youtubeTopic: 'French passe compose' },
  { id: 'fr-09', order: 9, topic: 'Food & ordering', grammarFocus: 'Partitive articles', youtubeTopic: 'French restaurant ordering' },
  { id: 'fr-10', order: 10, topic: 'Directions & places', grammarFocus: 'Prepositions of place', youtubeTopic: 'French directions' },
]

const ES_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  { id: 'es-01', order: 1, topic: 'Saludos y presentaciones', grammarFocus: 'Ser vs llamarse', youtubeTopic: 'Spanish greetings beginner' },
  { id: 'es-02', order: 2, topic: 'Numbers & time', grammarFocus: 'Numbers, telling time', youtubeTopic: 'Spanish numbers time' },
  { id: 'es-03', order: 3, topic: 'Present -ar verbs', grammarFocus: 'Regular -ar conjugation', youtubeTopic: 'Spanish present ar verbs' },
  { id: 'es-04', order: 4, topic: 'Ser vs estar', grammarFocus: 'Ser vs estar basics', youtubeTopic: 'Spanish ser vs estar' },
  { id: 'es-05', order: 5, topic: 'Questions & negation', grammarFocus: 'Question words, no', youtubeTopic: 'Spanish questions' },
  { id: 'es-06', order: 6, topic: 'Gustar & interests', grammarFocus: 'Me gusta + infinitive', youtubeTopic: 'Spanish gustar' },
  { id: 'es-07', order: 7, topic: 'Daily routine', grammarFocus: 'Reflexive verbs', youtubeTopic: 'Spanish reflexive verbs' },
  { id: 'es-08', order: 8, topic: 'Past: pretérito', grammarFocus: 'Regular preterite', youtubeTopic: 'Spanish preterite' },
  { id: 'es-09', order: 9, topic: 'Food & restaurant', grammarFocus: 'Querer, pedir', youtubeTopic: 'Spanish restaurant' },
  { id: 'es-10', order: 10, topic: 'Travel & directions', grammarFocus: 'Ir, prepositions', youtubeTopic: 'Spanish travel directions' },
]

const AR_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  { id: 'ar-01', order: 1, topic: 'Arabic alphabet & sounds', grammarFocus: 'Letters, short vowels', youtubeTopic: 'Arabic alphabet beginner' },
  { id: 'ar-02', order: 2, topic: 'Greetings & peace', grammarFocus: 'Marhaba, formal greetings', youtubeTopic: 'Arabic greetings MSA' },
  { id: 'ar-03', order: 3, topic: 'Numbers & counting', grammarFocus: 'Numbers 1-20', youtubeTopic: 'Arabic numbers MSA' },
  { id: 'ar-04', order: 4, topic: 'Personal pronouns', grammarFocus: 'Ana, anta, anti, huwa', youtubeTopic: 'Arabic pronouns' },
  { id: 'ar-05', order: 5, topic: 'To be sentences', grammarFocus: 'Nominal sentences', youtubeTopic: 'Arabic nominal sentences' },
  { id: 'ar-06', order: 6, topic: 'This & that', grammarFocus: 'Hadha, hadhihi', youtubeTopic: 'Arabic demonstratives' },
  { id: 'ar-07', order: 7, topic: 'Present tense verbs', grammarFocus: 'Form I present pattern', youtubeTopic: 'Arabic present tense MSA' },
  { id: 'ar-08', order: 8, topic: 'Questions', grammarFocus: 'Question particles', youtubeTopic: 'Arabic questions MSA' },
  { id: 'ar-09', order: 9, topic: 'Family & descriptions', grammarFocus: 'Idafa construct', youtubeTopic: 'Arabic family vocabulary' },
  { id: 'ar-10', order: 10, topic: 'Food & daily life', grammarFocus: 'Common verbs: eat, drink', youtubeTopic: 'Arabic food vocabulary' },
]

function withLang(units: Omit<CurriculumUnit, 'language'>[], language: TutorLanguage): CurriculumUnit[] {
  return units.map((u) => ({ ...u, language }))
}

export const CURRICULUM: CurriculumUnit[] = [
  ...withLang(FR_UNITS, 'fr'),
  ...withLang(ES_UNITS, 'es'),
  ...withLang(AR_UNITS, 'ar'),
]

export function unitForLanguageDay(language: TutorLanguage, langDayIndex: number): CurriculumUnit {
  const units = CURRICULUM.filter((u) => u.language === language).sort((a, b) => a.order - b.order)
  const idx = (langDayIndex - 1) % units.length
  return units[idx]!
}

/** How many learning days of this language have passed since start. */
export function languageDayIndex(
  startDate: string,
  language: TutorLanguage,
  today = new Date(),
  rotation: TutorLanguage[] = ['fr', 'es', 'ar'],
): number {
  const start = new Date(startDate + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(today)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      const weekday = cur.getDay()
      const learningDayIndex = weekday === 0 ? 0 : weekday - 1
      const lang = rotation[learningDayIndex % rotation.length]
      if (lang === language) count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(1, count)
}
