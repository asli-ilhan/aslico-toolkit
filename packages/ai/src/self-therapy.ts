import { createClaudeMessage } from './claude'
import { THERAPY_SCRIPT_EXAMPLES } from './self-therapy-examples'

export interface TherapyScriptInput {
  topic: string
  locale?: string
  notes?: string
  durationHint?: 'short' | 'medium' | 'long'
}

export interface TherapyScriptResult {
  title: string
  induction: string
  deepening: string
  suggestions: string
  fullScript: string
}

function localeInstruction(locale: string): string {
  if (locale === 'tr') return 'Write the entire script in natural, warm Turkish (Türkiye Türkçesi) — spoken hypnosis register, not formal essay Turkish.'
  if (locale === 'fr') return 'Write the entire script in French, matching the same hypnosis oral style as the Turkish examples.'
  if (locale === 'es') return 'Write the entire script in Spanish, matching the same hypnosis oral style as the Turkish examples.'
  if (locale === 'ar') return 'Write the entire script in Arabic, matching the same hypnosis oral style as the Turkish examples.'
  return 'Write the entire script in English, matching the same hypnosis oral style as the Turkish examples.'
}

function durationGuide(hint: TherapyScriptInput['durationHint']): string {
  if (hint === 'short') {
    return 'Shorter than the examples but still full paragraphs (roughly 1–1.5 minutes spoken per section). Never telegram-style bullet lines.'
  }
  if (hint === 'long') {
    return 'Match the length and density of the examples (roughly 3–6 minutes spoken per section). Spacious, looping, immersive.'
  }
  return 'Aim for roughly 2–4 minutes spoken per section — closer to the examples than to a short clinical script.'
}

function examplesBlock(): string {
  return THERAPY_SCRIPT_EXAMPLES.map((ex, i) => {
    return `EXAMPLE ${i + 1} (topic: ${ex.topic})
### INDUCTION
${ex.induction}

### DEEPENING
${ex.deepening}

### SUGGESTIONS
${ex.suggestions}`
  }).join('\n\n---\n\n')
}

const SYSTEM = `You write long-form spoken hypnosis / self-therapy scripts for evening or rest use.
The EXAMPLES define the FORM. Match their voice closely. Do not invent a short clinical mindfulness script.

Structure ALWAYS has exactly three sections (map the continuous spoken flow into these buckets):
1) INDUCTION (rahatlama) — greeting, permission to rest/sleep, “I’m beside you”, breath, body contact points, time slowing, soft entry metaphors
2) DEEPENING (frekans / derinlik) — immersive imagery, countdown when it fits, dual awareness (body resting / mind awake), frequency / threshold language
3) SUGGESTIONS (telkinler) — topic-specific metaphors + gentle directives + ALWAYS a dual exit: sleep OR wake refreshed

FORM rules (from the examples):
- Second person (“sen”), intimate, unhurried oral cadence — long flowing paragraphs, soft repetitions, rhetorical “fark ettin mi / değil mi / görüyor musun”
- Sensory metaphors (ocean, light, threads, city of mind, browser tabs, muddy water clearing, bow & arrow, costume identities falling away)
- Permission: listener may drift, miss words, fall asleep — subconscious still receives
- No medical claims, no diagnosis, no guaranteeing cures; keep imagery safe (dark ocean = calm night sea, never horror)
- Suitable for calm TTS while falling asleep
- Return ONLY valid JSON with keys: title, induction, deepening, suggestions`

export async function generateTherapyScript(
  input: TherapyScriptInput,
): Promise<TherapyScriptResult> {
  const locale = input.locale ?? 'tr'
  const topic = input.topic.trim()
  if (!topic) throw new Error('Topic is required')

  const user = `${localeInstruction(locale)}
${durationGuide(input.durationHint)}

Topic / intention: ${topic}
${input.notes?.trim() ? `Extra notes from user: ${input.notes.trim()}` : ''}

Follow the FORM, length, metaphors, dual-exit closing, and oral cadence of these examples.
Adapt imagery and suggestions to the topic — do not copy paragraphs verbatim.

${examplesBlock()}

Respond with JSON only.`

  const raw = await createClaudeMessage({
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 8192,
    temperature: 0.6,
  })

  const parsed = parseTherapyJson(raw)
  const fullScript = [
    parsed.induction.trim(),
    '',
    '…',
    '',
    parsed.deepening.trim(),
    '',
    '…',
    '',
    parsed.suggestions.trim(),
  ].join('\n')

  return {
    title: parsed.title.trim() || topic.slice(0, 80),
    induction: parsed.induction.trim(),
    deepening: parsed.deepening.trim(),
    suggestions: parsed.suggestions.trim(),
    fullScript,
  }
}

function parseTherapyJson(raw: string): {
  title: string
  induction: string
  deepening: string
  suggestions: string
} {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Claude did not return JSON for therapy script')
  }
  const data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  return {
    title: String(data.title ?? ''),
    induction: String(data.induction ?? ''),
    deepening: String(data.deepening ?? ''),
    suggestions: String(data.suggestions ?? ''),
  }
}
