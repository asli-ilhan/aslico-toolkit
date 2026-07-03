import { createClaudeMessage } from './claude'

export interface CultureEventPick {
  title: string
  url: string
  source: string
  snippet?: string
  kind: string
}

export interface CityCultureSection {
  city: string
  visitFrom?: string
  visitTo?: string
  events: CultureEventPick[]
  highlights: string[]
}

export interface BookPick {
  title: string
  author: string
  language: string
  category: string
  why: string
  priority: 'must' | 'recommended'
}

export interface CanonBookInput {
  title: string
  author: string
  language: string
  category: string
  why: string
}

export interface CultureScoutInput {
  locale: string
  date: string
  cities: CityCultureSection[]
  canonBooks: CanonBookInput[]
  interests: string[]
  bookTopics: string[]
  spotifyArtists: string[]
}

export interface CultureScoutSections {
  greeting: string
  cities: CityCultureSection[]
  mustReadBooks: BookPick[]
  spotifyNote: string
  closing: string
}

export async function generateCultureScout(input: CultureScoutInput): Promise<{
  title: string
  contentMd: string
  sections: CultureScoutSections
}> {
  const lang =
    input.locale === 'tr' ? 'Turkish'
    : input.locale === 'fr' ? 'French'
    : input.locale === 'es' ? 'Spanish'
    : input.locale === 'ar' ? 'Arabic'
    : 'English'

  let mustReadBooks: BookPick[] = input.canonBooks.slice(0, 24).map((b) => ({
    title: b.title,
    author: b.author,
    language: b.language,
    category: b.category,
    why: b.why,
    priority: 'must' as const,
  }))

  let greeting = defaultGreeting(input.locale, input.date)
  let closing = defaultClosing(input.locale)
  let spotifyNote = defaultSpotifyNote(input.locale, input.spotifyArtists)

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await createClaudeMessage({
        system: `You are a culture scout for a maritime AI/ML researcher who loves books, exhibitions, concerts, and theater. Language: ${lang}. Return JSON only:
{"greeting":"...","closing":"...","spotifyNote":"...","extraBooks":[{"title":"","author":"","language":"en|tr|fr|es|ar","category":"business|psychology|development|maritime|philosophy|fiction","why":"","priority":"must|recommended"}]}
Pick up to 8 extra must-read books tailored to interests (business, psychology, self-development, maritime, research). Multilingual: TR, EN, FR, ES, AR. No fashion focus.`,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              date: input.date,
              cities: input.cities.map((c) => c.city),
              interests: input.interests,
              bookTopics: input.bookTopics,
              spotifyArtists: input.spotifyArtists,
              canonSample: input.canonBooks.slice(0, 12).map((b) => `${b.title} (${b.language})`),
            }),
          },
        ],
        maxTokens: 1200,
        temperature: 0.5,
      })
      const parsed = JSON.parse(extractJson(raw)) as {
        greeting?: string
        closing?: string
        spotifyNote?: string
        extraBooks?: BookPick[]
      }
      if (parsed.greeting) greeting = parsed.greeting
      if (parsed.closing) closing = parsed.closing
      if (parsed.spotifyNote) spotifyNote = parsed.spotifyNote
      if (parsed.extraBooks?.length) {
        const extra = parsed.extraBooks.filter((b) => b.title && b.author)
        const seen = new Set(mustReadBooks.map((b) => b.title.toLowerCase()))
        for (const b of extra) {
          if (!seen.has(b.title.toLowerCase())) {
            mustReadBooks.push({ ...b, priority: b.priority ?? 'recommended' })
            seen.add(b.title.toLowerCase())
          }
        }
      }
    } catch {
      // keep defaults
    }
  }

  for (const city of input.cities) {
    if (!city.highlights.length && city.events.length) {
      city.highlights = city.events.slice(0, 3).map((e) => e.title)
    }
  }

  const sections: CultureScoutSections = {
    greeting,
    cities: input.cities,
    mustReadBooks: mustReadBooks.slice(0, 32),
    spotifyNote,
    closing,
  }

  const contentMd = buildMarkdown(sections, input.locale)
  const title =
    input.locale === 'tr' ? `Kültür keşfi · ${input.date}`
    : `Culture scout · ${input.date}`

  return { title, contentMd, sections }
}

function buildMarkdown(sections: CultureScoutSections, locale: string): string {
  const L =
    locale === 'tr' ?
      {
        cities: 'Şehirlerde yapılacaklar',
        books: 'Okunmalı kitaplar',
        spotify: 'Müzik & konser',
        must: 'Kesin okunmalı',
        rec: 'Önerilen',
      }
    : {
        cities: 'City picks',
        books: 'Must-read books',
        spotify: 'Music & concerts',
        must: 'Must read',
        rec: 'Recommended',
      }

  const lines = [sections.greeting, '']

  lines.push(`## ${L.cities}`)
  for (const c of sections.cities) {
    const window =
      c.visitFrom && c.visitTo ? ` (${c.visitFrom} → ${c.visitTo})` : ''
    lines.push(`### ${c.city}${window}`)
    if (c.highlights.length) {
      for (const h of c.highlights) lines.push(`- ${h}`)
    }
    for (const e of c.events.slice(0, 6)) {
      lines.push(`- [${e.title}](${e.url}) — *${e.kind}* · ${e.source}`)
    }
    lines.push('')
  }

  lines.push(`## ${L.books}`)
  const must = sections.mustReadBooks.filter((b) => b.priority === 'must')
  const rec = sections.mustReadBooks.filter((b) => b.priority !== 'must')
  if (must.length) {
    lines.push(`### ${L.must}`)
    for (const b of must) {
      lines.push(`- **${b.title}** — ${b.author} (${b.language}, ${b.category}): ${b.why}`)
    }
  }
  if (rec.length) {
    lines.push(`### ${L.rec}`)
    for (const b of rec) {
      lines.push(`- ${b.title} — ${b.author} (${b.language}): ${b.why}`)
    }
  }

  lines.push('', `## ${L.spotify}`, sections.spotifyNote, '', sections.closing)
  return lines.join('\n')
}

function defaultGreeting(locale: string, date: string): string {
  if (locale === 'tr') return `${date} için kültür ve okuma keşfin hazır.`
  return `Your culture & reading scout for ${date} is ready.`
}

function defaultClosing(locale: string): string {
  if (locale === 'tr') return 'Zamanla sevdiğin sanatçıları ve yazarları ekle — scout daha kişisel olur.'
  return 'Add favourite artists and authors over time — the scout gets more personal.'
}

function defaultSpotifyNote(locale: string, artists: string[]): string {
  if (!artists.length) {
    return locale === 'tr' ?
        'Spotify sanatçılarını ayarlara ekle — şehir konser eşleşmesi için kullanılır.'
      : 'Add Spotify artists in settings for concert matching in your cities.'
  }
  return locale === 'tr' ?
      `Konser araması: ${artists.join(', ')}`
    : `Concert search tuned for: ${artists.join(', ')}`
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1]!.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}
