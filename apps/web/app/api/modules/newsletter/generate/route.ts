import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingNewsletterTable } from '@/lib/supabase/errors'
import { buildNewsletterIssueForUser } from '@/lib/newsletter/generate'

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
    const { generated, issueDate } = await buildNewsletterIssueForUser(
      supabase,
      user.id,
      locale,
    )

    const { data: saved, error } = await supabase
      .from('newsletter_issues')
      .upsert(
        {
          user_id: user.id,
          issue_date: issueDate,
          title: generated.title,
          content_md: generated.contentMd,
          sections: generated.sections,
        },
        { onConflict: 'user_id,issue_date' },
      )
      .select('id, issue_date, title, content_md, sections, created_at')
      .single()

    if (error) {
      if (isMissingNewsletterTable(error)) {
        return NextResponse.json({
          warning: 'newsletter_table_missing',
          preview: generated,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ issue: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
