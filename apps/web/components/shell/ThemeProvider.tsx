'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { themes, defaultThemeId, type ThemeTokens } from '@aslico/ui/themes'

interface ThemeContextValue {
  theme: ThemeTokens
  themeId: string
  reducedMotion: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: ThemeTokens) {
  const root = document.documentElement
  root.style.setProperty('--background', theme.colors.background)
  root.style.setProperty('--background-alt', theme.colors.backgroundAlt)
  root.style.setProperty('--surface', theme.colors.surface)
  root.style.setProperty('--surface-border', theme.colors.surfaceBorder)
  root.style.setProperty('--text', theme.colors.text)
  root.style.setProperty('--text-muted', theme.colors.textMuted)
  root.style.setProperty('--accent', theme.colors.accent)
  root.style.setProperty('--accent-soft', theme.colors.accentSoft)
  root.style.setProperty('--glow', theme.colors.glow)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const theme = themes[defaultThemeId]

  useEffect(() => {
    localStorage.removeItem('aslico-theme')
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const value = useMemo(
    () => ({ theme, themeId: defaultThemeId, reducedMotion }),
    [theme, reducedMotion],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
