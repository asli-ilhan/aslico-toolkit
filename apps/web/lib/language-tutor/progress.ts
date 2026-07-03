import { CURRICULUM, type CurriculumUnit } from './curriculum'
import type { TutorLanguage } from './rotation'

export interface GrammarProgressRow {
  topic_id: string
  mastery_score: number
  passed: boolean
}

export function unitsForLanguage(language: TutorLanguage): CurriculumUnit[] {
  return CURRICULUM.filter((u) => u.language === language).sort((a, b) => a.order - b.order)
}

/** Block next unit until all prior units have grammar mastery >= 80%. */
export function gatedUnitForLanguageDay(
  language: TutorLanguage,
  langDayIndex: number,
  grammarProgress: GrammarProgressRow[],
): { unit: CurriculumUnit; repeatUnit: boolean; targetDayIndex: number } {
  const units = unitsForLanguage(language)
  const targetIdx = (langDayIndex - 1) % units.length
  const passed = new Set(grammarProgress.filter((g) => g.passed).map((g) => g.topic_id))

  for (let i = 0; i < targetIdx; i++) {
    const u = units[i]!
    if (!passed.has(u.id)) {
      return { unit: u, repeatUnit: true, targetDayIndex: langDayIndex }
    }
  }

  return { unit: units[targetIdx]!, repeatUnit: false, targetDayIndex: langDayIndex }
}

export function isGrammarGateOpen(
  unitId: string,
  grammarProgress: GrammarProgressRow[],
): boolean {
  const row = grammarProgress.find((g) => g.topic_id === unitId)
  return row?.passed ?? false
}
