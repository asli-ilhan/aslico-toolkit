import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchImmersionDone,
  saveImmersionDone,
} from '@/lib/language-tutor/immersion'
import type { ImmersionDoneMap } from '@/lib/language-tutor/immersion-pool'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const language = body.language as TutorLanguage
  const kind = body.kind === 'book' ? 'book' : 'film'
  const title = String(body.title ?? '').trim()
  if (!language || !title) {
    return NextResponse.json({ error: 'language and title required' }, { status: 400 })
  }

  const done = await fetchImmersionDone(supabase, user.id)
  const langDone = { ...(done[language] ?? {}) }
  const key = kind === 'book' ? 'books' : 'films'
  const list = new Set(langDone[key] ?? [])
  list.add(title)
  langDone[key] = [...list]
  const next: ImmersionDoneMap = { ...done, [language]: langDone }

  const saved = await saveImmersionDone(supabase, user.id, next)
  if (!saved.ok) {
    // Client can still persist via localStorage; return the map anyway.
    return NextResponse.json({
      done: next,
      persisted: false,
      warning: saved.error,
    })
  }

  return NextResponse.json({ done: next, persisted: true })
}
