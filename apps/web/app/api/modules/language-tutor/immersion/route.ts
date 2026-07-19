import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingLanguageTutorTable } from '@/lib/supabase/errors'
import { fetchTutorSettings } from '@/lib/language-tutor/lesson'
import { languageForDate, languageLabel } from '@/lib/language-tutor/rotation'
import { languageDayIndex } from '@/lib/language-tutor/curriculum'
import { gatedUnitForLanguageDay } from '@/lib/language-tutor/progress'
import { fetchImmersionBundle } from '@/lib/language-tutor/immersion'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await fetchTutorSettings(supabase, user.id)
  const { language, isRestDay } = languageForDate(new Date(), settings.rotation, settings.sundayBreak)

  if (isRestDay || !language) {
    return NextResponse.json({ restDay: true })
  }

  const langDay = languageDayIndex(
    settings.programStartDate,
    language,
    new Date(),
    settings.rotation,
    settings.sundayBreak,
  )

  const { data: grammarRows } = await supabase
    .from('language_tutor_grammar_progress')
    .select('topic_id, mastery_score, passed')
    .eq('user_id', user.id)
    .eq('language', language)

  const { unit } = gatedUnitForLanguageDay(
    language,
    langDay,
    (grammarRows ?? []) as Array<{ topic_id: string; mastery_score: number; passed: boolean }>,
  )

  const bundle = await fetchImmersionBundle(supabase, user.id, language, unit)

  return NextResponse.json({
    language,
    languageLabel: languageLabel(language, settings.nativeLanguage === 'tr' ? 'tr' : 'en'),
    ...bundle,
  })
}
