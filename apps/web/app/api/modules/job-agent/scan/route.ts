import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2, isMissingScoutSkippedTable } from '@/lib/supabase/errors'
import { runDiscoveryForUser } from '@/lib/job-agent/nightly'
import { saveScoutSkippedItems, buildSkippedPreview } from '@/lib/scout/skipped'

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
      result.log.push({ message: `Skipped list DB: ${skippedSaved} rows saved`, level: 'info' })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (isMissingScoutSkippedTable(err as { code?: string; message?: string })) {
        skippedWarning = 'scout_skipped_table_missing'
      } else {
        skippedWarning = 'scout_skipped_save_failed'
        result.log.push({ message: `Skipped list DB: save failed — ${errMsg}`, level: 'error' })
      }
    }
  }

  const skippedPreview = buildSkippedPreview(result.skipped)
  const clientPayload = {
    jobsScanned: result.jobsScanned,
    packsCreated: result.packsCreated,
    log: result.log,
    skippedSaved,
    skippedPreview,
    skippedCount: result.skipped.length,
  }

  if (runError) {
    if (isMissingJobAgentV2(runError)) {
      return NextResponse.json({
        ...clientPayload,
        warning: 'job_agent_v2_missing',
        warnings: skippedWarning ? [skippedWarning] : [],
      })
    }
    return NextResponse.json({
      ...clientPayload,
      warning: 'job_agent_run_save_failed',
      error: runError.message,
    })
  }

  return NextResponse.json({
    run,
    ...clientPayload,
    warning: skippedWarning,
    warnings: skippedWarning ? [skippedWarning] : [],
  })
}
