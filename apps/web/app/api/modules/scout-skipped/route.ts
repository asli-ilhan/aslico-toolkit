import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingScoutSkippedTable } from '@/lib/supabase/errors'
import { listScoutSkippedItems, type ScoutModuleId } from '@/lib/scout/skipped'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const moduleId = request.nextUrl.searchParams.get('module') as ScoutModuleId | null
  if (!moduleId || !['funding-scout', 'job-agent'].includes(moduleId)) {
    return NextResponse.json({ error: 'module query required (funding-scout | job-agent)' }, { status: 400 })
  }

  try {
    const items = await listScoutSkippedItems(supabase, user.id, moduleId)
    return NextResponse.json({ items })
  } catch (error) {
    if (isMissingScoutSkippedTable(error as { code?: string; message?: string })) {
      return NextResponse.json({ items: [], warning: 'scout_skipped_table_missing' })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}
