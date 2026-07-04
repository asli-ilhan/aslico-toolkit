import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable } from '@/lib/supabase/errors'
import { runFundingScan } from '@/lib/funding-scout/scan'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST() {
  const started = new Date().toISOString()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runFundingScan(supabase, user.id)

  const { error: runError } = await supabase.from('funding_scout_runs').insert({
    user_id: user.id,
    started_at: started,
    finished_at: new Date().toISOString(),
    opportunities_scanned: result.opportunitiesScanned,
    packs_created: result.packsCreated,
    regions_scanned: result.regionsScanned,
    log: result.log,
  })

  if (runError && isMissingFundingScoutTable(runError)) {
    return NextResponse.json({ ...result, warning: 'funding_scout_table_missing' })
  }

  return NextResponse.json(result)
}
