export type TutorLanguage = 'fr' | 'es' | 'ar'

export const DEFAULT_ROTATION: TutorLanguage[] = ['fr', 'es', 'ar']

const LANG_LABELS: Record<TutorLanguage, { en: string; tr: string }> = {
  fr: { en: 'French', tr: 'Fransızca' },
  es: { en: 'Spanish', tr: 'İspanyolca' },
  ar: { en: 'Arabic (MSA)', tr: 'Arapça (MSA)' },
}

export function languageLabel(lang: TutorLanguage, locale: string): string {
  return locale === 'tr' ? LANG_LABELS[lang].tr : LANG_LABELS[lang].en
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

/** Weekday 0=Sun…6=Sat for a YYYY-MM-DD civil date (timezone-safe). */
export function weekdayFromCalendarDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0)).getUTCDay()
}

/**
 * Mon=fr, Tue=es, Wed=ar, Thu=fr, Fri=es, Sat=ar, Sun=fr (unless sundayBreak).
 * Prefer this over `languageForDate(new Date())` on UTC servers.
 */
export function languageForCalendarDate(
  dateStr: string,
  rotation: TutorLanguage[] = DEFAULT_ROTATION,
  sundayBreak = false,
): { language: TutorLanguage | null; isRestDay: boolean } {
  const weekday = weekdayFromCalendarDate(dateStr)
  if (sundayBreak && weekday === 0) {
    return { language: null, isRestDay: true }
  }
  const learningDayIndex = weekday === 0 ? 0 : weekday - 1
  const lang = rotation[learningDayIndex % rotation.length] ?? rotation[0]!
  return { language: lang, isRestDay: false }
}

/** Uses the machine-local calendar day of `date` (prefer languageForCalendarDate + Istanbul date). */
export function languageForDate(
  date: Date,
  rotation: TutorLanguage[] = DEFAULT_ROTATION,
  sundayBreak = false,
): { language: TutorLanguage | null; isRestDay: boolean } {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return languageForCalendarDate(`${y}-${m}-${d}`, rotation, sundayBreak)
}

/** Count learning days since program start (skips Sundays only when sundayBreak). */
export function programDayIndex(
  startDate: string,
  today = new Date(),
  sundayBreak = false,
): number {
  const start = new Date(startDate + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(today)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    if (!(sundayBreak && isSunday(cur))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(1, count)
}

export function streakDays(
  completedDates: string[],
  sundayBreak = false,
): number {
  if (!completedDates.length) return 0
  const done = new Set(completedDates)
  let streak = 0
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  for (let i = 0; i < 120; i++) {
    const key = d.toISOString().slice(0, 10)
    if (sundayBreak && isSunday(d)) {
      d.setDate(d.getDate() - 1)
      continue
    }
    if (done.has(key)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
