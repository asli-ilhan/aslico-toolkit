import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable } from '@/lib/supabase/errors'
import { DEFAULT_FUNDING_SETTINGS, mergeFundingSettings } from '@/lib/funding-scout/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('funding_scout_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error && isMissingFundingScoutTable(error)) {
    return NextResponse.json({ settings: DEFAULT_FUNDING_SETTINGS, warning: 'funding_scout_table_missing' })
  }

  const settings = mergeFundingSettings(
    data ? {
      regions: data.regions,
      fundingTypes: data.funding_types,
      disciplines: data.disciplines,
      requireFullFunding: data.require_full_funding,
      scanDepth: data.scan_depth,
      citizenship: data.citizenship,
      phdStage: data.phd_stage,
    } : null,
  )

  return NextResponse.json({ settings })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const s = mergeFundingSettings(body.settings)

  const { error } = await supabase.from('funding_scout_settings').upsert({
    user_id: user.id,
    regions: s.regions,
    funding_types: s.fundingTypes,
    disciplines: s.disciplines,
    require_full_funding: s.requireFullFunding,
    scan_depth: s.scanDepth,
    citizenship: s.citizenship,
    phd_stage: s.phdStage,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    if (isMissingFundingScoutTable(error)) {
      return NextResponse.json({ error: 'funding_scout_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: s })
}
