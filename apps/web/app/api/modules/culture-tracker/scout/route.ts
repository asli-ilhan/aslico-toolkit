import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'
import { runCultureScout } from '@/lib/culture-tracker/scout'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const locale = String(body.locale ?? 'en')

  try {
    const { generated, issueDate } = await runCultureScout(supabase, user.id, locale)

    const { data: saved, error } = await supabase
      .from('culture_tracker_scouts')
      .upsert(
        {
          user_id: user.id,
          scout_date: issueDate,
          title: generated.title,
          content_md: generated.contentMd,
          sections: generated.sections,
        },
        { onConflict: 'user_id,scout_date' },
      )
      .select('id, scout_date, title, content_md, sections, created_at')
      .single()

    if (error) {
      if (isMissingCultureTrackerTable(error)) {
        return NextResponse.json({ warning: 'culture_tracker_table_missing', preview: generated })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ scout: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
