'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'

interface WatchlistTabProps {
  onWarning: (msg: string | null) => void
}

interface WatchItem {
  id: string
  kind: string
  value: string
  label: string | null
  enabled: boolean
}

export function WatchlistTab({ onWarning }: WatchlistTabProps) {
  const { t } = useLocale()
  const ja = t.jobAgent
  const [items, setItems] = useState<WatchItem[]>([])
  const [kind, setKind] = useState('url')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')

  const load = useCallback(async () => {
    onWarning(null)
    const res = await fetch('/api/modules/job-agent/watchlist')
    const data = await res.json()
    if (data.warning) onWarning(ja.warnings.v3Missing)
    setItems(data.items ?? [])
  }, [ja.warnings.v3Missing, onWarning])

  useEffect(() => {
    load()
  }, [load])

  async function addItem() {
    if (!value.trim()) return
    await fetch('/api/modules/job-agent/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value, label: label || undefined }),
    })
    setValue('')
    setLabel('')
    load()
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/modules/job-agent/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/modules/job-agent/watchlist/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <GlassPanel className="space-y-4 p-6">
      <p className="text-xs text-[var(--text-muted)]">
        {ja.watchlist.hint}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
        >
          <option value="url">{ja.watchlist.url}</option>
          <option value="careers">{ja.watchlist.careers}</option>
          <option value="rss">{ja.watchlist.rss}</option>
          <option value="keyword">{ja.watchlist.keyword}</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ja.watchlist.kind}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm sm:col-span-2"
        />
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={ja.watchlist.label}
        className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
      />
      <Button onClick={addItem}>{ja.watchlist.add}</Button>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{ja.watchlist.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm"
            >
              <div>
                <span className="text-xs uppercase text-[var(--accent)]">{item.kind}</span>
                <p className="text-[var(--text)]">{item.label ?? item.value}</p>
                {item.label && (
                  <p className="text-xs text-[var(--text-muted)]">{item.value}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle(item.id, !item.enabled)}
                  className="text-xs text-[var(--accent)]"
                >
                  {item.enabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
