'use client'

import { useCallback } from 'react'
import { Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { useJobDiscoveryScan } from '@/lib/job-agent/use-discovery-scan'

interface DiscoveryScanControlsProps {
  onComplete?: () => void
  onWarning?: (msg: string | null) => void
  compact?: boolean
  onRunFinished?: () => void
  discovery?: ReturnType<typeof useJobDiscoveryScan>
}

export function DiscoveryScanControls({
  onComplete,
  onWarning,
  compact,
  onRunFinished,
  discovery: discoveryProp,
}: DiscoveryScanControlsProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const internal = useJobDiscoveryScan()
  const discovery = discoveryProp ?? internal
  const { running, stopped, log, summary, runScan, stopScan } = discovery

  const handleRun = useCallback(async () => {
    onWarning?.(null)
    try {
      const { ok, aborted, data } = await runScan()

      if (aborted) return

      if (data?.warning === 'job_agent_v2_missing') {
        onWarning?.(ja.warnings.v2Missing)
        return
      }

      if (!ok) {
        onWarning?.(ja.discovery.scanFailed)
      }

      if (ok && typeof data?.packsCreated === 'number' && data.packsCreated > 0) {
        onComplete?.()
      }
      onRunFinished?.()
    } catch (err) {
      onWarning?.(err instanceof Error ? err.message : ja.discovery.scanFailed)
    }
  }, [ja.discovery.scanFailed, ja.warnings.v2Missing, onComplete, onRunFinished, onWarning, runScan])

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className="text-sm text-[var(--text-muted)]">{ja.discovery.hint}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleRun} disabled={running}>
          {running ? ja.discovery.running : ja.discovery.runNow}
        </Button>
        {running && (
          <Button variant="outline" onClick={stopScan}>
            {ja.discovery.stop}
          </Button>
        )}
      </div>
      {stopped && (
        <p className="text-xs text-[var(--text-muted)]">{ja.discovery.stopped}</p>
      )}
      {running && !log && (
        <p className="text-xs text-[var(--text-muted)]">{ja.discovery.running}…</p>
      )}
      {summary && (
        <p className="text-sm font-medium text-[var(--accent)]">
          {ja.discovery.summary
            .replace('{scanned}', String(summary.scanned))
            .replace('{created}', String(summary.created))}
        </p>
      )}
      {log && (
        <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-3 text-xs text-[var(--text-muted)]">
          {log}
        </pre>
      )}
    </div>
  )
}
