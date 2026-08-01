import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingMeetingChunks } from '@/lib/supabase/errors'
import { chunkKnowledgeText } from '@/lib/meeting-copilot/chunk-text'
import { normalizeMeetingQuery } from '@/lib/meeting-copilot/normalize-query'

export interface RetrievedChunk {
  chunk_id: string
  doc_id: string
  title: string
  doc_type: string
  content_text: string
  score: number
}

const MAX_CORPUS_CHARS = 9000
const MAX_PER_DOC_CHARS = 2000
const MAX_TEMPLATE_CHARS = 5500

export function buildCorpusFromChunks(chunks: RetrievedChunk[]): string {
  const used = new Map<string, number>()
  const parts: string[] = []
  let total = 0

  for (const c of chunks) {
    // Answer templates are injected separately — never monopolize RAG slots.
    if (c.doc_type === 'answer-template') continue
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

/** Always-on Q&A / hard-rule templates — not RAG-scored. */
export async function loadAnswerTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('meeting_knowledge_docs')
    .select('title, content_text, updated_at')
    .eq('user_id', userId)
    .eq('doc_type', 'answer-template')
    .order('updated_at', { ascending: false })
    .limit(6)

  if (error || !data?.length) return ''

  const parts: string[] = []
  let total = 0
  for (const row of data) {
    const room = MAX_TEMPLATE_CHARS - total
    if (room <= 80) break
    const body = String(row.content_text ?? '').slice(0, room)
    parts.push(`### ${row.title}\n${body}`)
    total += body.length + 20
  }
  return parts.join('\n\n')
}

export async function retrieveMeetingChunks(
  supabase: SupabaseClient,
  userId: string,
  question: string,
  tagFilter: string[],
): Promise<{ chunks: RetrievedChunk[]; emptyBecauseTags: boolean; usedFallback: boolean }> {
  const { data, error } = await supabase.rpc('search_meeting_knowledge', {
    p_user_id: userId,
    p_query: normalizeMeetingQuery(question) || question,
    p_tags: tagFilter,
    p_limit: 12,
  })

  if (error) {
    if (isMissingMeetingChunks(error)) {
      const { data: docs } = await supabase
        .from('meeting_knowledge_docs')
        .select('id, title, doc_type, tags, content_text')
        .eq('user_id', userId)
        .neq('doc_type', 'answer-template')
        .order('updated_at', { ascending: false })
        .limit(12)
      let list = docs ?? []
      if (tagFilter.length) {
        const filtered = list.filter((d) => (d.tags ?? []).some((t: string) => tagFilter.includes(t)))
        if (!filtered.length) return { chunks: [], emptyBecauseTags: true, usedFallback: true }
        list = filtered
      }
      const chunks: RetrievedChunk[] = list.map((d, i) => ({
        chunk_id: d.id,
        doc_id: d.id,
        title: d.title,
        doc_type: d.doc_type,
        content_text: String(d.content_text ?? '').slice(0, 1500),
        score: 1 - i * 0.01,
      }))
      return { chunks, emptyBecauseTags: false, usedFallback: true }
    }
    throw new Error(error.message)
  }

  const chunks = ((data ?? []) as RetrievedChunk[])
    .map((c) => ({
      ...c,
      score: Number(c.score ?? 0),
    }))
    .filter((c) => c.doc_type !== 'answer-template')

  if (chunks.length) return { chunks, emptyBecauseTags: false, usedFallback: false }

  if (tagFilter.length) {
    return { chunks: [], emptyBecauseTags: true, usedFallback: false }
  }

  const { data: recent } = await supabase
    .from('meeting_knowledge_chunks')
    .select('id, doc_id, content_text, meeting_knowledge_docs(title, doc_type)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12)

  const fallback: RetrievedChunk[] = (recent ?? [])
    .map((row: Record<string, unknown>, i) => {
      const doc = row.meeting_knowledge_docs as { title?: string; doc_type?: string } | null
      return {
        chunk_id: String(row.id),
        doc_id: String(row.doc_id),
        title: doc?.title ?? 'Doc',
        doc_type: doc?.doc_type ?? 'note',
        content_text: String(row.content_text ?? ''),
        score: 0.05 - i * 0.001,
      }
    })
    .filter((c) => c.doc_type !== 'answer-template')
    .slice(0, 8)
  return { chunks: fallback, emptyBecauseTags: false, usedFallback: true }
}

export async function replaceDocChunks(
  supabase: SupabaseClient,
  userId: string,
  docId: string,
  fullText: string,
): Promise<number> {
  await supabase.from('meeting_knowledge_chunks').delete().eq('doc_id', docId).eq('user_id', userId)
  const pieces = chunkKnowledgeText(fullText)
  if (!pieces.length) return 0
  const rows = pieces.map((content_text, chunk_index) => ({
    doc_id: docId,
    user_id: userId,
    chunk_index,
    content_text,
  }))
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40)
    const { error } = await supabase.from('meeting_knowledge_chunks').insert(batch)
    if (error) throw new Error(error.message)
  }
  return pieces.length
}
