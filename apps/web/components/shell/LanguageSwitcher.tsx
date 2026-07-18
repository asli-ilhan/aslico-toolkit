'use client'

import { LOCALES } from '@/lib/i18n'
import { useLocale } from './LocaleProvider'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <div
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-50 flex flex-wrap items-center gap-1 font-mono text-xs tracking-widest text-[var(--text-muted)]"
      role="navigation"
      aria-label="Language"
    >
      {LOCALES.map(({ code, label }, i) => (
        <span key={code} className="inline-flex items-center">
          {i > 0 && <span className="mx-0.5 opacity-40">·</span>}
          <button
            type="button"
            onClick={() => setLocale(code)}
            className={
              locale === code
                ? 'min-h-9 min-w-9 px-1.5 text-[var(--accent)] opacity-100'
                : 'min-h-9 min-w-9 px-1.5 opacity-50 transition-opacity hover:text-[var(--accent)] hover:opacity-80'
            }
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  )
}
