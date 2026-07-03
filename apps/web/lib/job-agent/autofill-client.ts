const DAEMON_URL = process.env.NEXT_PUBLIC_AUTOFILL_URL ?? 'http://127.0.0.1:9321'

export interface AutofillPackPayload {
  company: string
  role: string
  jobUrl: string
  coverLetter: string
  cv: string
  notes?: string
  senderEmail?: string
}

export async function isAutofillDaemonRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function launchAutofill(payload: AutofillPackPayload): Promise<{
  ok: boolean
  error?: string
  filled?: Record<string, boolean>
}> {
  const res = await fetch(`${DAEMON_URL}/autofill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as {
    ok?: boolean
    error?: string
    filled?: Record<string, boolean>
  }

  if (!res.ok) {
    return { ok: false, error: data.error ?? 'Autofill failed' }
  }

  return { ok: true, filled: data.filled }
}
