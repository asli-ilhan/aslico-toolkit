'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionSkippedItem } from '@/components/scout/ScoutSkippedPanel'

const STORAGE_KEY = 'aslico:funding-scout:session-skipped'

function readStoredSkipped(): SessionSkippedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionSkippedItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredSkipped(items: SessionSkippedItem[]) {
  if (typeof window === 'undefined') return
  try {
    if (items.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* quota */
  }
}

export function useFundingScan() {
  const abortRef = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    scanned: number
    created: number
    newCandidates?: number
    duplicates?: number
    skipped?: number
  } | null>(null)
  const [sessionSkipped, setSessionSkipped] = useState<SessionSkippedItem[]>([])
  const [scanWarnings, setScanWarnings] = useState<string[]>([])

  useEffect(() => {
    setSessionSkipped(readStoredSkipped())
  }, [])

  useEffect(() => {
    writeStoredSkipped(sessionSkipped)
  }, [sessionSkipped])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setStopped(true)
    setRunning(false)
  }, [])

  const dismissSessionSkipped = useCallback((id: string) => {
    setSessionSkipped((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const runScan = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setStopped(false)
    setLog(null)
    setSummary(null)
    setScanWarnings([])

    try {
      const res = await fetch('/api/modules/funding-scout/scan', { method: 'POST', signal: controller.signal })
      if (controller.signal.aborted) return { ok: false, aborted: true }

      let data: Record<string, unknown>
      const raw = await res.text()
      try {
        data = JSON.parse(raw) as Record<string, unknown>
      } catch {
        const msg =
          res.status === 504
            ? `Sunucu zaman aşımı (504) — burs taraması Vercel limitini aştı.\n${raw.slice(0, 600) || 'FUNCTION_INVOCATION_TIMEOUT'}`
            : `Scan response error (${res.status}): ${raw.slice(0, 500) || res.statusText}`
        setLog(msg)
        setSummary({ scanned: 0, created: 0, newCandidates: 0, duplicates: 0, skipped: 0 })
        setRunning(false)
        abortRef.current = null
        return { ok: false, data: { error: 'scan_timeout' } }
      }

      const lines = Array.isArray(data.log)
        ? data.log.map((l: { message: string }) => l.message)
        : []
      if (lines.length) {
        setLog(lines.join('\n'))
      } else if (res.status === 504) {
        setLog(
          `Sunucu zaman aşımı (504) — burs taraması Vercel limitini aştı.\n${raw.slice(0, 600) || 'FUNCTION_INVOCATION_TIMEOUT'}`,
        )
      } else if (typeof data.error === 'string') {
        setLog(`Scan failed: ${data.error}`)
      } else if (!res.ok) {
        setLog(`Scan failed (HTTP ${res.status})`)
      } else {
        setLog('Scan finished but returned no log lines.')
      }

      setSummary({
        scanned: (data.opportunitiesScanned as number) ?? 0,
        created: (data.packsCreated as number) ?? 0,
        newCandidates: data.candidatesNew as number | undefined,
        duplicates: data.candidatesDuplicate as number | undefined,
        skipped: (data.skippedCount as number) ?? (Array.isArray(data.skippedPreview) ? data.skippedPreview.length : 0),
      })
      if (Array.isArray(data.skippedPreview)) {
        setSessionSkipped(data.skippedPreview)
      }
      const warnings = [
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        ...(data.warning ? [data.warning] : []),
      ].filter((w, i, arr) => typeof w === 'string' && arr.indexOf(w) === i)
      setScanWarnings(warnings)
      setRunning(false)
      abortRef.current = null
      return { ok: res.ok, data }
    } catch (err) {
      setRunning(false)
      abortRef.current = null
      if (err instanceof Error && err.name === 'AbortError') {
        setStopped(true)
        return { ok: false, aborted: true }
      }
      const msg = err instanceof Error ? err.message : 'unknown error'
      setLog(`Scan request failed: ${msg}`)
      return { ok: false, data: { error: msg } }
    }
  }, [])

  return {
    running,
    stopped,
    log,
    summary,
    sessionSkipped,
    scanWarnings,
    runScan,
    stopScan,
    dismissSessionSkipped,
  }
}
