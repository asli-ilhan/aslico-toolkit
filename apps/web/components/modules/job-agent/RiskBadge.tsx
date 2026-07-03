import { cn } from '@aslico/ui'

export function RiskBadge({ level, reason }: { level: string; reason: string | null }) {
  const colors =
    level === 'high'
      ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'medium'
        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30'
        : 'bg-stone-100 text-stone-600 border-stone-200'

  return (
    <div className={cn('mt-2 inline-block rounded-lg border px-2 py-1 text-[10px] uppercase', colors)}>
      AI risk: {level}
      {reason ? ` · ${reason}` : ''}
    </div>
  )
}
