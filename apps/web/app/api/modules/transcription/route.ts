import { NextResponse, type NextRequest } from 'next/server'
import { transcribeAudio, transcribeAudioFromUrl, summarizeTranscript } from '@aslico/ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingTranscriptionsTable } from '@/lib/supabase/errors'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Stay under Vercel Hobby ~4.5 MB gateway body limit for multipart uploads. */
const DIRECT_UPLOAD_MAX = 3.5 * 1024 * 1024
const MAX_BYTES = 50 * 1024 * 1024
const STORAGE_BUCKET = 'transcription-audio'

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

async function finishTranscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  opts: {
    text: string
    language?: string
    filename: string | null
    locale: string
    withSummary: boolean
  },
) {
  let summary: string | null = null
  if (opts.withSummary) {
    try {
      summary = await summarizeTranscript(opts.text, opts.locale)
    } catch {
      summary = null
    }
  }

  const title =
    (opts.filename ? opts.filename.replace(/\.[^.]+$/, '') : null) ||
    'Untitled recording'

  const result = await saveTranscription(supabase, userId, {
    title,
    transcript: opts.text,
    summary,
    source_filename: opts.filename,
    language: opts.language ?? null,
  })

  if ('warning' in result) {
    return NextResponse.json({
      transcript: opts.text,
      summary,
      language: opts.language,
      warning: result.warning,
      hint: result.hint,
    })
  }

  return NextResponse.json({ item: result.item })
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

  // JSON: pasted text summary OR large-file path after Storage upload
  if (contentType.includes('application/json')) {
    const body = await request.json()
    const locale = String(body.locale ?? 'en')
    const withSummary = body.summary !== false

    // Large audio: client uploaded to Supabase Storage, we ask Deepgram to fetch URL
    if (body.storagePath) {
      if (!process.env.DEEPGRAM_API_KEY) {
        return NextResponse.json(
          {
            error: 'DEEPGRAM_API_KEY missing',
            hint: 'Claude cannot transcribe audio directly. Add DEEPGRAM_API_KEY (free tier) or paste transcript as text.',
          },
          { status: 503 },
        )
      }

      const storagePath = String(body.storagePath)
      const filename = String(body.filename ?? storagePath.split('/').pop() ?? 'audio.m4a')
      if (!storagePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 })
      }

      const { data: signed, error: signError } = await (() => {
        try {
          const admin = createAdminClient()
          return admin.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600)
        } catch {
          return supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600)
        }
      })()

      if (signError || !signed?.signedUrl) {
        const msg = signError?.message ?? 'Could not create signed URL'
        if (/bucket|not found|does not exist/i.test(msg)) {
          return NextResponse.json(
            {
              error: 'transcription_storage_missing',
              hint: 'Run packages/storage/sql/transcription_audio_storage.sql in Supabase SQL Editor',
            },
            { status: 503 },
          )
        }
        return NextResponse.json({ error: msg }, { status: 500 })
      }

      try {
        const { text, language } = await transcribeAudioFromUrl(signed.signedUrl)
        const response = await finishTranscription(supabase, user.id, {
          text,
          language,
          filename,
          locale,
          withSummary,
        })
        // Best-effort cleanup
        void supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed'
        return NextResponse.json(
          {
            error: message,
            hint: /DEEPGRAM|Deepgram/i.test(message)
              ? 'Check DEEPGRAM_API_KEY in Vercel Production env'
              : undefined,
          },
          { status: 500 },
        )
      }
    }

    // Pasted transcript → Claude summary only
    const transcript = String(body.transcript ?? '').trim()
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

  // Multipart: small audio file → Deepgram STT → Claude summary
  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      {
        error: 'DEEPGRAM_API_KEY missing',
        hint: 'Claude cannot transcribe audio directly. Add DEEPGRAM_API_KEY (free tier) or paste transcript as text.',
      },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      {
        error: 'payload_too_large',
        hint: 'File exceeds Vercel upload limit (~4.5 MB). Use the app — large files go via Storage automatically after running transcription_audio_storage.sql.',
      },
      { status: 413 },
    )
  }

  const file = formData.get('file')
  const locale = String(formData.get('locale') ?? 'en')
  const withSummary = formData.get('summary') !== 'false'

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
  }

  if (file.size > DIRECT_UPLOAD_MAX) {
    return NextResponse.json(
      {
        error: 'payload_too_large',
        hint: 'Use Storage upload path for files over 3.5 MB',
      },
      { status: 413 },
    )
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
    return finishTranscription(supabase, user.id, {
      text,
      language,
      filename: file.name,
      locale,
      withSummary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
