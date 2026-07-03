import { NextResponse, type NextRequest } from 'next/server'
import { transcribeAudio, summarizeTranscript } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { isMissingTranscriptionsTable } from '@/lib/supabase/errors'

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'video/webm',
  'audio/ogg',
])

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('transcriptions')
    .select('id, title, transcript, summary, source_filename, language, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (isMissingTranscriptionsTable(error)) {
      return NextResponse.json({
        items: [],
        warning: 'transcriptions_table_missing',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

async function saveTranscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: {
    title: string
    transcript: string
    summary: string | null
    source_filename: string | null
    language: string | null
  },
) {
  const { data: saved, error: saveError } = await supabase
    .from('transcriptions')
    .insert({ user_id: userId, ...payload })
    .select('id, title, transcript, summary, source_filename, language, created_at')
    .single()

  if (saveError && isMissingTranscriptionsTable(saveError)) {
    return {
      warning: 'transcriptions_table_missing' as const,
      hint: 'Run packages/storage/sql/transcriptions.sql in Supabase SQL Editor',
    }
  }

  if (saveError) {
    throw new Error(saveError.message)
  }

  return { item: saved }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: 'ANTHROPIC_API_KEY missing',
        hint: 'Add ANTHROPIC_API_KEY to apps/web/.env.local',
      },
      { status: 503 },
    )
  }

  const contentType = request.headers.get('content-type') ?? ''

  // JSON: pre-transcribed text → Claude summary only
  if (contentType.includes('application/json')) {
    const body = await request.json()
    const transcript = String(body.transcript ?? '').trim()
    const locale = String(body.locale ?? 'en')
    const withSummary = body.summary !== false
    const title = String(body.title ?? 'Pasted transcript').trim() || 'Pasted transcript'

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    try {
      const summary = withSummary ? await summarizeTranscript(transcript, locale) : null
      const result = await saveTranscription(supabase, user.id, {
        title,
        transcript,
        summary,
        source_filename: null,
        language: body.language ?? null,
      })

      if ('warning' in result) {
        return NextResponse.json({
          transcript,
          summary,
          warning: result.warning,
          hint: result.hint,
        })
      }

      return NextResponse.json({ item: result.item })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Multipart: audio file → Deepgram STT → Claude summary
  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      {
        error: 'DEEPGRAM_API_KEY missing',
        hint: 'Claude cannot transcribe audio directly. Add DEEPGRAM_API_KEY (free tier) or paste transcript as text.',
      },
      { status: 503 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const locale = String(formData.get('locale') ?? 'en')
  const withSummary = formData.get('summary') !== 'false'

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 },
    )
  }

  try {
    const buffer = await file.arrayBuffer()
    const { text, language } = await transcribeAudio(buffer, file.name)

    let summary: string | null = null
    if (withSummary) {
      try {
        summary = await summarizeTranscript(text, locale)
      } catch {
        summary = null
      }
    }

    const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled recording'
    const result = await saveTranscription(supabase, user.id, {
      title,
      transcript: text,
      summary,
      source_filename: file.name,
      language: language ?? null,
    })

    if ('warning' in result) {
      return NextResponse.json({
        transcript: text,
        summary,
        language,
        warning: result.warning,
        hint: result.hint,
      })
    }

    return NextResponse.json({ item: result.item })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
