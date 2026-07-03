'use client'

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition,
  )
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function createSpeechRecognition(locale: string): BrowserSpeechRecognition | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.continuous = false
  rec.interimResults = false
  rec.lang =
    locale === 'tr' ? 'tr-TR'
    : locale === 'fr' ? 'fr-FR'
    : locale === 'es' ? 'es-ES'
    : locale === 'ar' ? 'ar-SA'
    : 'en-US'
  return rec
}

export function speakText(text: string, locale: string) {
  if (!isSpeechSynthesisSupported()) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang =
    locale === 'tr' ? 'tr-TR'
    : locale === 'fr' ? 'fr-FR'
    : locale === 'es' ? 'es-ES'
    : locale === 'ar' ? 'ar-SA'
    : 'en-US'
  utter.rate = 1
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}
