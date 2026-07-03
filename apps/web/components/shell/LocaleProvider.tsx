'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_LOCALE,
  LOCALES,
  RTL_LOCALES,
  getMessages,
  type Locale,
  type Messages,
} from '@/lib/i18n'

const STORAGE_KEY = 'aslico-locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
  dir: 'ltr' | 'rtl'
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored && LOCALES.some((l) => l.code === stored)) return stored
  const browser = navigator.language.slice(0, 2) as Locale
  if (LOCALES.some((l) => l.code === browser)) return browser
  return DEFAULT_LOCALE
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLocaleState(detectLocale())
    setMounted(true)
  }, [])

  const dir: 'ltr' | 'rtl' = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'

  useEffect(() => {
    if (!mounted) return
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir, mounted])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useMemo(() => getMessages(locale), [locale])

  const value = useMemo(
    () => ({ locale, setLocale, t, dir }),
    [locale, setLocale, t, dir],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
