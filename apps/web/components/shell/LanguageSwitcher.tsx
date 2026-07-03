'use client'

import { LOCALES } from '@/lib/i18n'
import { useLocale } from './LocaleProvider'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <div
      className="fixed bottom-6 left-6 z-50 font-mono text-[11px] tracking-widest text-[var(--text-muted)]"
      role="navigation"
      aria-label="Language"
    >
      {LOCALES.map(({ code, label }, i) => (
        <span key={code}>
          {i > 0 && <span className="mx-1 opacity-40">·</span>}
          <button
            type="button"
            onClick={() => setLocale(code)}
            className={
              locale === code
                ? 'text-[var(--accent)] opacity-100'
                : 'opacity-50 transition-opacity hover:text-[var(--accent)] hover:opacity-80'
            }
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  )
}
