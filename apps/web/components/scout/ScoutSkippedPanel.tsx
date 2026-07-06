'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { useDismissWithFeedback } from '@/lib/scout/use-dismiss-with-feedback'
import type { ScoutModuleId } from '@/lib/scout/skipped'

export interface ScoutSkippedItem {
  id: string
  module_id: ScoutModuleId
  title: string
  subtitle: string | null
  item_url: string | null
  skip_reason: string
  skip_category: string
  fit_score: number | null
  created_at: string
  candidate_data?: Record<string, unknown>
}

export type SessionSkippedItem = Omit<ScoutSkippedItem, 'module_id' | 'created_at'> & {
  created_at?: string
}

function storageKeyFor(moduleId: ScoutModuleId) {
  return `aslico:${moduleId}:session-skipped`
}

function readSessionFromStorage(moduleId: ScoutModuleId): SessionSkippedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(storageKeyFor(moduleId))
      ?? localStorage.getItem(`aslico:${moduleId}:panel-skipped`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionSkippedItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface ScoutSkippedPanelProps {
  moduleId: ScoutModuleId
  refreshKey?: number
  sessionItems?: SessionSkippedItem[]
  onPromoted?: () => void
  onSessionDismiss?: (id: string) => void
}

export function ScoutSkippedPanel({
  moduleId,
  refreshKey = 0,
  sessionItems = [],
  onPromoted,
  onSessionDismiss,
}: ScoutSkippedPanelProps) {
  const { t } = useLocale()
  const ss = t.scoutSkipped
  const [items, setItems] = useState<ScoutSkippedItem[]>([])
  const [storedSession, setStoredSession] = useState<SessionSkippedItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dismissedSessionIds, setDismissedSessionIds] = useState<Set<string>>(new Set())
  const { openDismiss, dialog: dismissDialog } = useDismissWithFeedback(moduleId)

  useEffect(() => {
    setStoredSession(readSessionFromStorage(moduleId))
    setHydrated(true)
  }, [moduleId])

  useEffect(() => {
    if (sessionItems.length) {
      setStoredSession(sessionItems)
      try {
        sessionStorage.setItem(storageKeyFor(moduleId), JSON.stringify(sessionItems))
        localStorage.setItem(`aslico:${moduleId}:panel-skipped`, JSON.stringify(sessionItems))
      } catch {
        /* quota */
      }
    }
  }, [moduleId, sessionItems])

  const effectiveSession = sessionItems.length ? sessionItems : storedSession

  const itemKey = (title: string, subtitle: string | null, url: string | null) =>
    `${subtitle ?? ''}::${title}::${url ?? ''}`.toLowerCase()

  const displayItems: ScoutSkippedItem[] = (() => {
    const dbKeys = new Set(items.map((i) => itemKey(i.title, i.subtitle, i.item_url)))
    const fromSession = effectiveSession
      .filter((s) => !dismissedSessionIds.has(s.id))
      .filter((s) => !dbKeys.has(itemKey(s.title, s.subtitle ?? null, s.item_url)))
      .map((s) => ({
        ...s,
        module_id: moduleId,
        created_at: s.created_at ?? new Date().toISOString(),
      }))
    return [...fromSession, ...items]
  })()

  const categoriesPresent = useMemo(
    () => [...new Set(displayItems.map((i) => i.skip_category))].sort(),
    [displayItems],
  )

  const filteredItems = useMemo(
    () => (categoryFilter === 'all' ? displayItems : displayItems.filter((i) => i.skip_category === categoryFilter)),
    [categoryFilter, displayItems],
  )

  function requestDismiss(item: ScoutSkippedItem) {
    openDismiss({
      action: 'dismiss',
      title: item.title,
      subtitle: item.subtitle,
      itemUrl: item.item_url,
      skipCategory: item.skip_category,
      onConfirm: async () => { await dismiss(item.id) },
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setWarning(null)
    const res = await fetch(`/api/modules/scout-skipped?module=${moduleId}`)
    const data = await res.json()
    if (data.warning === 'scout_skipped_table_missing') {
      setWarning(ss.warnings.tableMissing)
    } else if (!res.ok && data.error) {
      setWarning(data.error)
    }
    if (res.ok) setItems(data.items ?? [])
    setLoading(false)
  }, [moduleId, ss.warnings.tableMissing])

  useEffect(() => { load() }, [load, refreshKey])

  async function promote(id: string) {
    setBusyId(id)
    const item = displayItems.find((i) => i.id === id)
    let res: Response
    if (id.startsWith('session-') && moduleId === 'funding-scout' && item) {
      res = await fetch('/api/modules/funding-scout/promote-skipped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          subtitle: item.subtitle,
          itemUrl: item.item_url,
          skipReason: item.skip_reason,
          skipCategory: item.skip_category,
          fitScore: item.fit_score,
          candidateData: item.candidate_data ?? {},
        }),
      })
    } else {
      res = await fetch(`/api/modules/scout-skipped/${id}`, { method: 'POST' })
    }
    setBusyId(null)
    if (res.ok) {
      if (id.startsWith('session-')) {
        setDismissedSessionIds((prev) => new Set(prev).add(id))
        onSessionDismiss?.(id)
      } else {
        setItems((prev) => prev.filter((i) => i.id !== id))
      }
      onPromoted?.()
    }
  }

  async function dismiss(id: string) {
    setBusyId(id)
    if (id.startsWith('session-')) {
      setDismissedSessionIds((prev) => new Set(prev).add(id))
      onSessionDismiss?.(id)
    } else {
      await fetch(`/api/modules/scout-skipped/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((i) => i.id !== id))
    }
    setBusyId(null)
  }

  function categoryLabel(cat: string) {
    return ss.categories[cat as keyof typeof ss.categories] ?? cat
  }

  if (!hydrated && displayItems.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">{t.common.loading}</p>
  }

  return (
    <GlassPanel className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)]">
          {ss.title}
          {displayItems.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--accent)]">({displayItems.length})</span>
          )}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">{ss.hint}</p>
      </div>
      {warning && (
        <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs">{warning}</p>
      )}
      {loading && displayItems.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">{t.common.loading}</p>
      )}
      {displayItems.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{ss.empty}</p>
      ) : (
        <>
          {categoriesPresent.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{ss.filterLabel}:</span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--background-alt)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {ss.filterAll} ({displayItems.length})
              </button>
              {categoriesPresent.map((cat) => {
                const count = displayItems.filter((i) => i.skip_category === cat).length
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      categoryFilter === cat
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--background-alt)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {categoryLabel(cat)} ({count})
                  </button>
                )
              })}
            </div>
          )}
          <ul className="max-h-72 space-y-2 overflow-auto">
          {filteredItems.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm"
            >
              <div className="font-medium text-[var(--text)]">{item.subtitle ?? item.title}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.title}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-[var(--background-alt)] px-1.5 py-0.5 text-[var(--text-muted)]">
                  {categoryLabel(item.skip_category)}
                </span>
                {item.fit_score != null && (
                  <span className="text-[var(--accent)]">{ss.fit}: {item.fit_score}%</span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{item.skip_reason}</p>
              {item.item_url && (
                <a
                  href={item.item_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-[var(--accent)] hover:underline"
                >
                  {ss.openLink}
                </a>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => promote(item.id)}
                >
                  {busyId === item.id ? t.common.loading : ss.generatePack}
                </Button>
                <Button
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => requestDismiss(item)}
                >
                  {ss.dismiss}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
      {dismissDialog}
    </GlassPanel>
  )
}
