import { createClaudeMessage } from './claude'

export interface NewsHeadline {
  title: string
  url: string
  source: string
  snippet?: string
  publishedAt?: string
  topic?: string
}

export interface NewsTopicSection {
  topicId: string
  topicLabel: string
  headlines: NewsHeadline[]
}

export interface NewsletterDayEvent {
  title: string
  at: string
  allDay?: boolean
  account?: string | null
}

export interface NewsletterDayTodo {
  title: string
  done: boolean
}

export interface NewsletterInput {
  locale: string
  interests: string[]
  date: string
  headlines: NewsHeadline[]
  topicSections?: NewsTopicSection[]
  todayEvents: NewsletterDayEvent[]
  todayTodos: NewsletterDayTodo[]
  jobBrief?: {
    pendingInbox: number
    deadlines: Array<{ company: string; role: string; at: string }>
    followUps: Array<{ company: string; role: string; at: string }>
  }
}

export interface NewsletterSections {
  greeting: string
  headlines: NewsHeadline[]
  topicSections: NewsTopicSection[]
  todayEvents: NewsletterDayEvent[]
  todayTodos: NewsletterDayTodo[]
  jobPulse: string
  closing: string
}

export async function generateNewsletterIssue(input: NewsletterInput): Promise<{
  title: string
  contentMd: string
  sections: NewsletterSections
}> {
  const lang =
    input.locale === 'tr' ? 'Turkish'
    : input.locale === 'fr' ? 'French'
    : input.locale === 'es' ? 'Spanish'
    : input.locale === 'ar' ? 'Arabic'
    : 'English'

  const jobPulse = formatJobPulse(input.jobBrief, input.locale)
  const pendingTodos = input.todayTodos.filter((t) => !t.done)
  const topicSections = input.topicSections ?? []

  let greeting = defaultGreeting(input.locale, input.date)
  let closing = defaultClosing(input.locale, pendingTodos.length, input.todayEvents.length)

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await createClaudeMessage({
        system: `Write a 1-sentence morning greeting and 1-sentence closing for a personal daily brief. Language: ${lang}. Return JSON only: {"greeting":"...","closing":"..."}. Warm, worldly, concise — the reader is a maritime AI/ML researcher (shipbuilding, ocean engineering) who also follows politics, culture, finance, tech, tennis, and F1.`,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              date: input.date,
              headlineCount: input.headlines.length,
              topics: topicSections.map((s) => s.topicLabel),
              events: input.todayEvents.length,
              todos: pendingTodos.length,
              interests: input.interests.slice(0, 8),
            }),
          },
        ],
        maxTokens: 256,
        temperature: 0.4,
      })
      const parsed = JSON.parse(extractJson(raw)) as { greeting?: string; closing?: string }
      if (parsed.greeting) greeting = parsed.greeting
      if (parsed.closing) closing = parsed.closing
    } catch {
      // keep defaults
    }
  }

  const sections: NewsletterSections = {
    greeting,
    headlines: input.headlines,
    topicSections,
    todayEvents: input.todayEvents,
    todayTodos: input.todayTodos,
    jobPulse,
    closing,
  }

  const contentMd = buildMarkdown(sections, input.locale)

  const title =
    input.locale === 'tr' ? `Günlük bülten · ${input.date}`
    : input.locale === 'fr' ? `Brief du ${input.date}`
    : input.locale === 'es' ? `Resumen · ${input.date}`
    : input.locale === 'ar' ? `ملخص · ${input.date}`
    : `Daily brief · ${input.date}`

  return { title, contentMd, sections }
}

function buildMarkdown(sections: NewsletterSections, locale: string): string {
  const L =
    locale === 'tr' ?
      {
        news: 'Haberler',
        events: 'Bugünün etkinlikleri',
        todos: 'Bugünün yapılacakları',
        job: 'İş arama',
        noNews: 'İlgi alanlarına uygun haber bulunamadı.',
        noEvents: 'Bugün takvimde etkinlik yok.',
        noTodos: 'Bugün için to-do yok.',
        done: 'tamamlandı',
      }
    : {
        news: 'Headlines',
        events: "Today's events",
        todos: "Today's to-dos",
        job: 'Job pulse',
        noNews: 'No matching headlines found.',
        noEvents: 'No events today.',
        noTodos: 'No to-dos for today.',
        done: 'done',
      }

  const lines = [sections.greeting, '']

  if (sections.topicSections.length) {
    for (const section of sections.topicSections) {
      lines.push(`## ${section.topicLabel}`)
      for (const h of section.headlines) {
        lines.push(`- [${h.title}](${h.url}) — *${h.source}*`)
        if (h.snippet) lines.push(`  ${h.snippet}`)
      }
      lines.push('')
    }
  } else {
    lines.push(`## ${L.news}`)
    if (sections.headlines.length) {
      for (const h of sections.headlines) {
        lines.push(`- [${h.title}](${h.url}) — *${h.source}*`)
        if (h.snippet) lines.push(`  ${h.snippet}`)
      }
    } else {
      lines.push(L.noNews)
    }
    lines.push('')
  }

  lines.push(`## ${L.events}`)
  if (sections.todayEvents.length) {
    for (const e of sections.todayEvents) {
      const time =
        e.allDay ? 'All day'
        : new Date(e.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      const acct = e.account ? ` (${e.account})` : ''
      lines.push(`- ${time} · ${e.title}${acct}`)
    }
  } else {
    lines.push(L.noEvents)
  }

  lines.push('', `## ${L.todos}`)
  if (sections.todayTodos.length) {
    for (const t of sections.todayTodos) {
      lines.push(`- [${t.done ? 'x' : ' '}] ${t.title}${t.done ? ` (${L.done})` : ''}`)
    }
  } else {
    lines.push(L.noTodos)
  }

  lines.push('', `## ${L.job}`, sections.jobPulse, '', sections.closing)
  return lines.join('\n')
}

function formatJobPulse(
  jobBrief: NewsletterInput['jobBrief'],
  locale: string,
): string {
  if (!jobBrief) return locale === 'tr' ? 'İş arama verisi yok.' : 'No job hunt data.'
  const parts: string[] = []
  if (jobBrief.pendingInbox > 0) {
    parts.push(
      locale === 'tr' ?
        `${jobBrief.pendingInbox} başvuru paketi onay bekliyor.`
      : `${jobBrief.pendingInbox} application pack(s) pending review.`,
    )
  }
  if (jobBrief.deadlines.length) {
    const d = jobBrief.deadlines[0]!
    parts.push(
      locale === 'tr' ?
        `Sonraki deadline: ${d.company} — ${d.role}.`
      : `Next deadline: ${d.company} — ${d.role}.`,
    )
  }
  if (jobBrief.followUps.length) {
    const f = jobBrief.followUps[0]!
    parts.push(
      locale === 'tr' ?
        `Takip: ${f.company} — ${f.role}.`
      : `Follow-up due: ${f.company} — ${f.role}.`,
    )
  }
  if (!parts.length) {
    return locale === 'tr' ? 'İş arama tarafı sakin.' : 'Job hunt is quiet today.'
  }
  return parts.join(' ')
}

function defaultGreeting(locale: string, date: string): string {
  if (locale === 'tr') return `Günaydın — işte ${date} günlük dünya özeti.`
  if (locale === 'fr') return `Bonjour — voici votre brief du ${date}.`
  if (locale === 'es') return `Buenos días — tu resumen del ${date}.`
  if (locale === 'ar') return `صباح الخير — ملخصك ليوم ${date}.`
  return `Good morning — here's your world brief for ${date}.`
}

function defaultClosing(locale: string, todos: number, events: number): string {
  if (locale === 'tr') {
    return `${events} etkinlik, ${todos} açık to-do. İyi bir gün!`
  }
  return `You have ${events} event(s) and ${todos} open to-do(s). Have a great day.`
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1]!.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}
