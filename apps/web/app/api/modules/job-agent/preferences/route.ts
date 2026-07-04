import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'
import { DEFAULT_PREFERENCES, mergeSearchPreferences } from '@/lib/job-agent/types'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('job_search_preferences')
    .select('preferences, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ preferences: DEFAULT_PREFERENCES, warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    preferences: mergeSearchPreferences(
      data?.preferences as Partial<typeof DEFAULT_PREFERENCES> | null | undefined,
    ),
    updatedAt: data?.updated_at ?? null,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const preferences = mergeSearchPreferences(body.preferences)

  const { data, error } = await supabase
    .from('job_search_preferences')
    .upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    })
    .select('preferences, updated_at')
    .single()

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preferences: data.preferences, updatedAt: data.updated_at })
}
