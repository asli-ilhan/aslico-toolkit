/** Default calendar zone for the tutor (founder is TR-based). */
export const TUTOR_TIMEZONE = 'Europe/Istanbul'

/** YYYY-MM-DD in a given IANA timezone (avoids UTC day-rollover bugs). */
export function calendarDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = TUTOR_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Prefer an explicit client/local YYYY-MM-DD; else Istanbul calendar day. */
export function resolveLessonDate(candidate?: string | null): string {
  const raw = String(candidate ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return calendarDateInTimeZone()
}
