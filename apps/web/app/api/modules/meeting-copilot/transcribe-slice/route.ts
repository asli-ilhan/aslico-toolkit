import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

/** Pitch jargon that STT otherwise mangles (nova-3 English keyterms). */
const KEYTERMS = [
  'ARR',
  'MRR',
  'CAC',
  'LTV',
  'runway',
  'burn',
  'GTM',
  'churn',
  'payback',
  'ACV',
  'NDR',
  'MoM',
  'YoY',
]

interface DeepgramAlt {
  transcript?: string
  confidence?: number
  languages?: string[]
}

function buildParams(lang: 'tr' | 'en' | 'multi', sampleRate: number): URLSearchParams {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: lang,
    smart_format: 'true',
    punctuate: 'true',
    encoding: 'linear16',
    sample_rate: String(sampleRate),
    channels: '1',
  })
  if (lang === 'en') {
    for (const term of KEYTERMS) params.append('keyterm', term)
  }
  return params
}

async function transcribe(
  apiKey: string,
  body: ArrayBuffer,
  lang: 'tr' | 'en' | 'multi',
  sampleRate: number,
): Promise<{ text: string; confidence: number; language: string }> {
  const res = await fetch(`https://api.deepgram.com/v1/listen?${buildParams(lang, sampleRate)}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/octet-stream',
    },
    body,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Deepgram ${lang} error (${res.status}): ${detail.slice(0, 160)}`)
  }
  const data = (await res.json()) as {
    results?: { channels?: { detected_language?: string; alternatives?: DeepgramAlt[] }[] }
  }
  const channel = data.results?.channels?.[0]
  const alt = channel?.alternatives?.[0]
  return {
    text: (alt?.transcript ?? '').trim(),
    confidence: Number(alt?.confidence ?? 0),
    language: channel?.detected_language ?? alt?.languages?.[0] ?? lang,
  }
}

/**
 * Low-latency slice STT proxy.
 * The browser streams raw linear16 PCM here roughly once a second; this returns the
 * transcript of the whole utterance so far. Used because the Deepgram key lacks the
 * keys:write scope needed to mint browser tokens for a direct WebSocket.
 *
 * Auto mode races Turkish and English nova-3 and keeps the higher-confidence result,
 * since nova-3 `multi` does not cover Turkish.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPGRAM_API_KEY missing' }, { status: 503 })

  const url = new URL(request.url)
  const sampleRate = Number(url.searchParams.get('sr') ?? '16000') || 16000
  const lang = url.searchParams.get('lang') ?? 'auto'

  const body = await request.arrayBuffer()
  // Under ~0.1 s of audio is not worth a round trip.
  if (body.byteLength < 3200) return NextResponse.json({ text: '' })

  try {
    if (lang === 'tr' || lang === 'en') {
      const single = await transcribe(apiKey, body, lang, sampleRate)
      return NextResponse.json({ text: single.text, language: single.language })
    }

    const [tr, en] = await Promise.allSettled([
      transcribe(apiKey, body, 'tr', sampleRate),
      transcribe(apiKey, body, 'en', sampleRate),
    ])
    const candidates = [tr, en]
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof transcribe>>> =>
        r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((c) => c.text.length > 0)

    if (!candidates.length) {
      if (tr.status === 'rejected' && en.status === 'rejected') {
        throw tr.reason instanceof Error ? tr.reason : new Error('Slice STT failed')
      }
      return NextResponse.json({ text: '' })
    }

    // Slight Turkish bias: the founder speaks Turkish with English jargon.
    const best = candidates.sort((a, b) => {
      const bias = (c: { language: string }) => (c.language === 'tr' ? 0.04 : 0)
      return b.confidence + bias(b) - (a.confidence + bias(a))
    })[0]

    return NextResponse.json({ text: best.text, language: best.language })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Slice STT failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
