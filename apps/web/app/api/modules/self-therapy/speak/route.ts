import { NextResponse } from 'next/server'
import { synthesizeSpeech, synthesizeSpeechLocal, isLocalTtsEnabled } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingSelfTherapyTable } from '@/lib/supabase/errors'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BUCKET = 'self-therapy-audio'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const useLocal = isLocalTtsEnabled()
  if (!useLocal && !process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      {
        error: 'TTS not configured',
        hint: 'Set TTS_PROVIDER=local + LOCAL_TTS_URL (tools/local-voice), or ELEVENLABS_API_KEY',
      },
      { status: 503 },
    )
  }

  const body = await request.json()
  const sessionId = String(body.sessionId ?? '')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const { data: session, error: loadError } = await supabase
    .from('self_therapy_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadError) {
    if (isMissingSelfTherapyTable(loadError)) {
      return NextResponse.json({ error: 'self_therapy_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const induction = String(body.induction ?? session.induction ?? '')
  const deepening = String(body.deepening ?? session.deepening ?? '')
  const suggestions = String(body.suggestions ?? session.suggestions ?? '')
  const fullScript = [induction, '', '…', '', deepening, '', '…', '', suggestions]
    .join('\n')
    .trim()

  await supabase
    .from('self_therapy_sessions')
    .update({
      induction,
      deepening,
      suggestions,
      full_script: fullScript,
      status: 'speaking',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  try {
    const { audio, contentType } = useLocal
      ? await synthesizeSpeechLocal(fullScript, {
          language: session.locale || 'tr',
          ref: process.env.LOCAL_VOICE_REF || 'ref_1.wav',
        })
      : await synthesizeSpeech(fullScript)

    const ext = contentType.includes('wav') ? 'wav' : 'mp3'
    const path = `${user.id}/${sessionId}.${ext}`

    const admin = createAdminClient()
    const { error: upError } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: contentType || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg'),
      upsert: true,
    })

    if (upError) {
      const msg = upError.message
      if (/bucket|not found|does not exist/i.test(msg)) {
        return NextResponse.json(
          {
            error: 'self_therapy_storage_missing',
            hint: 'Run packages/storage/sql/self_therapy_audio_storage.sql in Supabase',
          },
          { status: 503 },
        )
      }
      throw new Error(msg)
    }

    const durationSeconds = Math.max(30, Math.round(fullScript.length / 12))

    const { data: item, error: saveError } = await supabase
      .from('self_therapy_sessions')
      .update({
        audio_path: path,
        duration_seconds: durationSeconds,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select(
        'id, title, topic, locale, induction, deepening, suggestions, full_script, audio_path, duration_seconds, status, created_at, updated_at',
      )
      .single()

    if (saveError) throw new Error(saveError.message)

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)

    return NextResponse.json({
      item,
      audioUrl: signed?.signedUrl ?? null,
      provider: useLocal ? 'local' : 'elevenlabs',
    })
  } catch (err) {
    await supabase
      .from('self_therapy_sessions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    const message = err instanceof Error ? err.message : 'TTS failed'
    if (message.startsWith('ELEVENLABS_PAID_VOICE')) {
      return NextResponse.json(
        {
          error: 'ELEVENLABS_PAID_VOICE',
          hint: 'Library voices need a paid ElevenLabs plan — or set TTS_PROVIDER=local',
        },
        { status: 402 },
      )
    }
    if (message.startsWith('ELEVENLABS_QUOTA')) {
      return NextResponse.json(
        {
          error: 'ELEVENLABS_QUOTA',
          hint: 'ElevenLabs free credits are empty. Run locally: TTS_PROVIDER=local + tools/local-voice server, open http://localhost:3000',
        },
        { status: 402 },
      )
    }
    if (/Local TTS error|ECONNREFUSED|fetch failed/i.test(message)) {
      return NextResponse.json(
        {
          error: 'LOCAL_TTS_UNAVAILABLE',
          hint: 'Start tools/local-voice: python server.py (see README)',
          detail: message,
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
