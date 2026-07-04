/** Extract YYYY-MM-DD from funding opportunity text (title + description). */
export function parseDeadlineFromText(text: string): string | null {
  const hay = text.replace(/\s+/g, ' ').trim()
  if (!hay) return null
  if (/\b(rolling|open\s+until\s+filled|ongoing|no\s+deadline)\b/i.test(hay)) return null

  const labeled =
    hay.match(
      /\b(?:deadline|closing\s+date|apply\s+by|application\s+deadline|due\s+date|closes\s+on|submit\s+by)[:\s]+([^.;\n]{4,40})/i,
    )?.[1] ?? hay

  const iso = labeled.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return normalizeDate(+iso[1], +iso[2], +iso[3])

  const dmy = labeled.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  if (dmy) return normalizeDate(+dmy[3], +dmy[2], +dmy[1])

  const monthNames =
    '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
  const named = labeled.match(new RegExp(`\\b(\\d{1,2})\\s+${monthNames}\\s+(20\\d{2})\\b`, 'i'))
  if (named) return normalizeDate(+named[3], monthToNumber(named[2]), +named[1])

  const namedRev = labeled.match(new RegExp(`\\b${monthNames}\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'i'))
  if (namedRev) return normalizeDate(+namedRev[3], monthToNumber(namedRev[1]), +namedRev[2])

  return null
}

function monthToNumber(token: string): number {
  const m = token.slice(0, 3).toLowerCase()
  const map: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }
  return map[m] ?? 1
}

function normalizeDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  if (d < today) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function deadlineToCalendarIso(deadline: string): string {
  return `${deadline}T09:00:00.000Z`
}
