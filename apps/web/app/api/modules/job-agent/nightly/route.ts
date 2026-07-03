import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'
import { runNightlyForUser } from '@/lib/job-agent/nightly'
import { getAllowedEmail } from '@/lib/auth/allowlist'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/** Nightly job discovery + pack generation. Cron: POST with Authorization: Bearer CRON_SECRET */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const started = new Date().toISOString()
  let userId: string | null = null

  if (isCronAuthorized(request)) {
    const admin = createAdminClient()
    const email = getAllowedEmail()
    const { data } = await admin.auth.admin.listUsers({ perPage: 50 })
    const match = data.users.find((u) => u.email === email)
    userId = match?.id ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Allowlisted user not found' }, { status: 404 })
    }

    const supabase = admin
    const result = await runNightlyForUser(supabase, userId)

    await supabase.from('job_agent_runs').insert({
      user_id: userId,
      started_at: started,
      finished_at: new Date().toISOString(),
      jobs_scanned: result.jobsScanned,
      packs_created: result.packsCreated,
      log: result.log,
    })

    return NextResponse.json(result)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  userId = user.id
  const result = await runNightlyForUser(supabase, userId)

  const { data: run, error: runError } = await supabase
    .from('job_agent_runs')
    .insert({
      user_id: userId,
      started_at: started,
      finished_at: new Date().toISOString(),
      jobs_scanned: result.jobsScanned,
      packs_created: result.packsCreated,
      log: result.log,
    })
    .select('*')
    .single()

  if (runError) {
    if (isMissingJobAgentV2(runError)) {
      return NextResponse.json({ ...result, warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: runError.message }, { status: 500 })
  }

  return NextResponse.json({ run, ...result })
}
