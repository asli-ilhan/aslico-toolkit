import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingNewsletterTable } from '@/lib/supabase/errors'
import { buildNewsletterIssueForUser } from '@/lib/newsletter/generate'
import { getAllowedEmail } from '@/lib/auth/allowlist'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/** Daily newsletter refresh. Cron: 0 5 * * * UTC (~08:00 Istanbul). */
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let userId: string | null = null
  let locale = 'en'

  if (isCronAuthorized(request)) {
    const admin = createAdminClient()
    const email = getAllowedEmail()
    const { data } = await admin.auth.admin.listUsers({ perPage: 50 })
    const match = data.users.find((u) => u.email === email)
    userId = match?.id ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Allowlisted user not found' }, { status: 404 })
    }

    const { generated, issueDate } = await buildNewsletterIssueForUser(admin, userId, locale)
    const { error } = await admin.from('newsletter_issues').upsert(
      {
        user_id: userId,
        issue_date: issueDate,
        title: generated.title,
        content_md: generated.contentMd,
        sections: generated.sections,
      },
      { onConflict: 'user_id,issue_date' },
    )

    if (error && isMissingNewsletterTable(error)) {
      return NextResponse.json({ warning: 'newsletter_table_missing' })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      issueDate,
      headlineCount: generated.sections.headlines.length,
      topicCount: generated.sections.topicSections.length,
    })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  locale = String(body.locale ?? 'en')
  userId = user.id

  const { generated, issueDate } = await buildNewsletterIssueForUser(supabase, userId, locale)
  const { error } = await supabase.from('newsletter_issues').upsert(
    {
      user_id: userId,
      issue_date: issueDate,
      title: generated.title,
      content_md: generated.contentMd,
      sections: generated.sections,
    },
    { onConflict: 'user_id,issue_date' },
  )

  if (error && isMissingNewsletterTable(error)) {
    return NextResponse.json({ warning: 'newsletter_table_missing', preview: generated })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    issueDate,
    headlineCount: generated.sections.headlines.length,
    topicCount: generated.sections.topicSections.length,
  })
}
