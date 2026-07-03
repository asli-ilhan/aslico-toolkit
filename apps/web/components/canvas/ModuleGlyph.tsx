'use client'

import dynamic from 'next/dynamic'
import { cn } from '@aslico/ui'

const ModuleGlyphCanvas = dynamic(() => import('./ModuleGlyphCanvas'), {
  ssr: false,
  loading: () => <div className="animate-pulse rounded-xl bg-[var(--accent-soft)]" />,
})

interface ModuleGlyphProps {
  moduleId: string
  primary?: string
  glow?: string
  size?: number
  className?: string
}

export function ModuleGlyph({
  moduleId,
  primary = 'var(--accent)',
  glow = 'var(--glow)',
  size = 48,
  className,
}: ModuleGlyphProps) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded-xl', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ModuleGlyphCanvas moduleId={moduleId} size={size} primary={primary} glow={glow} />
    </div>
  )
}
