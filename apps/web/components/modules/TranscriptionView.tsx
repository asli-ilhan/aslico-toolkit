'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

interface TranscriptionItem {
  id: string
  title: string
  transcript: string
  summary: string | null
  source_filename: string | null
  language: string | null
  created_at: string
}

export function TranscriptionView() {
  const { t, locale } = useLocale()
  const tx = t.transcription
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<TranscriptionItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'audio' | 'paste'>('audio')
  const [pastedTitle, setPastedTitle] = useState('')
  const [pastedText, setPastedText] = useState('')

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/modules/transcription')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? tx.errors.loadFailed)
        return
      }
      if (data.warning === 'transcriptions_table_missing') {
        setWarning(tx.warnings.tableMissing)
      }
      setItems(data.items ?? [])
      if (data.items?.length && !selectedId) {
        setSelectedId(data.items[0].id)
      }
    } catch {
      setError(tx.errors.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [selectedId, tx.errors.loadFailed, tx.warnings.tableMissing])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    setWarning(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('locale', locale)

    try {
      const res = await fetch('/api/modules/transcription', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 503) {
          setError(
            data.error?.includes('DEEPGRAM')
              ? tx.errors.noDeepgramKey
              : tx.errors.noAnthropicKey,
          )
        } else {
          setError(data.error ?? tx.errors.uploadFailed)
        }
        return
      }

      if (data.warning === 'transcriptions_table_missing') {
        setWarning(tx.warnings.tableMissing)
        if (data.transcript) {
          const temp: TranscriptionItem = {
            id: `temp-${Date.now()}`,
            title: file.name.replace(/\.[^.]+$/, '') || 'Recording',
            transcript: data.transcript,
            summary: data.summary ?? null,
            source_filename: file.name,
            language: data.language ?? null,
            created_at: new Date().toISOString(),
          }
          setItems((prev) => [temp, ...prev])
          setSelectedId(temp.id)
        }
        return
      }

      if (data.item) {
        setItems((prev) => [data.item, ...prev])
        setSelectedId(data.item.id)
      }
    } catch {
      setError(tx.errors.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  async function handlePasteSubmit() {
    const transcript = pastedText.trim()
    if (!transcript) return

    setUploading(true)
    setError(null)
    setWarning(null)

    try {
      const res = await fetch('/api/modules/transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: pastedTitle.trim() || tx.paste.titlePlaceholder,
          locale,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 503) {
          setError(tx.errors.noAnthropicKey)
        } else {
          setError(data.error ?? tx.errors.uploadFailed)
        }
        return
      }

      if (data.warning === 'transcriptions_table_missing') {
        setWarning(tx.warnings.tableMissing)
        const temp: TranscriptionItem = {
          id: `temp-${Date.now()}`,
          title: pastedTitle.trim() || tx.paste.titlePlaceholder,
          transcript: data.transcript ?? transcript,
          summary: data.summary ?? null,
          source_filename: null,
          language: null,
          created_at: new Date().toISOString(),
        }
        setItems((prev) => [temp, ...prev])
        setSelectedId(temp.id)
        setPastedText('')
        return
      }

      if (data.item) {
        setItems((prev) => [data.item, ...prev])
        setSelectedId(data.item.id)
        setPastedText('')
      }
    } catch {
      setError(tx.errors.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (id.startsWith('temp-')) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      return
    }
    const res = await fetch(`/api/modules/transcription/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const dateLocale =
    locale === 'tr'
      ? 'tr-TR'
      : locale === 'fr'
        ? 'fr-FR'
        : locale === 'es'
          ? 'es-ES'
          : locale === 'ar'
            ? 'ar'
            : 'en-US'

  const mod = getModuleById('transcription')

  return (
    <ShellLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            {t.common.backToDashboard}
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <ModuleGlyph
              moduleId="transcription"
              primary={mod?.accent.primary ?? '#fb923c'}
              glow={mod?.accent.glow ?? '#f97316'}
              size={72}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--text)]">
                  {t.modules.transcription.name}
                </h1>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                  {t.common.beta}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t.modules.transcription.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('audio')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              mode === 'audio'
                ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--accent)]',
            )}
          >
            {tx.upload}
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              mode === 'paste'
                ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--accent)]',
            )}
          >
            {tx.paste.tab}
          </button>
        </div>

        {mode === 'audio' ? (
        <div
          className={cn(
            'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--surface-border)] bg-[var(--background-alt)]/30',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <p className="text-sm font-medium text-[var(--text)]">{tx.dropzone}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{tx.formats}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
          <Button
            className="mt-4"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? tx.transcribing : tx.upload}
          </Button>
        </div>
        ) : (
        <GlassPanel className="p-6">
          <input
            type="text"
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
            placeholder={tx.paste.titlePlaceholder}
            className="mb-3 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={tx.paste.placeholder}
            rows={8}
            className="w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <Button
            className="mt-4"
            disabled={uploading || !pastedText.trim()}
            onClick={handlePasteSubmit}
          >
            {uploading ? tx.paste.summarizing : tx.paste.submit}
          </Button>
        </GlassPanel>
        )}

        {warning && (
          <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
            {warning}
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <GlassPanel className="p-4 lg:col-span-1">
            <h2 className="text-sm font-semibold text-[var(--text)]">{tx.history}</h2>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">{t.common.loading}</p>
            ) : items.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">{tx.empty}</p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                        selected?.id === item.id
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                          : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--accent)]',
                      )}
                    >
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs opacity-70">
                        {new Date(item.created_at).toLocaleString(dateLocale)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel className="p-6 lg:col-span-2">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text)]">{selected.title}</h2>
                    {selected.source_filename && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {selected.source_filename}
                        {selected.language ? ` · ${selected.language}` : ''}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selected.id)}
                  >
                    {t.common.delete}
                  </Button>
                </div>

                {selected.summary && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-[var(--text)]">{tx.summary}</h3>
                    <div className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-sm leading-relaxed text-[var(--text-muted)]">
                      {selected.summary}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[var(--text)]">{tx.transcript}</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(selected.transcript)}
                    >
                      {tx.copy}
                    </Button>
                  </div>
                  <div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 p-4 text-sm leading-relaxed text-[var(--text)]">
                    {selected.transcript}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">{tx.selectOrUpload}</p>
            )}
          </GlassPanel>
        </div>
      </div>
    </ShellLayout>
  )
}
