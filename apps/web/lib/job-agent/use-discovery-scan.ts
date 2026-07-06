'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionSkippedItem } from '@/components/scout/ScoutSkippedPanel'

const STORAGE_KEY = 'aslico:job-agent:session-skipped'

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

export interface DiscoveryScanSummary {
  scanned: number
  created: number
  skipped?: number
}

export function useJobDiscoveryScan() {
  const abortRef = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [summary, setSummary] = useState<DiscoveryScanSummary | null>(null)
  const [sessionSkipped, setSessionSkipped] = useState<SessionSkippedItem[]>(readStoredSkipped)

  useEffect(() => {
    writeStoredSkipped(sessionSkipped)
  }, [sessionSkipped])

  const dismissSessionSkipped = useCallback((id: string) => {
    setSessionSkipped((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setStopped(true)
    setRunning(false)
  }, [])

  const runScan = useCallback(async (): Promise<{
    ok: boolean
    aborted?: boolean
    data?: Record<string, unknown>
  }> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRunning(true)
    setStopped(false)
    setLog(null)
    setSummary(null)

    try {
      const res = await fetch('/api/modules/job-agent/scan', {
        method: 'POST',
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return { ok: false, aborted: true }
      }

      let data: Record<string, unknown>
      const raw = await res.text()
      try {
        data = JSON.parse(raw) as Record<string, unknown>
      } catch {
        setLog(`Scan response error (${res.status}): ${raw.slice(0, 500) || res.statusText}`)
        setRunning(false)
        abortRef.current = null
        return { ok: false, data: { error: 'invalid_json' } }
      }

      const lines = Array.isArray(data.log)
        ? data.log.map((l: { message: string }) => l.message)
        : []
      if (lines.length) {
        setLog(lines.join('\n'))
      } else if (typeof data.error === 'string') {
        setLog(`Scan failed: ${data.error}`)
      } else if (!res.ok) {
        setLog(`Scan failed (HTTP ${res.status})`)
      }

      if (typeof data.jobsScanned === 'number' || typeof data.packsCreated === 'number') {
        setSummary({
          scanned: (data.jobsScanned as number) ?? 0,
          created: (data.packsCreated as number) ?? 0,
          skipped: (data.skippedCount as number) ?? (Array.isArray(data.skippedPreview) ? data.skippedPreview.length : 0),
        })
      }
      if (Array.isArray(data.skippedPreview) && data.skippedPreview.length) {
        setSessionSkipped(data.skippedPreview)
      }

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
    runScan,
    stopScan,
    dismissSessionSkipped,
    setLog,
    setSummary,
  }
}
