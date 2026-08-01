/**
 * Offline verification for Meeting Copilot realtime + RAG helpers.
 * Run: node scripts/verify-meeting-copilot.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function chunkKnowledgeText(text) {
  const TARGET_CHARS = 1100
  const OVERLAP_CHARS = 160
  const MAX_TOTAL_CHARS = 2_000_000
  const cleaned = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []
  const bounded =
    cleaned.length > MAX_TOTAL_CHARS
      ? `${cleaned.slice(0, MAX_TOTAL_CHARS)}\n\n[document truncated at ${MAX_TOTAL_CHARS} chars]`
      : cleaned
  if (bounded.length <= TARGET_CHARS) return [bounded]
  const paragraphs = bounded.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const units = []
  for (const p of paragraphs) {
    if (p.length <= TARGET_CHARS) {
      units.push(p)
      continue
    }
    const sentences = p.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean)
    if (sentences.length <= 1) {
      for (let i = 0; i < p.length; i += TARGET_CHARS - OVERLAP_CHARS) {
        units.push(p.slice(i, i + TARGET_CHARS))
      }
    } else {
      let buf = ''
      for (const s of sentences) {
        if (!buf) buf = s
        else if ((buf + ' ' + s).length <= TARGET_CHARS) buf = `${buf} ${s}`
        else {
          units.push(buf)
          buf = s
        }
      }
      if (buf) units.push(buf)
    }
  }
  if (units.length <= 1) return units
  const chunks = []
  for (let i = 0; i < units.length; i++) {
    let chunk = units[i]
    if (i > 0 && OVERLAP_CHARS > 0) {
      const prev = units[i - 1]
      const overlap = prev.slice(Math.max(0, prev.length - OVERLAP_CHARS))
      chunk = `${overlap} ${chunk}`.trim()
    }
    while (i + 1 < units.length && chunk.length < TARGET_CHARS * 0.55) {
      i += 1
      chunk = `${chunk}\n\n${units[i]}`.trim()
    }
    chunks.push(chunk)
  }
  return chunks.filter(Boolean)
}

const PROTOCOL_KEYWORDS = ['ONE', 'SCRIPT', 'BULLET', 'META']

function isPartialTag(text) {
  const t = text.trim().toUpperCase()
  if (!t) return true
  return PROTOCOL_KEYWORDS.some((k) => k.startsWith(t))
}

function parseCueStreamText(raw, options) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let oneliner = ''
  let script = ''
  const bullets = []
  let language = /[ğıüşöçİĞÜŞÖÇ]/.test(raw) ? 'tr' : 'en'
  let confidence = 'medium'
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

function normalizeMeetingQuery(query) {
  return query
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
}

function buildCorpusFromChunks(chunks) {
  const MAX_CORPUS_CHARS = 8000
  const MAX_PER_DOC_CHARS = 1800
  const used = new Map()
  const parts = []
  let total = 0
  for (const c of chunks) {
    const usedForDoc = used.get(c.doc_id) ?? 0
    if (usedForDoc >= MAX_PER_DOC_CHARS) continue
    const roomDoc = MAX_PER_DOC_CHARS - usedForDoc
    const roomTotal = MAX_CORPUS_CHARS - total
    if (roomTotal <= 80) break
    const slice = c.content_text.slice(0, Math.min(roomDoc, roomTotal))
    parts.push(`[${c.doc_type}] ${c.title}\n${slice}`)
    used.set(c.doc_id, usedForDoc + slice.length)
    total += slice.length + 20
  }
  return parts.join('\n\n---\n\n')
}

// --- tests ---

{
  const para = (i) =>
    `Section ${i}. ${'Detail about go-to-market and unit economics. '.repeat(12)}ARR is ${i}M. Runway ${i} months.\n\n`
  const long = Array.from({ length: 24 }, (_, i) => para(i)).join('')
  const chunks = chunkKnowledgeText(long)
  assert.ok(chunks.length >= 3, `long doc should produce several chunks, got ${chunks.length}`)
  const joined = chunks.join(' ')
  assert.ok(joined.includes('ARR is 23M'), 'last-section metric retained across chunks')
  assert.ok(chunks.some((c) => c.length > 200), 'chunks have substance')
  console.log('✓ chunking retains late-document metrics')
}

{
  const raw = [
    'ONE\tRunway 14 ay, burn aylık 80k.',
    'SCRIPT\tRunway yaklaşık 14 ay. CAC iyileşiyor; ARR hedefimiz net.',
    'BULLET\tARR $1.2M',
    'BULLET\tCAC payback 8 ay',
    'BULLET\tburn $80k/mo',
    'META\ttr\thigh',
  ].join('\n')
  const parsed = parseCueStreamText(raw)
  assert.equal(parsed.language, 'tr')
  assert.equal(parsed.confidence, 'high')
  assert.match(parsed.oneliner, /Runway/)
  assert.equal(parsed.bullets.length, 3)
  assert.ok(parsed.bullets[0].includes('ARR'))
  console.log('✓ streamed line parser (mixed TR/EN jargon)')
}

{
  const partial = 'ONE\tFirst line only'
  const parsed = parseCueStreamText(partial)
  assert.equal(parsed.oneliner, 'First line only')
  assert.equal(parsed.script, 'First line only')
  console.log('✓ partial stream parser fallback')
}

{
  // Half-written tags must not leak protocol text onto the screen.
  for (const raw of ['O', 'ON', 'ONE', 'ONE\t', 'BULL']) {
    const parsed = parseCueStreamText(raw, { partial: true })
    assert.equal(parsed.oneliner, '', `"${raw}" should render nothing yet`)
    assert.equal(parsed.script, '', `"${raw}" should render nothing yet`)
  }
  const started = parseCueStreamText('ONE\tRunway 16 ay', { partial: true })
  assert.equal(started.oneliner, 'Runway 16 ay')
  console.log('✓ mid-token protocol tags never leak to UI')
}

{
  assert.equal(normalizeMeetingQuery('  Runway / CAC  nedir?  '), 'runway / cac nedir?')
  assert.ok(normalizeMeetingQuery('İstanbul ARR').includes('arr'))
  console.log('✓ mixed TR/EN query normalization')
}

{
  const monopoly = Array.from({ length: 8 }, (_, i) => ({
    chunk_id: `c${i}`,
    doc_id: i < 6 ? 'doc-a' : 'doc-b',
    title: i < 6 ? 'Big Pitch' : 'Metrics',
    doc_type: 'pitch',
    content_text: 'x'.repeat(2000),
    score: 1,
  }))
  const corpus = buildCorpusFromChunks(monopoly)
  assert.ok(corpus.includes('Metrics'), 'second doc must appear (no monopoly)')
  assert.ok(corpus.length <= 8500, 'corpus capped ~8k')
  console.log('✓ corpus builder prevents single-doc monopoly')
}

{
  const TURKISH_HINTS =
    /\b(ne|nasıl|neden|kaç|kadar|mı|mi|mu|mü|için|nedir|hangi|var|yok|olur|durumda|söyle|anlat|peki|ama|çok|bize|bizim|sizin)\b/i
  const detect = (q, mode = 'auto') => {
    if (mode === 'tr') return 'tr'
    if (mode === 'en') return 'en'
    if (/[ğıİşöçüĞİŞÖÇÜ]/.test(q)) return 'tr'
    return TURKISH_HINTS.test(q) ? 'tr' : 'en'
  }
  assert.equal(detect('Runway kaç ay kaldı?'), 'tr')
  assert.equal(detect('Bizim NDR ve churn nasil gidiyor'), 'tr')
  assert.equal(detect('How long is your runway?'), 'en')
  assert.equal(detect('What is CAC payback?'), 'en')
  assert.equal(detect('How long is your runway?', 'tr'), 'tr')
  console.log('✓ answer-language detection (TR/EN + jargon)')
}

{
  // Source files exist for key routes
  const files = [
    'apps/web/app/api/modules/meeting-copilot/deepgram-token/route.ts',
    'apps/web/app/api/modules/meeting-copilot/capture/stream/route.ts',
    'apps/web/app/api/modules/meeting-copilot/docs/reindex/route.ts',
    'apps/web/app/api/modules/meeting-copilot/transcribe-slice/route.ts',
    'apps/web/app/api/modules/meeting-copilot/prewarm/route.ts',
    'packages/storage/sql/meeting_copilot_v2_chunks.sql',
    'apps/web/lib/meeting-copilot/live-stt.ts',
    'apps/web/lib/meeting-copilot/slice-stt.ts',
    'apps/web/lib/meeting-copilot/chunk-text.ts',
  ]
  for (const f of files) {
    readFileSync(join(root, f), 'utf8')
  }
  console.log('✓ required realtime/RAG files present')
}

{
  const liveStt = readFileSync(join(root, 'apps/web/lib/meeting-copilot/live-stt.ts'), 'utf8')
  assert.match(liveStt, /nova-3/)
  assert.match(liveStt, /interim_results/)

  const slice = readFileSync(join(root, 'apps/web/lib/meeting-copilot/slice-stt.ts'), 'utf8')
  assert.match(slice, /transcribe-slice/)
  assert.match(slice, /AudioWorklet|createScriptProcessor/)

  const view = readFileSync(join(root, 'apps/web/components/modules/MeetingCopilotView.tsx'), 'utf8')
  assert.match(view, /startReveal/)
  assert.match(view, /updateRevealTarget/)
  assert.match(view, /capture\/stream/)
  assert.match(view, /SliceStreamSTT/)
  assert.match(view, /startBatchRecorder|batchModeRef/)
  console.log('✓ three-tier STT + progressive reveal wired')
}

{
  // Streaming must render before the answer completes.
  const view = readFileSync(join(root, 'apps/web/components/modules/MeetingCopilotView.tsx'), 'utf8')
  const partialBlock = view.slice(view.indexOf("evt.type === 'partial'"), view.indexOf("evt.type === 'done'"))
  assert.match(partialBlock, /updateRevealTarget\(tempId, latestPartial\)/)

  const streamRoute = readFileSync(
    join(root, 'apps/web/app/api/modules/meeting-copilot/capture/stream/route.ts'),
    'utf8',
  )
  // First byte must be flushed before session/retrieval reads.
  const metaIdx = streamRoute.indexOf("type: 'meta'")
  const retrievalIdx = streamRoute.indexOf('retrieveMeetingChunks(supabase')
  assert.ok(metaIdx > 0 && retrievalIdx > metaIdx, 'meta must be sent before retrieval')
  console.log('✓ partials render immediately; stream flushes first byte early')
}

console.log('\nAll Meeting Copilot realtime checks passed.')
