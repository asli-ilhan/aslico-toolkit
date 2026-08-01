import { NextResponse } from 'next/server'
import { classifyKnowledgeDoc } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingChunks, isMissingMeetingCopilotTable } from '@/lib/supabase/errors'
import {
  extractKnowledgeText,
  isSupportedKnowledgeFile,
} from '@/lib/meeting-copilot/extract-text'
import { replaceDocChunks } from '@/lib/meeting-copilot/retrieve'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const MAX_FILES = 12
const MAX_BYTES = 15 * 1024 * 1024
const CONCURRENCY = 3

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) {
    return NextResponse.json({ error: 'files required' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `max ${MAX_FILES} files` }, { status: 400 })
  }

  const items: unknown[] = []
  const errors: { filename: string; error: string }[] = []

  await mapPool(files, CONCURRENCY, async (file) => {
    const filename = file.name || 'upload.bin'
    try {
      if (file.size > MAX_BYTES) {
        throw new Error(`File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`)
      }
      if (!isSupportedKnowledgeFile(filename, file.type)) {
        throw new Error('Unsupported type — use PDF, PPTX, DOCX, TXT, MD')
      }
      const buffer = await file.arrayBuffer()
      const { text, kind } = await extractKnowledgeText(buffer, filename, file.type)

      let title = filename.replace(/\.[^.]+$/, '')
      let docType: string = kind === 'pptx' || kind === 'pdf' ? 'pitch' : 'note'
      let tags: string[] = [kind]

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const meta = await classifyKnowledgeDoc(filename, text)
          title = meta.title
          docType = meta.docType
          tags = Array.from(new Set([...meta.tags, kind])).slice(0, 10)
        } catch {
          // keep filename-based defaults
        }
      }

      const { data, error } = await supabase
        .from('meeting_knowledge_docs')
        .insert({
          user_id: user.id,
          title,
          doc_type: docType,
          tags,
          content_text: text,
        })
        .select('id, title, doc_type, tags, content_text, created_at, updated_at')
        .single()

      if (error) {
        if (isMissingMeetingCopilotTable(error)) {
          throw new Error('meeting_copilot_table_missing')
        }
        throw new Error(error.message)
      }

      try {
        await replaceDocChunks(supabase, user.id, data.id, text)
      } catch (chunkErr) {
        const message = chunkErr instanceof Error ? chunkErr.message : 'chunk failed'
        if (!isMissingMeetingChunks({ message })) {
          // Doc saved; chunking optional until SQL migration
          console.warn('chunk index failed', message)
        }
      }

      items.push(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      if (message === 'meeting_copilot_table_missing') {
        errors.push({ filename, error: message })
        return
      }
      errors.push({ filename, error: message })
    }
  })

  if (errors.some((e) => e.error === 'meeting_copilot_table_missing') && !items.length) {
    return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
  }

  return NextResponse.json({
    items,
    errors,
    uploaded: items.length,
    failed: errors.length,
  })
}
