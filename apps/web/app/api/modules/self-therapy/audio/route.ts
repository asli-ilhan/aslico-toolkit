import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: session } = await supabase
    .from('self_therapy_sessions')
    .select('audio_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session?.audio_path) {
    return NextResponse.json({ error: 'No audio' }, { status: 404 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('self-therapy-audio')
      .createSignedUrl(session.audio_path, 3600)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 })
    }
    return NextResponse.json({ audioUrl: data.signedUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
