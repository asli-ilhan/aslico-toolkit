import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingCalendarV2 } from '@/lib/supabase/errors'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const startDate = from?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const end = new Date()
  end.setDate(end.getDate() + 60)
  const endDate = to?.slice(0, 10) ?? end.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('calendar_todos')
    .select('id, due_date, title, done, created_at')
    .eq('user_id', user.id)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingCalendarV2(error)) {
      return NextResponse.json({ todos: [], warning: 'calendar_v2_missing' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ todos: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const dueDate = String(body.due_date ?? '').slice(0, 10)

  if (!title || !dueDate) {
    return NextResponse.json({ error: 'title and due_date required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('calendar_todos')
    .insert({
      user_id: user.id,
      title,
      due_date: dueDate,
      done: false,
      updated_at: new Date().toISOString(),
    })
    .select('id, due_date, title, done, created_at')
    .single()

  if (error) {
    if (isMissingCalendarV2(error)) {
      return NextResponse.json({ warning: 'calendar_v2_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ todo: data })
}
