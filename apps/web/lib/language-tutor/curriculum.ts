import type { TutorLanguage } from './rotation'

export interface CurriculumUnit {
  id: string
  language: TutorLanguage
  order: number
  topic: string
  grammarFocus: string
  youtubeTopic: string
}

/** French A2 crash course (30 days): A2 start → solid A2+ / early B1. Dense, not longer. */
const FR_UNITS: Omit<CurriculumUnit, 'language'>[] = [
  // 1–5 Foundation compression
  { id: 'fr-a2-01', order: 1, topic: 'Present irregulars & daily narration', grammarFocus: 'aller/faire/venir/prendre + frequency adverbs', youtubeTopic: 'French irregular present verbs A2' },
  { id: 'fr-a2-02', order: 2, topic: 'Articles, partitives & quantity', grammarFocus: 'du/de la/des vs le/la; beaucoup de / un peu de', youtubeTopic: 'French partitive articles A2' },
  { id: 'fr-a2-03', order: 3, topic: 'Questions that sound natural', grammarFocus: 'inversion, est-ce que, intonation; question words', youtubeTopic: 'French question forms A2' },
  { id: 'fr-a2-04', order: 4, topic: 'Negation beyond ne…pas', grammarFocus: 'ne…jamais/plus/rien/personne; person vs thing', youtubeTopic: 'French negation A2' },
  { id: 'fr-a2-05', order: 5, topic: 'Adjectives & agreement in real speech', grammarFocus: 'position before/after noun; irregular adjectives', youtubeTopic: 'French adjective agreement position A2' },
  // 6–10 Past
  { id: 'fr-a2-06', order: 6, topic: 'Passé composé with avoir (core)', grammarFocus: 'PC formation + common irregular PP', youtubeTopic: 'French passe compose avoir A2' },
  { id: 'fr-a2-07', order: 7, topic: 'Passé composé with être & agreement', grammarFocus: 'DR MRS VANDERTRAMP + agreement with subject', youtubeTopic: 'French passe compose etre A2' },
  { id: 'fr-a2-08', order: 8, topic: 'Imparfait for description & habit', grammarFocus: 'imparfait forms + used-to / was-ing', youtubeTopic: 'French imparfait A2' },
  { id: 'fr-a2-09', order: 9, topic: 'PC vs imparfait in storytelling', grammarFocus: 'background vs event; time markers', youtubeTopic: 'French passe compose vs imparfait' },
  { id: 'fr-a2-10', order: 10, topic: 'Time since / ago / for', grammarFocus: 'depuis, il y a, pendant, ça fait…que', youtubeTopic: 'French depuis il y a pendant' },
  // 11–15 Future + modal
  { id: 'fr-a2-11', order: 11, topic: 'Near future & plans', grammarFocus: 'aller + infinitive; venir de', youtubeTopic: 'French futur proche venir de' },
  { id: 'fr-a2-12', order: 12, topic: 'Futur simple essentials', grammarFocus: 'regular + key irregulars (être, avoir, aller, faire)', youtubeTopic: 'French futur simple A2' },
  { id: 'fr-a2-13', order: 13, topic: 'Conditionnel for politeness & wishes', grammarFocus: 'je voudrais / aimerais; soft requests', youtubeTopic: 'French conditionnel present A2' },
  { id: 'fr-a2-14', order: 14, topic: 'Modal verbs in real life', grammarFocus: 'devoir / pouvoir / vouloir / falloir nuances', youtubeTopic: 'French devoir pouvoir vouloir' },
  { id: 'fr-a2-15', order: 15, topic: 'Hypotheses with si (A2)', grammarFocus: 'si + présent → futur; si + imparfait → conditionnel', youtubeTopic: 'French si clauses A2' },
  // 16–20 Sentence expansion
  { id: 'fr-a2-16', order: 16, topic: 'Relative clauses: qui / que / où', grammarFocus: 'qui vs que; où for place/time', youtubeTopic: 'French relative pronouns qui que ou' },
  { id: 'fr-a2-17', order: 17, topic: 'Relative dont & ce qui / ce que', grammarFocus: 'dont basics; ce qui / ce que', youtubeTopic: 'French dont ce qui ce que' },
  { id: 'fr-a2-18', order: 18, topic: 'Object pronouns COD / COI', grammarFocus: 'le/la/les, lui/leur; placement before verb', youtubeTopic: 'French object pronouns COD COI' },
  { id: 'fr-a2-19', order: 19, topic: 'Pronouns y and en', grammarFocus: 'y for places/à; en for de / quantities', youtubeTopic: 'French pronouns y en A2' },
  { id: 'fr-a2-20', order: 20, topic: 'Comparisons & superlatives', grammarFocus: 'plus/moins/aussi…que; le plus / le moins', youtubeTopic: 'French comparative superlative' },
  // 21–25 Opinion / assumption
  { id: 'fr-a2-21', order: 21, topic: 'Subjonctif triggers (core set)', grammarFocus: 'il faut que, vouloir que, avant que (intro)', youtubeTopic: 'French subjonctif present basics' },
  { id: 'fr-a2-22', order: 22, topic: 'Opinion, emotion & doubt', grammarFocus: 'je suis content que / je doute que + subjonctif vs indicatif', youtubeTopic: 'French subjonctif opinion emotion' },
  { id: 'fr-a2-23', order: 23, topic: 'Reported speech (simple)', grammarFocus: 'il a dit que + tense shift intro', youtubeTopic: 'French discours rapporte A2' },
  { id: 'fr-a2-24', order: 24, topic: 'Linking ideas smoothly', grammarFocus: 'parce que, puisque, donc, pourtant, cependant', youtubeTopic: 'French connectors A2' },
  { id: 'fr-a2-25', order: 25, topic: 'Passive & on (spoken French)', grammarFocus: 'on = we/people; être + PP passive intro', youtubeTopic: 'French on passive voice A2' },
  // 26–30 Usage & integration
  { id: 'fr-a2-26', order: 26, topic: 'Formal vs informal register', grammarFocus: 'tu/vous; email vs chat; softener phrases', youtubeTopic: 'French formal informal register' },
  { id: 'fr-a2-27', order: 27, topic: 'Argue a simple point', grammarFocus: 'je pense que / à mon avis / d’un côté…', youtubeTopic: 'French giving opinions A2' },
  { id: 'fr-a2-28', order: 28, topic: 'Work & bureaucracy dialogues', grammarFocus: 'rendez-vous, documents, polite requests', youtubeTopic: 'French office appointments vocabulary' },
  { id: 'fr-a2-29', order: 29, topic: 'Travel problems & solutions', grammarFocus: 'complaints, delays, asking for help', youtubeTopic: 'French travel problems dialogue' },
  { id: 'fr-a2-30', order: 30, topic: 'Media reading & error clinic', grammarFocus: 'integrate PC/imparfait/relatifs/pronouns; self-correction', youtubeTopic: 'French A2 reading comprehension news' },
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
