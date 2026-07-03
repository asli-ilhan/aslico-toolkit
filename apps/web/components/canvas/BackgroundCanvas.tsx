'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '../shell/ThemeProvider'

const P5Sketch = dynamic(() => import('./P5Sketch').then((m) => m.P5Sketch), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 -z-10"
      style={{ background: 'var(--background)' }}
      aria-hidden
    />
  ),
})

export function BackgroundCanvas() {
  const { theme, reducedMotion } = useTheme()

  if (reducedMotion) {
    return (
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${theme.colors.accentSoft}, transparent 55%),
            radial-gradient(ellipse at 70% 80%, rgba(251, 146, 60, 0.08), transparent 50%),
            ${theme.canvas.background}`,
        }}
        aria-hidden
      />
    )
  }

  return <P5Sketch />
}
