'use client'

import { useCallback, useRef, useState } from 'react'

export interface DiscoveryScanSummary {
  scanned: number
  created: number
}

export function useJobDiscoveryScan() {
  const abortRef = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [summary, setSummary] = useState<DiscoveryScanSummary | null>(null)

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

      const data = await res.json()

      if (data.log?.length) {
        setLog(data.log.map((l: { message: string }) => l.message).join('\n'))
      }
      if (typeof data.jobsScanned === 'number' || typeof data.packsCreated === 'number') {
        setSummary({
          scanned: data.jobsScanned ?? 0,
          created: data.packsCreated ?? 0,
        })
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
      throw err
    }
  }, [])

  return { running, stopped, log, summary, runScan, stopScan, setLog, setSummary }
}
