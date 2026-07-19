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
  { id: 'fr-02', order: 2, topic: 'Numbers, age & phone', grammarFocus: 'Numbers 0-100, quel âge', youtubeTopic: 'French numbers' },
  { id: 'fr-03', order: 3, topic: 'Present tense -er verbs', grammarFocus: 'Regular -er conjugation', youtubeTopic: 'French present tense er verbs' },
  { id: 'fr-04', order: 4, topic: 'Questions & negation', grammarFocus: 'Est-ce que, ne...pas', youtubeTopic: 'French questions negation' },
  { id: 'fr-05', order: 5, topic: 'Articles, gender & adjectives', grammarFocus: 'le/la/les, agreement', youtubeTopic: 'French articles gender' },
  { id: 'fr-06', order: 6, topic: 'Avoir & être deep dive', grammarFocus: 'Avoir vs être + expressions', youtubeTopic: 'French avoir etre' },
  { id: 'fr-07', order: 7, topic: 'Family & describing people', grammarFocus: 'Possessives mon/ma/mes', youtubeTopic: 'French family vocabulary' },
  { id: 'fr-08', order: 8, topic: 'Daily routine', grammarFocus: 'Reflexive verbs intro', youtubeTopic: 'French daily routine' },
  { id: 'fr-09', order: 9, topic: 'Time, days & schedules', grammarFocus: 'Il est... / à + time', youtubeTopic: 'French telling time' },
  { id: 'fr-10', order: 10, topic: 'Food & café ordering', grammarFocus: 'Partitive du/de la/des', youtubeTopic: 'French restaurant ordering' },
  { id: 'fr-11', order: 11, topic: 'Places in town', grammarFocus: 'Prepositions à/chez/dans', youtubeTopic: 'French places in town' },
  { id: 'fr-12', order: 12, topic: 'Directions & getting around', grammarFocus: 'Imperative + location phrases', youtubeTopic: 'French directions' },
  { id: 'fr-13', order: 13, topic: 'Past: passé composé (avoir)', grammarFocus: 'Passé composé with avoir', youtubeTopic: 'French passe compose' },
  { id: 'fr-14', order: 14, topic: 'Past with être & agreement', grammarFocus: 'Dr & Mrs Vandertramp', youtubeTopic: 'French passe compose etre' },
  { id: 'fr-15', order: 15, topic: 'Near future plans', grammarFocus: 'Aller + infinitive', youtubeTopic: 'French futur proche' },
  { id: 'fr-16', order: 16, topic: 'Shopping & preferences', grammarFocus: 'Je voudrais, combien', youtubeTopic: 'French shopping dialogue' },
]

const ES_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  { id: 'es-01', order: 1, topic: 'Saludos y presentaciones', grammarFocus: 'Ser vs llamarse', youtubeTopic: 'Spanish greetings beginner' },
  { id: 'es-02', order: 2, topic: 'Numbers, age & time basics', grammarFocus: 'Numbers, qué hora es', youtubeTopic: 'Spanish numbers time' },
  { id: 'es-03', order: 3, topic: 'Present -ar verbs', grammarFocus: 'Regular -ar conjugation', youtubeTopic: 'Spanish present ar verbs' },
  { id: 'es-04', order: 4, topic: 'Ser vs estar', grammarFocus: 'Ser vs estar basics', youtubeTopic: 'Spanish ser vs estar' },
  { id: 'es-05', order: 5, topic: 'Questions & negation', grammarFocus: 'Question words, no/nunca', youtubeTopic: 'Spanish questions' },
  { id: 'es-06', order: 6, topic: 'Gender, articles & adjectives', grammarFocus: 'el/la, adjective agreement', youtubeTopic: 'Spanish gender articles' },
  { id: 'es-07', order: 7, topic: 'Gustar & interests', grammarFocus: 'Me gusta + infinitive', youtubeTopic: 'Spanish gustar' },
  { id: 'es-08', order: 8, topic: 'Family & descriptions', grammarFocus: 'Possessives mi/mis', youtubeTopic: 'Spanish family vocabulary' },
  { id: 'es-09', order: 9, topic: 'Daily routine', grammarFocus: 'Reflexive verbs', youtubeTopic: 'Spanish reflexive verbs' },
  { id: 'es-10', order: 10, topic: 'Food & restaurant', grammarFocus: 'Querer, pedir, hay', youtubeTopic: 'Spanish restaurant' },
  { id: 'es-11', order: 11, topic: 'Places & prepositions', grammarFocus: 'en/a/de, hay vs está', youtubeTopic: 'Spanish prepositions places' },
  { id: 'es-12', order: 12, topic: 'Travel & directions', grammarFocus: 'Ir, derecha/izquierda', youtubeTopic: 'Spanish travel directions' },
  { id: 'es-13', order: 13, topic: 'Past: pretérito regular', grammarFocus: 'Regular preterite', youtubeTopic: 'Spanish preterite' },
  { id: 'es-14', order: 14, topic: 'Irregular pretérito essentials', grammarFocus: 'fui, hice, tuve', youtubeTopic: 'Spanish irregular preterite' },
  { id: 'es-15', order: 15, topic: 'Near future plans', grammarFocus: 'Ir a + infinitive', youtubeTopic: 'Spanish ir a infinitive' },
  { id: 'es-16', order: 16, topic: 'Shopping & opinions', grammarFocus: 'Me parece, cuesta', youtubeTopic: 'Spanish shopping conversation' },
]

const AR_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  { id: 'ar-01', order: 1, topic: 'Arabic alphabet & sounds', grammarFocus: 'Letters, short vowels', youtubeTopic: 'Arabic alphabet beginner' },
  { id: 'ar-02', order: 2, topic: 'Greetings & peace', grammarFocus: 'Marhaba, formal greetings', youtubeTopic: 'Arabic greetings MSA' },
  { id: 'ar-03', order: 3, topic: 'Numbers & counting', grammarFocus: 'Numbers 1-20', youtubeTopic: 'Arabic numbers MSA' },
  { id: 'ar-04', order: 4, topic: 'Personal pronouns', grammarFocus: 'Ana, anta, anti, huwa', youtubeTopic: 'Arabic pronouns' },
  { id: 'ar-05', order: 5, topic: 'Nominal sentences (to be)', grammarFocus: 'Nominal sentences', youtubeTopic: 'Arabic nominal sentences' },
  { id: 'ar-06', order: 6, topic: 'This & that', grammarFocus: 'Hadha, hadhihi', youtubeTopic: 'Arabic demonstratives' },
  { id: 'ar-07', order: 7, topic: 'Family & possession', grammarFocus: 'Idafa construct intro', youtubeTopic: 'Arabic family vocabulary' },
  { id: 'ar-08', order: 8, topic: 'Present tense verbs', grammarFocus: 'Form I present pattern', youtubeTopic: 'Arabic present tense MSA' },
  { id: 'ar-09', order: 9, topic: 'Questions', grammarFocus: 'Question particles', youtubeTopic: 'Arabic questions MSA' },
  { id: 'ar-10', order: 10, topic: 'Negation basics', grammarFocus: 'La / laysa intro', youtubeTopic: 'Arabic negation beginner' },
  { id: 'ar-11', order: 11, topic: 'Food & daily life', grammarFocus: 'Common verbs: eat, drink', youtubeTopic: 'Arabic food vocabulary' },
  { id: 'ar-12', order: 12, topic: 'Places & directions', grammarFocus: 'Where / prepositions', youtubeTopic: 'Arabic directions MSA' },
  { id: 'ar-13', order: 13, topic: 'Time & routines', grammarFocus: 'Days, now, today', youtubeTopic: 'Arabic time expressions' },
  { id: 'ar-14', order: 14, topic: 'Describing people & things', grammarFocus: 'Basic adjectives', youtubeTopic: 'Arabic adjectives MSA' },
  { id: 'ar-15', order: 15, topic: 'Past tense intro', grammarFocus: 'Perfect (past) Form I', youtubeTopic: 'Arabic past tense beginner' },
  { id: 'ar-16', order: 16, topic: 'Shopping & polite requests', grammarFocus: 'Please / want / how much', youtubeTopic: 'Arabic shopping phrases' },
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
  sundayBreak = false,
): number {
  const start = new Date(startDate + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(today)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    if (!(sundayBreak && cur.getDay() === 0)) {
      const weekday = cur.getDay()
      const learningDayIndex = weekday === 0 ? 0 : weekday - 1
      const lang = rotation[learningDayIndex % rotation.length]
      if (lang === language) count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(1, count)
}
