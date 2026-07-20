import { NextResponse } from 'next/server'
import { synthesizeSpeech, synthesizeSpeechLocal, isLocalTtsEnabled } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingSelfTherapyTable } from '@/lib/supabase/errors'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BUCKET = 'self-therapy-audio'

/** Parse PCM WAV duration from RIFF header (ignores truncated tails). */
function wavDurationSeconds(buf: ArrayBuffer): number | null {
  if (buf.byteLength < 44) return null
  const view = new DataView(buf)
  const tag = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  )
  if (tag !== 'RIFF') return null
  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  if (!channels || !sampleRate || !bitsPerSample) return null

  let offset = 12
  let dataBytes = 0
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    const size = view.getUint32(offset + 4, true)
    if (id === 'data') {
      dataBytes = Math.min(size, view.byteLength - (offset + 8))
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (!dataBytes) dataBytes = Math.max(0, buf.byteLength - 44)
  const bytesPerSample = bitsPerSample / 8
  const frameSize = channels * bytesPerSample
  if (frameSize <= 0) return null
  return dataBytes / frameSize / sampleRate
}

function estimateDurationSeconds(
  audio: ArrayBuffer,
  contentType: string,
  reported?: number | null,
): number {
  if (reported && reported > 1) return Math.round(reported)
  if (contentType.includes('wav') || contentType.includes('wave')) {
    const d = wavDurationSeconds(audio)
    if (d && d > 1) return Math.round(d)
  }
  // MP3 @ ~64 kbps fallback
  if (contentType.includes('mpeg') || contentType.includes('mp3')) {
    return Math.max(30, Math.round((audio.byteLength * 8) / 64000))
  }
  return Math.max(30, Math.round(audio.byteLength / (24000 * 2)))
}

async function fetchLocalJobAudio(jobId: string): Promise<{
  audio: ArrayBuffer
  contentType: string
  durationSeconds: number | null
}> {
  const base = (process.env.LOCAL_TTS_URL || 'http://127.0.0.1:8765').replace(/\/$/, '')
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safeId) throw new Error('Invalid jobId')

  const metaRes = await fetch(`${base}/jobs/${safeId}`)
  if (!metaRes.ok) throw new Error(`Local TTS job missing (${metaRes.status})`)
  const meta = (await metaRes.json()) as {
    status: string
    error?: string | null
    duration_seconds?: number | null
    content_type?: string | null
  }
  if (meta.status !== 'done') {
    throw new Error(meta.error || `Local TTS job not ready (${meta.status})`)
  }

  const audioRes = await fetch(`${base}/jobs/${safeId}/audio`)
  if (!audioRes.ok) throw new Error(`Local TTS audio fetch failed (${audioRes.status})`)
  return {
    audio: await audioRes.arrayBuffer(),
    contentType: audioRes.headers.get('content-type') || meta.content_type || 'audio/wav',
    durationSeconds: meta.duration_seconds ?? null,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') || ''
  const isMultipart = contentType.includes('multipart/form-data')

  let sessionId = ''
  let induction = ''
  let deepening = ''
  let suggestions = ''
  let jobId = ''
  let prebuiltAudio: ArrayBuffer | null = null
  let prebuiltContentType = 'audio/wav'
  let reportedDuration: number | null = null

  if (isMultipart) {
    const form = await request.formData()
    sessionId = String(form.get('sessionId') ?? '')
    induction = String(form.get('induction') ?? '')
    deepening = String(form.get('deepening') ?? '')
    suggestions = String(form.get('suggestions') ?? '')
    jobId = String(form.get('jobId') ?? '')
    const dur = form.get('durationSeconds')
    if (dur != null && String(dur).trim()) reportedDuration = Number(dur)
    const file = form.get('audio')
    if (file instanceof Blob && file.size > 0) {
      prebuiltAudio = await file.arrayBuffer()
      prebuiltContentType = file.type || 'audio/wav'
    }
  } else {
    const body = await request.json()
    sessionId = String(body.sessionId ?? '')
    induction = String(body.induction ?? '')
    deepening = String(body.deepening ?? '')
    suggestions = String(body.suggestions ?? '')
    jobId = String(body.jobId ?? '')
    if (body.durationSeconds != null) reportedDuration = Number(body.durationSeconds)
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const useLocal = isLocalTtsEnabled()
  if (!prebuiltAudio && !jobId && !useLocal && !process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      {
        error: 'TTS not configured',
        hint: 'Set TTS_PROVIDER=local + LOCAL_TTS_URL (tools/local-voice), or ELEVENLABS_API_KEY',
      },
      { status: 503 },
    )
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

  induction = induction || String(session.induction ?? '')
  deepening = deepening || String(session.deepening ?? '')
  suggestions = suggestions || String(session.suggestions ?? '')
  const fullScript = [induction, deepening, suggestions]
    .map((s) => s.replace(/…/g, '.').trim())
    .filter(Boolean)
    .join('\n\n')

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
    let audio: ArrayBuffer
    let audioType: string
    let provider: string
    let durationFromSource: number | null = reportedDuration

    if (jobId) {
      const local = await fetchLocalJobAudio(jobId)
      audio = local.audio
      audioType = local.contentType
      durationFromSource = local.durationSeconds ?? durationFromSource
      provider = 'local-job'
    } else if (prebuiltAudio) {
      audio = prebuiltAudio
      audioType = prebuiltContentType
      provider = 'local-client'
    } else if (useLocal) {
      const result = await synthesizeSpeechLocal(fullScript, {
        language: session.locale || 'tr',
        ref: process.env.LOCAL_VOICE_REF || 'ref_1.wav',
      })
      audio = result.audio
      audioType = result.contentType
      provider = 'local'
    } else {
      const result = await synthesizeSpeech(fullScript)
      audio = result.audio
      audioType = result.contentType
      provider = 'elevenlabs'
    }

    const ext = audioType.includes('mpeg') || audioType.includes('mp3') ? 'mp3' : 'wav'
    const path = `${user.id}/${sessionId}.${ext}`

    const admin = createAdminClient()
    const { error: upError } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: audioType || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg'),
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

    const durationSeconds = estimateDurationSeconds(audio, audioType, durationFromSource)

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
      provider,
      durationSeconds,
      bytes: audio.byteLength,
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
          hint: 'ElevenLabs free credits are empty. Use local TTS on localhost.',
        },
        { status: 402 },
      )
    }
    if (/Local TTS error|ECONNREFUSED|fetch failed|Local TTS/i.test(message)) {
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
