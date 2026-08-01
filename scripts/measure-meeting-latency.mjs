/**
 * Measures Meeting Copilot cue latency end to end against the real APIs.
 * Run: node scripts/measure-meeting-latency.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, 'apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const SYSTEM_STREAM = `You are a live pitch-meeting copilot. Stream a structured answer as plain lines (no JSON, no markdown fences).

Emit lines in this exact order, one fact per line:
ONE\t<one short spoken sentence>
SCRIPT\t<1–3 ready spoken sentences>
BULLET\t<short bullet>
BULLET\t<short bullet>
BULLET\t<short bullet>
META\t<tr|en>\t<high|medium|low>

Rules:
- Match question language; keep English business jargon in Turkish answers.
- Use ONLY the knowledge corpus + brief. Never invent metrics.
- If unknown: low confidence + say you will confirm.
- Prefer concrete numbers from corpus. Be concise.`

const corpus = `[metrics] Q2 Metrics
ARR $1.24M, MRR $103k, growing 11% MoM. CAC $410, CAC payback 8.2 months.
Net revenue retention 118%. Monthly burn $84k. Cash $1.35M. Runway 16 months.
Logo churn 1.4% monthly. 62 paying teams, ACV $20k.

[pitch] Seed Deck Narrative
We sell an AI operations copilot to mid-market logistics teams.
Wedge: dispatch exception handling. Expansion: full planning suite.

[faq] Investor FAQ
Why now: freight APIs standardized in 2024, LLM cost fell 12x.
Moat: proprietary exception-resolution dataset, 2.1M labeled events.`

const model = process.env.ANTHROPIC_MEETING_MODEL || 'claude-haiku-4-5-20251001'

const TURKISH_HINTS =
  /\b(ne|nasıl|neden|kaç|kadar|mı|mi|mu|mü|için|nedir|hangi|var|yok|olur|durumda|söyle|anlat|peki|ama|çok|bize|bizim|sizin)\b/i

function detectQuestionLanguage(question, mode = 'auto') {
  if (mode === 'tr') return 'tr'
  if (mode === 'en') return 'en'
  if (/[ğıİşöçüĞİŞÖÇÜ]/.test(question)) return 'tr'
  return TURKISH_HINTS.test(question) ? 'tr' : 'en'
}

async function run(label, question) {
  const answerLanguage = detectQuestionLanguage(question)
  const langHint =
    answerLanguage === 'tr'
      ? 'Answer in Turkish. Keep English business jargon (ARR, CAC, runway, burn, GTM) as-is.'
      : 'Answer in English.'
  const t0 = Date.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 650,
      temperature: 0.2,
      stream: true,
      system: [{ type: 'text', text: SYSTEM_STREAM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Meeting brief:\n- Counterparty: Seed VC\n- Focus: raise interest\n\nRetrieved knowledge:\n---\n${corpus}\n---\n\nLive question (transcribed):\n${question}\n\nANSWER LANGUAGE: ${answerLanguage === 'tr' ? 'Turkish' : 'English'}. ${langHint}\nThe knowledge above may be in another language — translate the facts, do not switch language.\n\nEmit ONE/SCRIPT/BULLET/META lines now.`,
        },
      ],
    }),
  })

  if (!res.ok) {
    console.error(label, 'HTTP', res.status, (await res.text()).slice(0, 200))
    return
  }

  let firstByte = null
  let oneComplete = null
  let raw = ''
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload)
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          if (firstByte === null) firstByte = Date.now() - t0
          raw += evt.delta.text
          if (oneComplete === null && /\n/.test(raw)) oneComplete = Date.now() - t0
        }
      } catch {
        // ignore
      }
    }
  }
  const total = Date.now() - t0

  const one = raw.split('\n').find((l) => l.startsWith('ONE\t'))?.slice(4) ?? '(none)'
  const meta = raw.split('\n').find((l) => l.startsWith('META\t'))?.slice(5) ?? '?'
  console.log(
    `${label}: first token ${firstByte}ms · one-liner ready ${oneComplete}ms · full ${total}ms`,
  )
  console.log(`   expected ${answerLanguage} · meta ${meta.replace('\t', '/')}`)
  console.log(`   ONE: ${one}`)
}

console.log(`model: ${model}\n`)
await run('cold', 'Runway kaç ay ve CAC payback ne durumda? Burn nasıl gidiyor?')
await run('warm TR', 'Runway kaç ay ve CAC payback ne durumda? Burn nasıl gidiyor?')
await run('warm EN', 'How long is your runway and what is CAC payback?')
await run('warm mixed TR', 'Bizim NDR ve churn rakamları rakiplere göre nasıl?')
