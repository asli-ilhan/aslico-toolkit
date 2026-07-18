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
  if (locale === 'tr') return 'Write the entire script in natural, warm Turkish (Türkiye Türkçesi).'
  if (locale === 'fr') return 'Write the entire script in French.'
  if (locale === 'es') return 'Write the entire script in Spanish.'
  if (locale === 'ar') return 'Write the entire script in Arabic.'
  return 'Write the entire script in English.'
}

function durationGuide(hint: TherapyScriptInput['durationHint']): string {
  if (hint === 'short') return 'Keep each section concise (about 45–90 seconds spoken).'
  if (hint === 'long') return 'Make each section longer and more spacious (about 3–5 minutes spoken).'
  return 'Aim for roughly 2–3 minutes spoken per section.'
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

const SYSTEM = `You write calm hypnosis-style self-therapy scripts for evening / sleep use.
Structure ALWAYS has exactly three sections:
1) INDUCTION (rahatlama) — body awareness, breath, safety
2) DEEPENING (frekans / derinlik) — countdown or imagery that slows the mind
3) SUGGESTIONS (telkinler) — topic-specific gentle affirmations

Rules:
- Soft, slow pacing; short sentences; sensory language
- No medical claims, no diagnosis, no guaranteeing cures
- No scary imagery; keep it safe and grounding
- Suitable to be read aloud by a calm TTS voice while the listener is falling asleep
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

Use the same three-section structure and calm tone as these examples (adapt content to the topic; do not copy verbatim):

${examplesBlock()}

Respond with JSON only.`

  const raw = await createClaudeMessage({
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 4096,
    temperature: 0.55,
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
