import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'

/** Remove documents whose filename contains "test" (case-insensitive). */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('candidate_documents')
    .delete()
    .eq('user_id', user.id)
    .ilike('filename', '%test%')
    .select('id, filename')

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: data ?? [] })
}
