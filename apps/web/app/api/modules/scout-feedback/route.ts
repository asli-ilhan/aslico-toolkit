import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingScoutScopeFeedbackTable } from '@/lib/supabase/errors'
import { saveScoutScopeFeedback, type ScoutFeedbackAction } from '@/lib/scout/scope-feedback'
import type { ScoutModuleId } from '@/lib/scout/skipped'

const ACTIONS = new Set<ScoutFeedbackAction>(['dismiss', 'skip', 'reject', 'delete'])
const MODULES = new Set<ScoutModuleId>(['funding-scout', 'job-agent'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const moduleId = String(body.moduleId ?? '') as ScoutModuleId
  const action = String(body.action ?? '') as ScoutFeedbackAction
  const title = String(body.title ?? '').trim()
  const feedback = String(body.feedback ?? '').trim()

  if (!MODULES.has(moduleId)) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 })
  }
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!feedback) return NextResponse.json({ error: 'feedback required' }, { status: 400 })

  try {
    const result = await saveScoutScopeFeedback(supabase, user.id, {
      moduleId,
      action,
      title,
      subtitle: body.subtitle ? String(body.subtitle) : null,
      itemUrl: body.itemUrl ? String(body.itemUrl) : null,
      skipCategory: body.skipCategory ? String(body.skipCategory) : null,
      feedback,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (isMissingScoutScopeFeedbackTable(e)) {
      return NextResponse.json({ error: 'scout_scope_feedback_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: e.message ?? 'Save failed' }, { status: 500 })
  }
}
