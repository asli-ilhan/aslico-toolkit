import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable, isMissingScoutSkippedTable } from '@/lib/supabase/errors'
import { runFundingScan } from '@/lib/funding-scout/scan'
import { saveScoutSkippedItems, buildSkippedPreview } from '@/lib/scout/skipped'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST() {
  const started = new Date().toISOString()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runFundingScan(supabase, user.id)

  const { data: runRow, error: runError } = await supabase.from('funding_scout_runs').insert({
    user_id: user.id,
    started_at: started,
    finished_at: new Date().toISOString(),
    opportunities_scanned: result.opportunitiesScanned,
    packs_created: result.packsCreated,
    regions_scanned: result.regionsScanned,
    log: result.log,
  }).select('id').single()

  let skippedSaved = 0
  let skippedWarning: string | undefined
  if (result.skipped.length) {
    try {
      skippedSaved = await saveScoutSkippedItems(supabase, user.id, runRow?.id ?? null, result.skipped)
      result.log.push({
        message: `Skipped list DB: ${skippedSaved} rows saved`,
        level: 'info',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (isMissingScoutSkippedTable(err as { code?: string; message?: string })) {
        skippedWarning = 'scout_skipped_table_missing'
        result.log.push({
          message: 'Skipped list DB: table missing — run scout_skipped.sql (showing this scan in UI anyway)',
          level: 'warn',
        })
      } else {
        skippedWarning = 'scout_skipped_save_failed'
        result.log.push({
          message: `Skipped list DB: save failed — ${errMsg}`,
          level: 'error',
        })
      }
    }
  }

  const skippedPreview = buildSkippedPreview(result.skipped)

  const clientPayload = {
    opportunitiesScanned: result.opportunitiesScanned,
    packsCreated: result.packsCreated,
    candidatesNew: result.candidatesNew,
    candidatesDuplicate: result.candidatesDuplicate,
    regionsScanned: result.regionsScanned,
    log: result.log,
    skippedSaved,
    skippedPreview,
    skippedCount: result.skipped.length,
  }

  if (runError && isMissingFundingScoutTable(runError)) {
    return NextResponse.json({
      ...clientPayload,
      warning: 'funding_scout_table_missing',
      warnings: skippedWarning ? [skippedWarning] : [],
    })
  }

  return NextResponse.json({
    ...clientPayload,
    warning: skippedWarning,
    warnings: skippedWarning ? [skippedWarning] : [],
  })
}
