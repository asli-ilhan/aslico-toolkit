'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AssistantOrb3D } from '@/components/canvas/AssistantOrb3D'
import { GlassPanel, Button } from '@aslico/ui'
import { useLocale } from './LocaleProvider'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
} from '@/lib/voice/speech'

interface MiniMessage {
  role: 'user' | 'assistant'
  content: string
}

export function AssistantOrb() {
  const [open, setOpen] = useState(false)
  const { t, locale } = useLocale()
  const a = t.assistant
  const va = t.voiceAssistant

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<MiniMessage[]>([])
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setSending(true)
      setInput('')
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
      try {
        const res = await fetch('/api/modules/voice-assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, locale }),
        })
        const data = await res.json()
        if (res.ok && data.reply) {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
          if (speakReplies && isSpeechSynthesisSupported()) speakText(data.reply, locale)
        }
      } finally {
        setSending(false)
      }
    },
    [locale, sending, speakReplies],
  )

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, sending])

  function startListening() {
    const rec = createSpeechRecognition(locale)
    if (!rec) return
    setListening(true)
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? ''
      if (text) send(text)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-80"
          >
            <GlassPanel className="flex max-h-[min(70vh,420px)] flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text)]">{a.title}</p>
                <Link
                  href="/voice-assistant"
                  className="text-xs text-[var(--accent)] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {a.openFull}
                </Link>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{a.description}</p>

              <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">{va.empty}</p>
                )}
                {messages.map((m, i) => (
                  <p
                    key={i}
                    className={
                      m.role === 'user' ?
                        'ml-4 text-right text-xs text-[var(--accent)]'
                      : 'text-xs text-[var(--text-muted)]'
                    }
                  >
                    {m.content}
                  </p>
                ))}
                {sending && <p className="text-xs text-[var(--text-muted)]">{a.thinking}</p>}
                <div ref={bottomRef} />
              </div>

              <div className="mt-3 flex gap-1 border-t border-[var(--surface-border)] pt-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send(input)}
                  placeholder={a.placeholder}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-2 py-1.5 text-xs"
                />
                {isSpeechRecognitionSupported() && (
                  <Button
                    variant="outline"
                    className="px-2 text-xs"
                    onClick={startListening}
                    disabled={listening || sending}
                  >
                    {listening ? a.listening : a.mic}
                  </Button>
                )}
                <Button className="px-2 text-xs" onClick={() => send(input)} disabled={sending}>
                  {a.send}
                </Button>
              </div>
              <label className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={speakReplies}
                  onChange={(e) => setSpeakReplies(e.target.checked)}
                />
                {a.speakReplies}
              </label>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={a.ariaLabel}
      >
        <AssistantOrb3D />
      </motion.button>
    </div>
  )
}
