import { streamMeetingCue, type MeetingLanguageMode } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingMeetingCopilotTable } from '@/lib/supabase/errors'
import { buildCorpusFromChunks, loadAnswerTemplates, retrieveMeetingChunks } from '@/lib/meeting-copilot/retrieve'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function errorResponse(error: string, status: number): Response {
  return new Response(sse({ type: 'error', error }), {
    status,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  })
}

export async function POST(request: Request) {
  const started = Date.now()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse('ANTHROPIC_API_KEY missing', 503)

  const body = await request.json()
  const sessionId = String(body.sessionId ?? '')
  const questionText = String(body.questionText ?? '').trim()
  if (!sessionId || !questionText) {
    return errorResponse('sessionId and questionText required', 400)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)))
      try {
        // Flush a first byte immediately so the client shows progress while we read.
        send({ type: 'meta', questionText })

        const [sessionResult, recentResult] = await Promise.all([
          supabase
            .from('meeting_sessions')
            .select('id, counterparty, focus, language_mode, tag_filter, status')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('meeting_turns')
            .select('question_text, answer_json')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3),
        ])

        const { data: session, error: sessionError } = sessionResult
        if (sessionError) {
          send({
            type: 'error',
            error: isMissingMeetingCopilotTable(sessionError)
              ? 'meeting_copilot_table_missing'
              : sessionError.message,
          })
          return
        }
        if (!session) {
          send({ type: 'error', error: 'Session not found' })
          return
        }

        const tagFilter = (session.tag_filter as string[] | null) ?? []
        const [retrieval, answerTemplate] = await Promise.all([
          retrieveMeetingChunks(supabase, user.id, questionText, tagFilter),
          loadAnswerTemplates(supabase, user.id),
        ])
        const corpus = retrieval.emptyBecauseTags
          ? '(no documents match the selected tags — say you need to confirm)'
          : buildCorpusFromChunks(retrieval.chunks)

        send({
          type: 'context',
          chunkCount: retrieval.chunks.length,
          usedFallback: retrieval.usedFallback,
          hasTemplates: Boolean(answerTemplate),
          retrievalMs: Date.now() - started,
        })

        const recentTurns = (recentResult.data ?? []).map((r) => {
          const aj = r.answer_json as { oneliner?: string; bullets?: string[] }
          return {
            question: r.question_text,
            oneliner: aj?.oneliner ?? '',
            bullets: Array.isArray(aj?.bullets) ? aj.bullets : [],
          }
        })

        let finalAnswer: {
          oneliner: string
          script: string
          bullets: string[]
          language: 'tr' | 'en'
          confidence: 'high' | 'medium' | 'low'
        } | null = null

        for await (const evt of streamMeetingCue({
          question: questionText,
          counterparty: session.counterparty ?? '',
          focus: session.focus ?? '',
          languageMode: (session.language_mode as MeetingLanguageMode) || 'auto',
          knowledgeCorpus: corpus,
          answerTemplate,
          recentTurns,
        })) {
          if (evt.type === 'delta') send({ type: 'delta', text: evt.text })
          if (evt.type === 'partial') {
            send({
              type: 'partial',
              oneliner: evt.answer.oneliner,
              script: evt.answer.script,
              bullets: evt.answer.bullets,
              language: evt.answer.language,
              confidence: evt.answer.confidence,
            })
          }
          if (evt.type === 'done') finalAnswer = evt.answer
        }

        if (!finalAnswer) throw new Error('Empty stream answer')

        const latencyMs = Date.now() - started
        // Persist only after the answer is already on screen.
        const { data: turn, error: turnError } = await supabase
          .from('meeting_turns')
          .insert({
            user_id: user.id,
            session_id: sessionId,
            question_text: questionText,
            answer_json: finalAnswer,
            detected_language: finalAnswer.language,
            latency_ms: latencyMs,
          })
          .select('id, question_text, answer_json, detected_language, latency_ms, created_at')
          .single()

        if (turnError) {
          send({ type: 'done', answer: finalAnswer, latencyMs, persistError: turnError.message })
        } else {
          send({ type: 'done', answer: finalAnswer, turn, latencyMs })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream failed'
        send({ type: 'error', error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
