import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingCopilotTable, isMissingMeetingChunks } from '@/lib/supabase/errors'
import { replaceDocChunks } from '@/lib/meeting-copilot/retrieve'

const DOC_TYPES = new Set([
  'pitch',
  'metrics',
  'faq',
  'strategy',
  'product',
  'competitor',
  'note',
  'answer-template',
])

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meeting_knowledge_docs')
    .select('id, title, doc_type, tags, created_at, updated_at, content_text')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Trim body for list payload — full text stays in DB for reindex/retrieval
  if (data) {
    for (const row of data) {
      const full = String(row.content_text ?? '')
      ;(row as { content_text: string; preview?: string }).preview = full.slice(0, 220)
      row.content_text = full.slice(0, 220)
    }
  }

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ items: [], warning: 'meeting_copilot_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const title = String(body.title ?? 'Untitled').trim() || 'Untitled'
  const docType = String(body.docType ?? 'note')
  const contentText = String(body.content ?? '').trim()
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20)
    : String(body.tags ?? '')
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20)

  if (!contentText) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'invalid docType' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meeting_knowledge_docs')
    .insert({
      user_id: user.id,
      title,
      doc_type: docType,
      tags,
      content_text: contentText,
    })
    .select('id, title, doc_type, tags, content_text, created_at, updated_at')
    .single()

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await replaceDocChunks(supabase, user.id, data.id, contentText)
  } catch (chunkErr) {
    // Doc saved; chunks optional until v2 migration
    if (!(chunkErr instanceof Error && isMissingMeetingChunks({ message: chunkErr.message }))) {
      console.warn('[meeting-copilot] chunk index failed', chunkErr)
    }
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('meeting_knowledge_docs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
