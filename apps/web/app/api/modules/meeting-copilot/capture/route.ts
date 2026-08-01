import { NextResponse } from 'next/server'
import { generateMeetingCue, transcribeMeetingAudio, type MeetingLanguageMode } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingCopilotTable } from '@/lib/supabase/errors'
import {
  buildCorpusFromChunks,
  loadAnswerTemplates,
  retrieveMeetingChunks,
} from '@/lib/meeting-copilot/retrieve'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Non-stream fallback: text-first when questionText present; batch STT otherwise. */
export async function POST(request: Request) {
  const started = Date.now()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 503 })
  }

  const contentType = request.headers.get('content-type') || ''
  let sessionId = ''
  let questionText = ''
  let audio: ArrayBuffer | null = null
  let audioName = 'capture.webm'

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    sessionId = String(form.get('sessionId') ?? '')
    questionText = String(form.get('questionText') ?? '').trim()
    const file = form.get('audio')
    if (file instanceof Blob && file.size > 0) {
      audio = await file.arrayBuffer()
      audioName = file instanceof File && file.name ? file.name : 'capture.webm'
    }
  } else {
    const body = await request.json()
    sessionId = String(body.sessionId ?? '')
    questionText = String(body.questionText ?? '').trim()
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const sessionPromise = supabase
    .from('meeting_sessions')
    .select('id, counterparty, focus, language_mode, tag_filter, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  const recentPromise = supabase
    .from('meeting_turns')
    .select('question_text, answer_json')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const [{ data: session, error: sessionError }, { data: recentRows }] = await Promise.all([
    sessionPromise,
    recentPromise,
  ])

  if (sessionError) {
    if (isMissingMeetingCopilotTable(sessionError)) {
      return NextResponse.json({ error: 'meeting_copilot_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  let detectedLanguage: string | undefined
  if (!questionText) {
    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: 'DEEPGRAM_API_KEY missing' }, { status: 503 })
    }
    if (!audio || audio.byteLength < 200) {
      return NextResponse.json({ error: 'audio or questionText required' }, { status: 400 })
    }
    const langMode = (session.language_mode as MeetingLanguageMode) || 'auto'
    try {
      const result = await transcribeMeetingAudio(audio, audioName, langMode)
      questionText = result.text
      detectedLanguage = result.language
    } catch (err) {
      const message = err instanceof Error ? err.message : 'STT failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (!questionText.trim()) {
    return NextResponse.json({ error: 'Empty transcript' }, { status: 400 })
  }

  const tagFilter = (session.tag_filter as string[] | null) ?? []
  let retrieval
  let answerTemplate = ''
  try {
    ;[retrieval, answerTemplate] = await Promise.all([
      retrieveMeetingChunks(supabase, user.id, questionText, tagFilter),
      loadAnswerTemplates(supabase, user.id),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Retrieval failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const corpus = retrieval.emptyBecauseTags
    ? '(no documents match the selected tags — say you need to confirm)'
    : buildCorpusFromChunks(retrieval.chunks)

  const recentTurns = (recentRows ?? []).map((r) => {
    const aj = r.answer_json as { oneliner?: string; bullets?: string[] }
    return {
      question: r.question_text,
      oneliner: aj?.oneliner ?? '',
      bullets: Array.isArray(aj?.bullets) ? aj.bullets : [],
    }
  })

  try {
    const answer = await generateMeetingCue({
      question: questionText,
      counterparty: session.counterparty ?? '',
      focus: session.focus ?? '',
      languageMode: (session.language_mode as MeetingLanguageMode) || 'auto',
      knowledgeCorpus: corpus,
      answerTemplate,
      recentTurns,
    })

    const latencyMs = Date.now() - started

    const { data: turn, error: turnError } = await supabase
      .from('meeting_turns')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        question_text: questionText,
        answer_json: answer,
        detected_language: detectedLanguage ?? answer.language,
        latency_ms: latencyMs,
      })
      .select('id, question_text, answer_json, detected_language, latency_ms, created_at')
      .single()

    if (turnError) {
      // Still return answer even if persist fails
      return NextResponse.json({
        questionText,
        answer,
        latencyMs,
        persistError: turnError.message,
      })
    }

    return NextResponse.json({ questionText, turn, answer, latencyMs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cue generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
