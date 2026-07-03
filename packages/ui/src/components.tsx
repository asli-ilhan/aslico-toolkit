import type { ReactNode, ButtonHTMLAttributes } from 'react'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export interface GlassPanelProps {
  children: ReactNode
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-[var(--surface-border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(249,115,22,0.08),0_8px_24px_rgba(28,25,23,0.04)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-[var(--accent)] text-white hover:opacity-90 shadow-[0_0_24px_var(--accent-soft)]',
    ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--accent-soft)]',
    outline:
      'bg-transparent border border-[var(--surface-border)] text-[var(--text)] hover:border-[var(--accent)]',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
