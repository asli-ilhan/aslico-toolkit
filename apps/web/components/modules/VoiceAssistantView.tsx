'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
} from '@/lib/voice/speech'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export function VoiceAssistantView() {
  const { t, locale } = useLocale()
  const va = t.voiceAssistant
  const mod = getModuleById('voice-assistant')!
  const bottomRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/modules/voice-assistant')
    const data = await res.json()
    if (data.warning === 'assistant_table_missing') setWarning(va.warnings.tableMissing)
    if (res.ok) setMessages(data.messages ?? [])
    setLoading(false)
  }, [va.warnings.tableMissing])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    setError(null)
    setInput('')

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/modules/voice-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, locale }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? va.errors.sendFailed)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }

      if (data.warning === 'assistant_table_missing') setWarning(va.warnings.tableMissing)

      const assistant: Message = {
        id: `tmp-a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      }
      setMessages((prev) => [...prev, assistant])

      if (speakReplies && isSpeechSynthesisSupported()) {
        speakText(data.reply, locale)
      }
    } catch {
      setError(va.errors.sendFailed)
    } finally {
      setSending(false)
    }
  }

  function startListening() {
    const rec = createSpeechRecognition(locale)
    if (!rec) {
      setError(va.errors.noMic)
      return
    }
    setListening(true)
    setError(null)
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? ''
      if (text) send(text)
    }
    rec.onerror = () => setError(va.errors.noMic)
    rec.onend = () => setListening(false)
    rec.start()
  }

  async function clearHistory() {
    await fetch('/api/modules/voice-assistant', { method: 'DELETE' })
    setMessages([])
    stopSpeaking()
  }

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph
          moduleId="voice-assistant"
          primary={mod.accent.primary}
          glow={mod.accent.glow}
          size={72}
        />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{va.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{va.subtitle}</p>
        </div>
      </div>

      {warning && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {warning}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <GlassPanel className="flex h-[min(70vh,560px)] flex-col p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ?
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          : messages.length === 0 ?
            <p className="text-sm text-[var(--text-muted)]">{va.empty}</p>
          : messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2 text-sm',
                  m.role === 'user' ?
                    'ml-auto bg-[var(--accent)] text-white'
                  : 'bg-[var(--background-alt)]/80 text-[var(--text)]',
                )}
              >
                {m.content}
              </div>
            ))
          }
          {sending && (
            <p className="text-sm text-[var(--text-muted)]">{va.thinking}</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 space-y-2 border-t border-[var(--surface-border)] pt-4">
          <div className="flex flex-wrap gap-2">
            {va.quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder={va.placeholder}
              className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
            {isSpeechRecognitionSupported() && (
              <Button
                variant="outline"
                onClick={startListening}
                disabled={listening || sending}
                aria-pressed={listening}
              >
                {listening ? va.listening : va.mic}
              </Button>
            )}
            <Button onClick={() => send(input)} disabled={sending || !input.trim()}>
              {sending ? va.sending : va.send}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={speakReplies}
                onChange={(e) => setSpeakReplies(e.target.checked)}
              />
              {va.speakReplies}
            </label>
            <button type="button" onClick={clearHistory} className="hover:text-[var(--accent)]">
              {va.clear}
            </button>
          </div>
        </div>
      </GlassPanel>
    </ShellLayout>
  )
}
