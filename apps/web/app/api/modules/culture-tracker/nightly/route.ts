import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingCultureTrackerTable } from '@/lib/supabase/errors'
import { runCultureScout } from '@/lib/culture-tracker/scout'
import { getAllowedEmail } from '@/lib/auth/allowlist'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/** Auto-generate today's culture scout. Cron: 0 6 * * * UTC (~09:00 Istanbul). */
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let userId: string | null = null
  let locale = 'tr'

  if (isCronAuthorized(request)) {
    const admin = createAdminClient()
    const email = getAllowedEmail()
    const { data } = await admin.auth.admin.listUsers({ perPage: 50 })
    const match = data.users.find((u) => u.email === email)
    userId = match?.id ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Allowlisted user not found' }, { status: 404 })
    }

    try {
      const { generated, issueDate } = await runCultureScout(admin, userId, locale)
      const { error } = await admin.from('culture_tracker_scouts').upsert(
        {
          user_id: userId,
          scout_date: issueDate,
          title: generated.title,
          content_md: generated.contentMd,
          sections: generated.sections,
        },
        { onConflict: 'user_id,scout_date' },
      )

      if (error && isMissingCultureTrackerTable(error)) {
        return NextResponse.json({ warning: 'culture_tracker_table_missing' })
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ ok: true, issueDate, title: generated.title })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Culture scout failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  locale = String(body.locale ?? 'tr')
  userId = user.id

  try {
    const { generated, issueDate } = await runCultureScout(supabase, userId, locale)
    const { data: saved, error } = await supabase
      .from('culture_tracker_scouts')
      .upsert(
        {
          user_id: userId,
          scout_date: issueDate,
          title: generated.title,
          content_md: generated.contentMd,
          sections: generated.sections,
        },
        { onConflict: 'user_id,scout_date' },
      )
      .select('id, scout_date, title')
      .single()

    if (error && isMissingCultureTrackerTable(error)) {
      return NextResponse.json({ warning: 'culture_tracker_table_missing', preview: generated })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, scout: saved })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Culture scout failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
