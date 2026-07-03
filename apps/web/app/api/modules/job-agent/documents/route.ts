import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingJobAgentV2 } from '@/lib/supabase/errors'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('candidate_documents')
    .select('id, filename, doc_type, content_text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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

  const body = await request.json()
  const filename = String(body.filename ?? 'document.txt').trim()
  const docType = String(body.docType ?? 'cv')
  const contentText = String(body.content ?? '').trim()

  if (!contentText) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('candidate_documents')
    .insert({
      user_id: user.id,
      filename,
      doc_type: docType,
      content_text: contentText,
    })
    .select('id, filename, doc_type, created_at')
    .single()

  if (error) {
    if (isMissingJobAgentV2(error)) {
      return NextResponse.json({ error: 'job_agent_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
