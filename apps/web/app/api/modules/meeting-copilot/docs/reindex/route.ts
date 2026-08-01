import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingChunks, isMissingMeetingCopilotTable } from '@/lib/supabase/errors'
import { replaceDocChunks } from '@/lib/meeting-copilot/retrieve'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Rebuild chunks for all (or one) knowledge docs — no re-upload needed. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let docId: string | null = null
  try {
    const body = await request.json()
    docId = body.docId ? String(body.docId) : null
  } catch {
    // empty body ok
  }

  let query = supabase
    .from('meeting_knowledge_docs')
    .select('id, content_text')
    .eq('user_id', user.id)
  if (docId) query = query.eq('id', docId)

  const { data: docs, error } = await query
  if (error) {
    if (isMissingMeetingCopilotTable(error)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let indexed = 0
  let chunks = 0
  const errors: { docId: string; error: string }[] = []

  for (const doc of docs ?? []) {
    try {
      const n = await replaceDocChunks(supabase, user.id, doc.id, String(doc.content_text ?? ''))
      indexed += 1
      chunks += n
    } catch (err) {
      const message = err instanceof Error ? err.message : 'reindex failed'
      if (isMissingMeetingChunks({ message })) {
        return NextResponse.json(
          {
            error: 'meeting_chunks_missing',
            hint: 'Run packages/storage/sql/meeting_copilot_v2_chunks.sql in Supabase',
          },
          { status: 503 },
        )
      }
      errors.push({ docId: doc.id, error: message })
    }
  }

  return NextResponse.json({ indexed, chunks, errors, failed: errors.length })
}
