import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingTravelScoutTable } from '@/lib/supabase/errors'
import { runTravelScout } from '@/lib/travel-scout/scout'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const locale = String(body.locale ?? 'en')
  const mode = body.mode === 'random' ? 'random' : 'trip'

  try {
    const result = await runTravelScout(supabase, user.id, {
      mode,
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      locale,
    })

    let planId: string | null = null
    if (mode === 'trip' && body.savePlan !== false) {
      const { data: plan } = await supabase
        .from('travel_scout_plans')
        .insert({
          user_id: user.id,
          destination: result.destination,
          start_date: result.startDate ?? null,
          end_date: result.endDate ?? null,
          notes: body.notes ?? null,
        })
        .select('id')
        .single()
      planId = plan?.id ?? null
    }

    const { data: saved, error } = await supabase
      .from('travel_scout_reports')
      .upsert(
        {
          user_id: user.id,
          destination: result.destination,
          report_key: result.reportKey,
          title: result.generated.title,
          sections: result.generated.sections,
          content_md: result.generated.contentMd,
          plan_id: planId,
        },
        { onConflict: 'user_id,report_key' },
      )
      .select('id, destination, title, sections, content_md, created_at')
      .single()

    if (error) {
      if (isMissingTravelScoutTable(error)) {
        return NextResponse.json({ warning: 'travel_scout_table_missing', preview: result.generated })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: saved, mode: result.mode })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
