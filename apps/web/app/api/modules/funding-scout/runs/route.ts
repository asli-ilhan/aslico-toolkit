import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingFundingScoutTable } from '@/lib/supabase/errors'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('funding_scout_runs')
    .select('id, started_at, finished_at, opportunities_scanned, packs_created, regions_scanned, log')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingFundingScoutTable(error)) {
      return NextResponse.json({ items: [], warning: 'funding_scout_table_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
