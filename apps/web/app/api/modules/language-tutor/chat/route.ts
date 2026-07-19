import { NextResponse, type NextRequest } from 'next/server'
import {
  languageTutorChat,
  parseErrorsFromFriendReply,
  parseGrammarMastery,
  type ChatMode,
  type TutorLanguage,
} from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { languageForDate } from '@/lib/language-tutor/rotation'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { languageDayIndex } from '@/lib/language-tutor/curriculum'
import { gatedUnitForLanguageDay } from '@/lib/language-tutor/progress'

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
  const message = String(body.message ?? '').trim()
  const mode = (body.mode ?? 'friend') as ChatMode
  const locale = String(body.locale ?? 'tr')

  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const settings = await fetchTutorSettings(supabase, user.id)
  const { language } = languageForDate(new Date(), settings.rotation, settings.sundayBreak)
  const lang = (body.language ?? language ?? 'fr') as TutorLanguage

  const { data: historyRows } = await supabase
    .from('language_tutor_chat')
    .select('role, content')
    .eq('user_id', user.id)
    .eq('language', lang)
    .eq('mode', mode)
    .order('created_at', { ascending: true })
    .limit(16)

  const history = (historyRows ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const langDay = languageDayIndex(
    settings.programStartDate,
    lang,
    new Date(),
    settings.rotation,
    settings.sundayBreak,
  )
  const { data: grammarRows } = await supabase
    .from('language_tutor_grammar_progress')
    .select('topic_id, mastery_score, passed')
    .eq('user_id', user.id)
    .eq('language', lang)
  const { unit } = gatedUnitForLanguageDay(
    lang,
    langDay,
    (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
  )

  try {
    const reply = await languageTutorChat({
      mode,
      language: lang,
      locale: settings.nativeLanguage || locale,
      message,
      history,
      grammarTopic: unit.grammarFocus,
    })

    await supabase.from('language_tutor_chat').insert([
      { user_id: user.id, language: lang, mode, role: 'user', content: message },
      { user_id: user.id, language: lang, mode, role: 'assistant', content: reply },
    ])

    if (mode === 'friend' || mode === 'voice_coach' || mode === 'pronunciation') {
      const parsed = parseErrorsFromFriendReply(reply)
      for (const err of parsed) {
        const { data: existing } = await supabase
          .from('language_tutor_errors')
          .select('id, count')
          .eq('user_id', user.id)
          .eq('language', lang)
          .ilike('mistake', err.mistake)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('language_tutor_errors')
            .update({
              count: (existing.count as number) + 1,
              correction: err.correction,
              explanation: err.explanation,
              natural_variant: err.natural,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('language_tutor_errors').insert({
            user_id: user.id,
            language: lang,
            mistake: err.mistake,
            correction: err.correction,
            explanation: err.explanation,
            natural_variant: err.natural,
          })
        }
      }
    }

    if (mode === 'grammar') {
      const mastery = parseGrammarMastery(reply)
      if (mastery) {
        await supabase.from('language_tutor_grammar_progress').upsert(
          {
            user_id: user.id,
            language: lang,
            topic_id: unit.id,
            mastery_score: mastery.score,
            passed: mastery.passed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,language,topic_id' },
        )
      }
    }

    return NextResponse.json({ reply, language: lang, grammarMastery: mode === 'grammar' ? parseGrammarMastery(reply) : null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chat failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
