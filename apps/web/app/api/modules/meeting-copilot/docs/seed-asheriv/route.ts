import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingChunks, isMissingMeetingCopilotTable } from '@/lib/supabase/errors'
import { replaceDocChunks } from '@/lib/meeting-copilot/retrieve'
import {
  ASHERIV_BRIEF_VERSION,
  ASHERIV_SEED_DOCS,
} from '@/lib/meeting-copilot/asheriv-brief'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/**
 * Upserts the A'SHERIV Master Brief into the knowledge pool + answer templates.
 * Idempotent by seedKey tag (`seed:<key>`). Re-running refreshes content & chunks.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let created = 0
  let updated = 0
  let chunks = 0
  const errors: string[] = []

  for (const doc of ASHERIV_SEED_DOCS) {
    const seedTag = `seed:${doc.seedKey}`
    const tags = [...new Set([...doc.tags, seedTag, `brief:${ASHERIV_BRIEF_VERSION}`])]

    try {
      const { data: existing } = await supabase
        .from('meeting_knowledge_docs')
        .select('id')
        .eq('user_id', user.id)
        .contains('tags', [seedTag])
        .maybeSingle()

      let docId = existing?.id as string | undefined

      if (docId) {
        const { error } = await supabase
          .from('meeting_knowledge_docs')
          .update({
            title: doc.title,
            doc_type: doc.docType,
            tags,
            content_text: doc.content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', docId)
          .eq('user_id', user.id)
        if (error) throw error
        updated += 1
      } else {
        const { data: inserted, error } = await supabase
          .from('meeting_knowledge_docs')
          .insert({
            user_id: user.id,
            title: doc.title,
            doc_type: doc.docType,
            tags,
            content_text: doc.content,
          })
          .select('id')
          .single()
        if (error) throw error
        docId = inserted.id
        created += 1
      }

      try {
        chunks += await replaceDocChunks(supabase, user.id, docId!, doc.content)
      } catch (chunkErr) {
        if (
          chunkErr instanceof Error &&
          isMissingMeetingChunks({ message: chunkErr.message })
        ) {
          // Chunks table not migrated yet — docs still saved.
        } else {
          throw chunkErr
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('answer-template') || message.includes('doc_type')) {
        return NextResponse.json(
          {
            error: 'answer_template_type_missing',
            hint: 'Run packages/storage/sql/meeting_copilot_v3_answer_template.sql in Supabase',
          },
          { status: 503 },
        )
      }
      if (isMissingMeetingCopilotTable({ message })) {
        return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
      }
      errors.push(`${doc.seedKey}: ${message}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    version: ASHERIV_BRIEF_VERSION,
    docs: ASHERIV_SEED_DOCS.length,
    created,
    updated,
    chunks,
    errors,
  })
}
