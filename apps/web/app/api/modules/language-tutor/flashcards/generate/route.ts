import { NextResponse, type NextRequest } from 'next/server'
import { generateProgressiveFlashcards } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { nextUnitFromProgress } from '@/lib/language-tutor/progress'
import type { TutorLanguage } from '@/lib/language-tutor/rotation'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const language = (body.language ?? 'fr') as TutorLanguage
  const count = Number(body.count ?? 15)

  const settings = await fetchTutorSettings(supabase, user.id)
  const [{ data: existingCards }, { data: grammarRows }] = await Promise.all([
    supabase
      .from('language_tutor_flashcards')
      .select('word')
      .eq('user_id', user.id)
      .eq('language', language),
    supabase
      .from('language_tutor_grammar_progress')
      .select('topic_id, mastery_score, passed')
      .eq('user_id', user.id)
      .eq('language', language),
  ])

  const existingWords = (existingCards ?? []).map((c) => String(c.word))
  const gated = nextUnitFromProgress(
    language,
    (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
  )

  const cards = await generateProgressiveFlashcards({
    language,
    locale: settings.nativeLanguage,
    count,
    existingWords,
    knownCount: existingWords.length,
    topic: gated.unit.topic,
    grammarFocus: gated.unit.grammarFocus,
    track: language === 'fr' ? 'a2_crash' : 'a1',
  })

  if (!cards.length) {
    return NextResponse.json({ error: 'Could not generate cards' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = cards.map((card) => ({
    user_id: user.id,
    language,
    word: card.word,
    translation: card.translation,
    ipa: card.ipa,
    example_sentence: card.example_sentence,
    synonyms: card.synonyms,
    antonyms: card.antonyms,
    next_review_at: today,
  }))

  const { data: inserted, error } = await supabase
    .from('language_tutor_flashcards')
    .insert(rows)
    .select('id, language, word, translation, ipa, example_sentence, next_review_at')

  if (error) {
    if (isMissingLanguageTutorTable(error)) {
      return NextResponse.json({ error: 'language_tutor_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    cards: inserted ?? [],
    created: (inserted ?? []).length,
    bandHint: existingWords.length,
  })
}
