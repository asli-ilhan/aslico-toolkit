import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2, isMissingScoutSkippedTable } from '@/lib/supabase/errors'
import { runDiscoveryForUser } from '@/lib/job-agent/nightly'
import { saveScoutSkippedItems } from '@/lib/scout/skipped'

/** Manual job discovery — user starts/stops from the UI. No schedule required. */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST() {
  const started = new Date().toISOString()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runDiscoveryForUser(supabase, user.id, { trigger: 'manual' })

  const { data: run, error: runError } = await supabase
    .from('job_agent_runs')
    .insert({
      user_id: user.id,
      started_at: started,
      finished_at: new Date().toISOString(),
      jobs_scanned: result.jobsScanned,
      packs_created: result.packsCreated,
      log: result.log,
    })
    .select('*')
    .single()

  let skippedSaved = 0
  let skippedWarning: string | undefined
  if (result.skipped.length) {
    try {
      skippedSaved = await saveScoutSkippedItems(supabase, user.id, run?.id ?? null, result.skipped)
    } catch (err) {
      if (isMissingScoutSkippedTable(err as { code?: string; message?: string })) {
        skippedWarning = 'scout_skipped_table_missing'
      }
    }
  }

  if (runError) {
    if (isMissingJobAgentV2(runError)) {
      return NextResponse.json({ ...result, skippedSaved, warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: runError.message }, { status: 500 })
  }

  return NextResponse.json({ run, ...result, skippedSaved, warning: skippedWarning })
}
