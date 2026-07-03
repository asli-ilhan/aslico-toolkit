import { createClaudeMessage } from './claude'

export interface TravelPickInput {
  title: string
  url: string
  source: string
  snippet?: string
  vibe: string
  kind: string
}

export interface TravelScoutInput {
  locale: string
  destination: string
  region?: string
  country?: string
  startDate?: string
  endDate?: string
  mode: 'trip' | 'random'
  vibes: string[]
  picks: TravelPickInput[]
  nearbyRegions: string[]
  randomWhy?: string
}

export interface TravelScoutSections {
  greeting: string
  destination: string
  dateWindow?: string
  vibeSections: Array<{ vibe: string; label: string; picks: TravelPickInput[]; curatorNote: string }>
  nearbyDayTrips: TravelPickInput[]
  insiderTips: string[]
  closing: string
}

const VIBE_LABELS: Record<string, { en: string; tr: string }> = {
  offbeat: { en: 'Off the beaten path', tr: 'Az bilinen rotalar' },
  authentic: { en: 'Authentic & local', tr: 'Otantik & yerel' },
  'high-society': { en: 'High society & insider', tr: 'High society & içeriden' },
  'hidden-gem': { en: 'Hidden gems', tr: 'Gizli hazineler' },
}

export async function generateTravelScout(input: TravelScoutInput): Promise<{
  title: string
  contentMd: string
  sections: TravelScoutSections
}> {
  const lang =
    input.locale === 'tr' ? 'Turkish'
    : input.locale === 'fr' ? 'French'
    : input.locale === 'es' ? 'Spanish'
    : input.locale === 'ar' ? 'Arabic'
    : 'English'

  const vibeSections = input.vibes.map((vibe) => {
    const label =
      input.locale === 'tr' ? (VIBE_LABELS[vibe]?.tr ?? vibe) : (VIBE_LABELS[vibe]?.en ?? vibe)
    return {
      vibe,
      label,
      picks: input.picks.filter((p) => p.vibe === vibe).slice(0, 6),
      curatorNote: '',
    }
  })

  const nearbyDayTrips = input.picks.filter((p) => p.kind === 'nearby').slice(0, 5)

  let greeting = defaultGreeting(input)
  let closing = defaultClosing(input.locale)
  let insiderTips = defaultTips(input.locale, input.nearbyRegions)

  for (const vs of vibeSections) {
    if (!vs.curatorNote && vs.picks.length) {
      vs.curatorNote = vs.picks[0]!.title
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await createClaudeMessage({
        system: `You curate unusual, insider travel — NOT mass tourism or Instagram bucket lists. Language: ${lang}. Return JSON only:
{"greeting":"...","closing":"...","insiderTips":["tip1","tip2","tip3"],"vibeNotes":{"offbeat":"1 sentence","authentic":"...","high-society":"...","hidden-gem":"..."}}
Tone: discreet, worldly, high-society aware. Avoid "top 10 tourist attractions".`,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              mode: input.mode,
              destination: input.destination,
              dates: input.startDate && input.endDate ? `${input.startDate} → ${input.endDate}` : null,
              vibes: input.vibes,
              nearby: input.nearbyRegions,
              randomWhy: input.randomWhy,
              samplePicks: input.picks.slice(0, 10).map((p) => p.title),
            }),
          },
        ],
        maxTokens: 800,
        temperature: 0.55,
      })
      const parsed = JSON.parse(extractJson(raw)) as {
        greeting?: string
        closing?: string
        insiderTips?: string[]
        vibeNotes?: Record<string, string>
      }
      if (parsed.greeting) greeting = parsed.greeting
      if (parsed.closing) closing = parsed.closing
      if (parsed.insiderTips?.length) insiderTips = parsed.insiderTips
      if (parsed.vibeNotes) {
        for (const vs of vibeSections) {
          if (parsed.vibeNotes[vs.vibe]) vs.curatorNote = parsed.vibeNotes[vs.vibe]!
        }
      }
    } catch {
      // defaults
    }
  }

  const dateWindow =
    input.startDate && input.endDate ? `${input.startDate} → ${input.endDate}` : undefined

  const sections: TravelScoutSections = {
    greeting,
    destination: input.destination,
    dateWindow,
    vibeSections: vibeSections.filter((s) => s.picks.length > 0 || s.curatorNote),
    nearbyDayTrips,
    insiderTips,
    closing,
  }

  const contentMd = buildMarkdown(sections, input.locale)
  const title =
    input.locale === 'tr' ?
      `Tatil keşfi · ${input.destination}`
    : `Travel scout · ${input.destination}`

  return { title, contentMd, sections }
}

function buildMarkdown(sections: TravelScoutSections, locale: string): string {
  const L =
    locale === 'tr' ?
      { nearby: 'Yakın kaçamaklar', tips: 'İçeriden ipuçları' }
    : { nearby: 'Nearby escapes', tips: 'Insider tips' }

  const lines = [sections.greeting, '']
  if (sections.dateWindow) lines.push(`**${sections.dateWindow}**`, '')

  for (const vs of sections.vibeSections) {
    lines.push(`## ${vs.label}`)
    if (vs.curatorNote) lines.push(vs.curatorNote, '')
    for (const p of vs.picks) {
      lines.push(`- [${p.title}](${p.url}) — *${p.kind}* · ${p.source}`)
      if (p.snippet) lines.push(`  ${p.snippet}`)
    }
    lines.push('')
  }

  if (sections.nearbyDayTrips.length) {
    lines.push(`## ${L.nearby}`)
    for (const p of sections.nearbyDayTrips) {
      lines.push(`- [${p.title}](${p.url})`)
    }
    lines.push('')
  }

  lines.push(`## ${L.tips}`)
  for (const t of sections.insiderTips) lines.push(`- ${t}`)
  lines.push('', sections.closing)
  return lines.join('\n')
}

function defaultGreeting(input: TravelScoutInput): string {
  if (input.locale === 'tr') {
    return input.mode === 'random' ?
        `Rastgele seçim: ${input.destination} — kalabalıktan uzak, içeriden bir rota.`
      : `${input.destination} için izbe ve otantik bir tatil keşfi.`
  }
  return input.mode === 'random' ?
      `Random pick: ${input.destination} — offbeat, insider territory.`
    : `Your offbeat travel scout for ${input.destination}.`
}

function defaultClosing(locale: string): string {
  return locale === 'tr' ?
      'Kitlesel turizm listeleri değil — zamanla zevklerini ekle, scout daha keskin olur.'
    : 'Not a bucket-list factory — refine your vibes over time.'
}

function defaultTips(locale: string, nearby: string[]): string[] {
  if (locale === 'tr') {
    return [
      'Rezervasyonları yerel dilde veya doğrudan mekân üzerinden yap — aggregator komisyonu ve kalabalık rotaları atla.',
      nearby.length ? `Yakın kaçamak: ${nearby.join(', ')}` : 'Şehir dışı yarım günlük rotaları sor.',
      'High society etkinlikleri için dress code ve davet kapısını önceden doğrula.',
    ]
  }
  return [
    'Book direct or in local language — skip aggregator crowds.',
    nearby.length ? `Day trips: ${nearby.join(', ')}` : 'Ask locals for half-day escapes outside the centre.',
    'For society events, confirm dress code and guest-list access early.',
  ]
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1]!.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}
