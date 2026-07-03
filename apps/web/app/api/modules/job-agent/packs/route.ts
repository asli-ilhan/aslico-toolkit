import { NextResponse, type NextRequest } from 'next/server'
import { generateApplicationPack, scoreJobFit, type MasterProfileData } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'
import {
  adjustFitScore,
  computeDomainFit,
  detectAiRisk,
  isCompanyExcluded,
  type SearchPreferences,
  DEFAULT_PREFERENCES,
  defaultFollowUpDate,
} from '@/lib/job-agent/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status')

  let query = supabase
    .from('application_packs')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ items: [], warning: 'job_agent_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  const body = await request.json()
  const company = String(body.company ?? '').trim()
  const role = String(body.role ?? '').trim()
  const jobDescription = String(body.jobDescription ?? '').trim()
  const jobUrl = body.jobUrl ? String(body.jobUrl) : null
  const remoteType = body.remoteType ? String(body.remoteType) : null
  const employmentType = body.employmentType ? String(body.employmentType) : null
  const locale = String(body.locale ?? 'en')
  const profileVariant = String(body.profileVariant ?? 'default')
  const deadlineAt = body.deadlineAt ? String(body.deadlineAt) : null
  const status = 'pending_review'

  if (!company || !role || !jobDescription) {
    return NextResponse.json({ error: 'company, role, jobDescription required' }, { status: 400 })
  }

  const { data: prefsRow } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle()

  const preferences: SearchPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(prefsRow?.preferences as Partial<SearchPreferences> | null),
  }

  if (isCompanyExcluded(company, preferences.excludeCompanies)) {
    return NextResponse.json({ error: 'Company is on your blocklist' }, { status: 400 })
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('candidate_profiles')
    .select('master_profile, profile_variants')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError && isMissingJobAgentV2(profileError)) {
    return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
  }

  const masterProfile = profileRow?.master_profile as MasterProfileData | null
  if (!masterProfile?.evidence?.length && !masterProfile?.summary) {
    return NextResponse.json(
      { error: 'Build your master profile first (Profile tab)' },
      { status: 400 },
    )
  }

  const variants = (profileRow?.profile_variants ?? {}) as Record<
    string,
    { summary?: string }
  >
  const variantSummary =
    profileVariant !== 'default' ? variants[profileVariant]?.summary : undefined

  try {
    const job = {
      company,
      role,
      jobDescription,
      jobUrl: jobUrl ?? undefined,
      remoteType: remoteType ?? undefined,
      employmentType: employmentType ?? undefined,
      locale,
    }

    const domainFit = computeDomainFit(
      jobDescription,
      masterProfile.domains ?? preferences.domains,
      preferences.domainWeights,
    )

    let fit = await scoreJobFit(masterProfile, job)
    fit.score = adjustFitScore(fit.score, domainFit, preferences)

    const pack = await generateApplicationPack(
      masterProfile,
      job,
      preferences,
      variantSummary,
    )
    const risk = detectAiRisk(company, jobUrl)

    const row = {
      user_id: user.id,
      company,
      role,
      job_url: jobUrl,
      job_description: jobDescription,
      remote_type: remoteType,
      employment_type: employmentType,
      fit_score: fit.score,
      fit_reason: fit.reason,
      domain_fit: domainFit,
      ai_risk_level: risk.level,
      ai_risk_reason: risk.reason,
      auto_submit_blocked: risk.autoSubmitBlocked,
      tailored_cv: pack.tailoredCv,
      cover_letter: pack.coverLetter,
      evidence_used: pack.evidenceUsed,
      profile_variant: profileVariant,
      deadline_at: deadlineAt,
      follow_up_at: defaultFollowUpDate(),
      status,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error: saveError } = await supabase
      .from('application_packs')
      .insert(row)
      .select('*')
      .single()

    if (saveError) {
      if (isMissingJobAgentV2(saveError)) {
        return NextResponse.json({
          ...pack,
          fit,
          risk,
          warning: 'job_agent_v2_missing',
        })
      }
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({ item: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pack generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
