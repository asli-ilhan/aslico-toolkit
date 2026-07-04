'use client'

import { useCallback, useRef, useState } from 'react'

export function useFundingScan() {
  const abortRef = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ scanned: number; created: number } | null>(null)

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    setStopped(true)
    setRunning(false)
  }, [])

  const runScan = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setStopped(false)
    setLog(null)
    setSummary(null)

    try {
      const res = await fetch('/api/modules/funding-scout/scan', { method: 'POST', signal: controller.signal })
      if (controller.signal.aborted) return { ok: false, aborted: true }
      const data = await res.json()
      if (data.log?.length) setLog(data.log.map((l: { message: string }) => l.message).join('\n'))
      setSummary({ scanned: data.opportunitiesScanned ?? 0, created: data.packsCreated ?? 0 })
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

  return { running, stopped, log, summary, runScan, stopScan }
}
