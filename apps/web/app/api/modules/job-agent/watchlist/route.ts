import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('job_watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ items: [], warning: error.message })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const kind = String(body.kind ?? 'url')
  const value = String(body.value ?? '').trim()
  const label = body.label ? String(body.label) : null

  if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 })

  const { data, error } = await supabase
    .from('job_watchlist')
    .insert({ user_id: user.id, kind, value, label, enabled: true })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
