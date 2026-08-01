import { createClaudeMessage, streamClaudeMessage } from './claude'

export type MeetingLanguageMode = 'auto' | 'tr' | 'en'

export interface MeetingCueAnswer {
  oneliner: string
  script: string
  bullets: string[]
  language: 'tr' | 'en'
  confidence: 'high' | 'medium' | 'low'
}

export interface MeetingCueInput {
  question: string
  counterparty: string
  focus: string
  languageMode: MeetingLanguageMode
  knowledgeCorpus: string
  /** Always-on Q&A / hard-rule templates (not RAG-scored). */
  answerTemplate?: string
  recentTurns?: { question: string; oneliner: string; bullets?: string[] }[]
}

const SYSTEM_STREAM = `You are a live pitch-meeting copilot for A'SHERIV (maritime digital lifecycle). The founder is mid-call and needs a glanceable answer NOW.

Emit lines in this exact order, one fact per line:
ONE\t<one short spoken sentence>
SCRIPT\t<1–3 ready spoken sentences>
BULLET\t<short bullet>
BULLET\t<short bullet>
BULLET\t<short bullet>
META\t<tr|en>\t<high|medium|low>

Rules:
- Match question language; keep English business jargon (AIS, RUL, PINN, FuelEU, CII, ETS, BIM) in Turkish answers.
- Prefer ANSWER TEMPLATES when the question matches a known Q&A — adapt wording, keep facts exact.
- Obey HARD RULES / forbidden phrases absolutely.
- Use ONLY knowledge + templates + brief. Never invent traction, contracts, approvals, or metrics.
- If unknown: low confidence + say you will confirm.
- Prefer concrete numbers from corpus. Be concise. Accept-then-reframe on adversarial questions.`

const SYSTEM_JSON = `You are a live pitch-meeting copilot for A'SHERIV (maritime digital lifecycle). The founder is mid-call and needs a glanceable answer NOW.

Output ONLY valid JSON (no markdown fences):
{
  "oneliner": "one short sentence they can say first",
  "script": "1–3 ready spoken sentences (natural, confident, not salesy)",
  "bullets": ["3–5 short bullets: numbers, jargon, backup points"],
  "language": "tr" | "en",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Answer in the SAME language as the question. Mixed TR+EN questions → Turkish with English jargon kept.
- Prefer ANSWER TEMPLATES for known Q&A; obey HARD RULES / forbidden phrases.
- Use ONLY knowledge + templates + brief. Do NOT invent metrics, customers, approvals, or traction.
- If missing: confidence "low", say you will follow up / confirm.
- Be concise. Accept-then-reframe on adversarial ("smart mouth") questions.`

function meetingModel(): string {
  return (
    process.env.ANTHROPIC_MEETING_MODEL ||
    process.env.ANTHROPIC_FAST_MODEL ||
    'claude-haiku-4-5-20251001'
  )
}

const TURKISH_HINTS =
  /\b(ne|nasıl|neden|kaç|kadar|mı|mi|mu|mü|için|nedir|hangi|var|yok|olur|durumda|söyle|anlat|peki|ama|çok|bize|bizim|sizin)\b/i

/** The retrieved corpus is usually English, so the answer language is stated explicitly. */
export function detectQuestionLanguage(question: string, mode: MeetingLanguageMode): 'tr' | 'en' {
  if (mode === 'tr') return 'tr'
  if (mode === 'en') return 'en'
  if (/[ğıİşöçüĞİŞÖÇÜ]/.test(question)) return 'tr'
  return TURKISH_HINTS.test(question) ? 'tr' : 'en'
}

function buildUserPrompt(input: MeetingCueInput): string {
  const recent =
    input.recentTurns && input.recentTurns.length
      ? input.recentTurns
          .map((t, i) => {
            const bullets = (t.bullets ?? []).slice(0, 2).join('; ')
            return `${i + 1}. Q: ${t.question}\n   A: ${t.oneliner}${bullets ? ` | ${bullets}` : ''}`
          })
          .join('\n')
      : '(none)'

  const answerLanguage = detectQuestionLanguage(input.question, input.languageMode)
  const langHint =
    answerLanguage === 'tr'
      ? 'Answer in Turkish. Keep English business jargon (AIS, RUL, PINN, FuelEU, CII, ETS, BIM, SaaS) as-is.'
      : 'Answer in English.'

  const templateBlock = input.answerTemplate?.trim()
    ? `\nAnswer templates & hard rules (ALWAYS apply — not optional RAG):\n---\n${input.answerTemplate.slice(0, 5500)}\n---`
    : ''

  return `Meeting brief:
- Counterparty: ${input.counterparty || '(unspecified)'}
- Focus / where conversation should land: ${input.focus || '(open)'}

Recent turns:
${recent}

Retrieved knowledge (most relevant chunks only):
---
${input.knowledgeCorpus.slice(0, 9000) || '(empty — say you need to confirm)'}
---
${templateBlock}

Live question (transcribed):
${input.question.trim()}

ANSWER LANGUAGE: ${answerLanguage === 'tr' ? 'Turkish' : 'English'}. ${langHint}
The knowledge above may be in another language — translate the facts, do not switch language.
If a template matches this question, follow it closely.`
}

function parseCueJson(raw: string): MeetingCueAnswer {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  const parsed = JSON.parse(slice) as Partial<MeetingCueAnswer>
  const language = parsed.language === 'en' ? 'en' : 'tr'
  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
    : []
  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium'
  return {
    oneliner: String(parsed.oneliner ?? '').trim() || '…',
    script: String(parsed.script ?? '').trim() || String(parsed.oneliner ?? '').trim(),
    bullets: bullets.length ? bullets : ['(no bullets)'],
    language,
    confidence,
  }
}

const PROTOCOL_KEYWORDS = ['ONE', 'SCRIPT', 'BULLET', 'META']

/** True while the model has only emitted part of a line tag, e.g. "ON" or "BULL". */
function isPartialTag(text: string): boolean {
  const t = text.trim().toUpperCase()
  if (!t) return true
  return PROTOCOL_KEYWORDS.some((k) => k.startsWith(t))
}

/**
 * Parse the streamed line protocol into a cue answer.
 * With `partial`, half-written tags yield empty fields instead of leaking raw
 * protocol text ("ONE") onto the screen mid-stream.
 */
export function parseCueStreamText(raw: string, options?: { partial?: boolean }): MeetingCueAnswer {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let oneliner = ''
  let script = ''
  const bullets: string[] = []
  let language: 'tr' | 'en' = /[ğıüşöçİĞÜŞÖÇ]/.test(raw) ? 'tr' : 'en'
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  let sawProtocol = false

  for (const line of lines) {
    if (line.startsWith('ONE\t')) {
      oneliner = line.slice(4).trim()
      sawProtocol = true
    } else if (line.startsWith('SCRIPT\t')) {
      script = line.slice(7).trim()
      sawProtocol = true
    } else if (line.startsWith('BULLET\t')) {
      sawProtocol = true
      const b = line.slice(7).trim()
      if (b) bullets.push(b)
    } else if (line.startsWith('META\t')) {
      sawProtocol = true
      const parts = line.slice(5).split('\t').map((p) => p.trim())
      if (parts[0] === 'en' || parts[0] === 'tr') language = parts[0]
      if (parts[1] === 'high' || parts[1] === 'medium' || parts[1] === 'low') confidence = parts[1]
    } else if (isPartialTag(line)) {
      sawProtocol = true
    }
  }

  const partial = options?.partial ?? false

  if (!sawProtocol && !oneliner && !script && !bullets.length) {
    // Protocol missing entirely — treat the raw text as the answer.
    return {
      oneliner: raw.slice(0, 200).trim() || (partial ? '' : '…'),
      script: raw.slice(0, 500).trim(),
      bullets: [],
      language,
      confidence: 'low',
    }
  }

  const placeholder = partial ? '' : '…'
  return {
    oneliner: oneliner || (partial ? '' : script.slice(0, 160) || placeholder),
    script: script || (partial ? '' : oneliner),
    bullets: bullets.slice(0, 6),
    language,
    confidence,
  }
}

export async function generateMeetingCue(input: MeetingCueInput): Promise<MeetingCueAnswer> {
  const raw = await createClaudeMessage({
    model: meetingModel(),
    system: [
      { type: 'text', text: SYSTEM_JSON, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(input) + '\n\nReturn JSON only.' }],
    maxTokens: 700,
    temperature: 0.2,
  })

  try {
    return parseCueJson(raw)
  } catch {
    return parseCueStreamText(raw)
  }
}

export type MeetingStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'partial'; answer: Partial<MeetingCueAnswer> & { raw: string } }
  | { type: 'done'; answer: MeetingCueAnswer }

/** Stream cue lines; yields text deltas for typewriter + final parsed answer. */
export async function* streamMeetingCue(
  input: MeetingCueInput,
): AsyncGenerator<MeetingStreamEvent, MeetingCueAnswer, unknown> {
  let raw = ''
  for await (const delta of streamClaudeMessage({
    model: meetingModel(),
    system: [
      { type: 'text', text: SYSTEM_STREAM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(input) + '\n\nEmit ONE/SCRIPT/BULLET/META lines now.',
      },
    ],
    maxTokens: 650,
    temperature: 0.2,
  })) {
    raw += delta
    yield { type: 'delta', text: delta }
    yield { type: 'partial', answer: { ...parseCueStreamText(raw, { partial: true }), raw } }
  }
  const answer = parseCueStreamText(raw)
  yield { type: 'done', answer }
  return answer
}

export type MeetingDocType =
  | 'pitch'
  | 'metrics'
  | 'faq'
  | 'strategy'
  | 'product'
  | 'competitor'
  | 'note'
  | 'answer-template'

export interface ClassifiedKnowledgeDoc {
  title: string
  docType: MeetingDocType
  tags: string[]
}

const CLASSIFY_SYSTEM = `You classify a document for a startup pitch knowledge pool.
Return ONLY JSON:
{
  "title": "short clear title",
  "docType": "pitch"|"metrics"|"faq"|"strategy"|"product"|"competitor"|"note"|"answer-template",
  "tags": ["up to 6 short tags"]
}
Prefer English tags unless the doc is clearly Turkish-only. Keep business jargon as-is.`

export async function classifyKnowledgeDoc(
  filename: string,
  content: string,
): Promise<ClassifiedKnowledgeDoc> {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Document'
  const raw = await createClaudeMessage({
    model: meetingModel(),
    system: CLASSIFY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Filename: ${filename}\n\nContent (excerpt):\n${content.slice(0, 8000)}`,
      },
    ],
    maxTokens: 300,
    temperature: 0.1,
  })

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
    const parsed = JSON.parse(slice) as Partial<ClassifiedKnowledgeDoc>
    const allowed: MeetingDocType[] = [
      'pitch',
      'metrics',
      'faq',
      'strategy',
      'product',
      'competitor',
      'note',
      'answer-template',
    ]
    const docType = allowed.includes(parsed.docType as MeetingDocType)
      ? (parsed.docType as MeetingDocType)
      : 'note'
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
      : []
    return {
      title: String(parsed.title ?? base).trim() || base,
      docType,
      tags,
    }
  } catch {
    return { title: base, docType: 'note', tags: [] }
  }
}
