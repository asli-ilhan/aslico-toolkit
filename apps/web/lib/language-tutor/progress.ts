import { CURRICULUM, type CurriculumUnit } from './curriculum'
import type { TutorLanguage } from './rotation'

export interface GrammarProgressRow {
  topic_id: string
  mastery_score: number
  passed: boolean
}

export const QUIZ_PASS_THRESHOLD = 70

export function unitsForLanguage(language: TutorLanguage): CurriculumUnit[] {
  return CURRICULUM.filter((u) => u.language === language).sort((a, b) => a.order - b.order)
}

/**
 * Next unit from saved mastery — NOT from calendar.
 * Day N only unlocks after units 1…N-1 are passed.
 */
export function nextUnitFromProgress(
  language: TutorLanguage,
  grammarProgress: GrammarProgressRow[],
): { unit: CurriculumUnit; repeatUnit: boolean; languageDay: number; unitsPassed: number } {
  const units = unitsForLanguage(language)
  // Only current-track unit ids count (e.g. FR ignores legacy fr-01…fr-16; only fr-a2-* gates).
  const currentIds = new Set(units.map((u) => u.id))
  const relevant = grammarProgress.filter((g) => currentIds.has(g.topic_id))
  const passed = new Set(relevant.filter((g) => g.passed).map((g) => g.topic_id))
  const unitsPassed = units.filter((u) => passed.has(u.id)).length

  for (let i = 0; i < units.length; i++) {
    const u = units[i]!
    if (!passed.has(u.id)) {
      // Re-attempt if this unit was started but not yet passed.
      const attempted = relevant.some((g) => g.topic_id === u.id)
      return {
        unit: u,
        repeatUnit: attempted,
        languageDay: i + 1,
        unitsPassed,
      }
    }
  }

  // All units passed — stay on the last one for review.
  return {
    unit: units[units.length - 1]!,
    repeatUnit: false,
    languageDay: units.length,
    unitsPassed,
  }
}

/**
 * Block next unit until prior units are passed (coach mastery OR quiz ≥ threshold synced to progress).
 * @deprecated Prefer nextUnitFromProgress — kept for callers that still pass a day index.
 */
export function gatedUnitForLanguageDay(
  language: TutorLanguage,
  langDayIndex: number,
  grammarProgress: GrammarProgressRow[],
): { unit: CurriculumUnit; repeatUnit: boolean; targetDayIndex: number } {
  const fromProgress = nextUnitFromProgress(language, grammarProgress)
  // Never skip ahead of mastery just because the calendar day is higher.
  const units = unitsForLanguage(language)
  const currentIds = new Set(units.map((u) => u.id))
  const calendarIdx = Math.max(0, Math.min(units.length - 1, langDayIndex - 1))
  const progressIdx = fromProgress.languageDay - 1
  const useIdx = Math.min(calendarIdx, progressIdx)
  const unit = units[useIdx]!
  const passed = new Set(
    grammarProgress.filter((g) => g.passed && currentIds.has(g.topic_id)).map((g) => g.topic_id),
  )
  return {
    unit,
    repeatUnit: !passed.has(unit.id) && useIdx < calendarIdx,
    targetDayIndex: useIdx + 1,
  }
}

/** Program day = completed lessons + 1 (capped). Advances only when a lesson is marked done. */
export function programDayFromCompleted(completedCount: number, goalDays: number): number {
  return Math.min(goalDays, Math.max(1, completedCount + 1))
}

export function isGrammarGateOpen(
  unitId: string,
  grammarProgress: GrammarProgressRow[],
): boolean {
  const row = grammarProgress.find((g) => g.topic_id === unitId)
  return row?.passed ?? false
}

/** Quiz (or coach) score opens the unit gate when ≥ threshold. */
export function isUnitPassedByScore(score: number | null | undefined): boolean {
  return typeof score === 'number' && score >= QUIZ_PASS_THRESHOLD
}
