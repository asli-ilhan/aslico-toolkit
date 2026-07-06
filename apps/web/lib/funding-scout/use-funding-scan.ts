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
  const [sessionSkipped, setSessionSkipped] = useState<SessionSkippedItem[]>(readStoredSkipped)
  const [scanWarnings, setScanWarnings] = useState<string[]>([])

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
      const data = await res.json()
      if (data.log?.length) setLog(data.log.map((l: { message: string }) => l.message).join('\n'))
      setSummary({
        scanned: data.opportunitiesScanned ?? 0,
        created: data.packsCreated ?? 0,
        newCandidates: data.candidatesNew,
        duplicates: data.candidatesDuplicate,
        skipped: data.skippedCount ?? data.skippedPreview?.length ?? 0,
      })
      if (Array.isArray(data.skippedPreview) && data.skippedPreview.length) {
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
      throw err
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
