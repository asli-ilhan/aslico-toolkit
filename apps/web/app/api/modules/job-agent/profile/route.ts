import { NextResponse } from 'next/server'
import {
  buildMasterProfile,
  buildProfileVariants,
  profileNeedsAsherivSanitizeSave,
  sanitizeMasterProfile,
  type MasterProfileData,
} from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error } = await supabase
      .from('candidate_profiles')
      .select('master_profile, profile_variants, voice_samples, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      if (isMissingJobAgentV2(error)) {
        return NextResponse.json({ profile: null, warning: 'job_agent_v2_missing' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let masterProfile: MasterProfileData | null = null
    if (profile?.master_profile) {
      const raw = profile.master_profile as Partial<MasterProfileData>
      masterProfile = sanitizeMasterProfile(raw)

      // Only persist when scrubbing Asheriv — never overwrite on shape normalization alone.
      if (profileNeedsAsherivSanitizeSave(raw)) {
        await supabase
          .from('candidate_profiles')
          .update({
            master_profile: masterProfile,
            voice_samples: masterProfile.voiceSamples,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
    }

    const { data: docs, error: docsError } = await supabase
      .from('candidate_documents')
      .select('id, filename, doc_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (docsError && isMissingJobAgentV2(docsError)) {
      return NextResponse.json({
        profile: masterProfile,
        profileVariants: profile?.profile_variants ?? null,
        voiceSamples: masterProfile?.voiceSamples ?? [],
        updatedAt: profile?.updated_at ?? null,
        documents: [],
        warning: 'job_agent_v2_missing',
      })
    }

    return NextResponse.json({
      profile: masterProfile,
      profileVariants: profile?.profile_variants ?? null,
      voiceSamples: masterProfile?.voiceSamples ?? profile?.voice_samples ?? [],
      updatedAt: profile?.updated_at ?? null,
      documents: docs ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile load failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
    }

    const { data: documents, error: docsError } = await supabase
      .from('candidate_documents')
      .select('filename, doc_type, content_text')
      .eq('user_id', user.id)

    if (docsError) {
      if (isMissingJobAgentV2(docsError)) {
        return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
      }
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    if (!documents?.length) {
      return NextResponse.json({ error: 'Upload at least one document first' }, { status: 400 })
    }

    const masterProfile = await buildMasterProfile(
      documents.map((d) => ({
        filename: d.filename,
        docType: d.doc_type,
        content: d.content_text,
      })),
    )

    const { error: saveError } = await supabase.from('candidate_profiles').upsert({
      user_id: user.id,
      master_profile: masterProfile,
      voice_samples: masterProfile.voiceSamples,
      updated_at: new Date().toISOString(),
    })

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    let profileVariants = null
    try {
      profileVariants = await buildProfileVariants(masterProfile)
      await supabase
        .from('candidate_profiles')
        .update({ profile_variants: profileVariants })
        .eq('user_id', user.id)
    } catch {
      /* variants optional */
    }

    return NextResponse.json({ profile: masterProfile, profileVariants })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile build failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
