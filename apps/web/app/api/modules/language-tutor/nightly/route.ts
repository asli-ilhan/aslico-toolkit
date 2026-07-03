import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { generateTodayLesson } from '@/lib/language-tutor/lesson'
import { runErrorAnalysis } from '@/lib/language-tutor/errors-analyzer'
import { getAllowedEmail } from '@/lib/auth/allowlist'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/** Auto-generate today's lesson. Cron: 0 4 * * * UTC (~07:00 Istanbul). */
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
      const result = await generateTodayLesson(admin, userId, locale)
      if (result.restDay) {
        return NextResponse.json({ ok: true, restDay: true })
      }
      const analysis = await runErrorAnalysis(admin, userId)
      return NextResponse.json({
        ok: true,
        language: result.language,
        programDay: result.programDay,
        topic: result.lesson?.topic,
        errorAnalysis: analysis,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lesson generation failed'
      if (isMissingLanguageTutorTable({ message: msg })) {
        return NextResponse.json({ warning: 'language_tutor_table_missing' })
      }
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
    const result = await generateTodayLesson(supabase, userId, locale)
    if (result.restDay) {
      return NextResponse.json({ ok: true, restDay: true })
    }
    return NextResponse.json({
      ok: true,
      language: result.language,
      programDay: result.programDay,
      lesson: result.lesson,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lesson generation failed'
    if (isMissingLanguageTutorTable({ message: msg })) {
      return NextResponse.json({ warning: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
