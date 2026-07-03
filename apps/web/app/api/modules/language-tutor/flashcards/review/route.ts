import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { nextReview } from '@/lib/language-tutor/srs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const cardId = body.cardId as string
  const quality = Number(body.quality ?? 3)

  const { data: card, error: fetchErr } = await supabase
    .from('language_tutor_flashcards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const updated = nextReview(
    quality,
    card.repetitions as number,
    card.interval_days as number,
    Number(card.ease_factor),
  )

  const { error } = await supabase
    .from('language_tutor_flashcards')
    .update({
      repetitions: updated.repetitions,
      interval_days: updated.intervalDays,
      ease_factor: updated.easeFactor,
      next_review_at: updated.nextReviewAt,
    })
    .eq('id', cardId)

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nextReviewAt: updated.nextReviewAt })
}
