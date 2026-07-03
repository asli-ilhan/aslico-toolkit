import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'
import { getSeedDocuments, getSeedWatchlistItems } from '@/lib/job-agent/seed-data'

/** Import CV, cover letter, and maritime careers URLs from bundled seed data. */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const docs = getSeedDocuments()
    let documentsAdded = 0
    let documentsSkipped = 0

    for (const doc of docs) {
      const { data: existing } = await supabase
        .from('candidate_documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('filename', doc.filename)
        .maybeSingle()

      if (existing) {
        documentsSkipped++
        continue
      }

      const { error } = await supabase.from('candidate_documents').insert({
        user_id: user.id,
        filename: doc.filename,
        doc_type: doc.docType,
        content_text: doc.content,
      })

      if (error) {
        if (isMissingJobAgentV2(error)) {
          return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      documentsAdded++
    }

    const watchlistItems = getSeedWatchlistItems()
    let watchlistAdded = 0
    let watchlistSkipped = 0

    const { data: existingWatch } = await supabase
      .from('job_watchlist')
      .select('value')
      .eq('user_id', user.id)

    const existingUrls = new Set((existingWatch ?? []).map((w) => w.value))

    for (const item of watchlistItems) {
      if (existingUrls.has(item.value)) {
        watchlistSkipped++
        continue
      }
      const { error } = await supabase.from('job_watchlist').insert({
        user_id: user.id,
        kind: item.kind,
        value: item.value,
        label: item.label,
        enabled: true,
      })
      if (error) {
        if (isMissingJobAgentV2(error)) {
          return NextResponse.json({ error: 'job_agent_v3_missing' }, { status: 503 })
        }
        continue
      }
      watchlistAdded++
      existingUrls.add(item.value)
    }

    return NextResponse.json({
      ok: true,
      documentsAdded,
      documentsSkipped,
      watchlistAdded,
      watchlistSkipped,
      message: 'Seed imported. Now click Build master profile.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
