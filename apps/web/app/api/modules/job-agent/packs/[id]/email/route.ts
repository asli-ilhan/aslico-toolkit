import { NextResponse, type NextRequest } from 'next/server'
import { generateEmailDraft, type MasterProfileData } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  const { data: pack, error } = await supabase
    .from('application_packs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 })

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('master_profile')
    .eq('user_id', user.id)
    .maybeSingle()

  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile) {
    return NextResponse.json({ error: 'Master profile required' }, { status: 400 })
  }

  try {
    const emailDraft = await generateEmailDraft(
      masterProfile,
      {
        company: pack.company,
        role: pack.role,
        jobDescription: pack.job_description ?? '',
        jobUrl: pack.job_url ?? undefined,
      },
      pack.cover_letter ?? '',
      user.email ?? undefined,
    )

    await supabase
      .from('application_packs')
      .update({ email_draft: emailDraft, updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ emailDraft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email draft failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
