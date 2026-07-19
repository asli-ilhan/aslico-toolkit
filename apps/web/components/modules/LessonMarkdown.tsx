'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@aslico/ui'

export function LessonMarkdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'lesson-md max-w-none text-sm leading-relaxed text-[var(--text)]',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-base font-semibold text-[var(--accent)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-sm font-semibold text-[var(--text)]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 text-[var(--text-muted)]">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--text)]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-[var(--text)]">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-[var(--text-muted)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-[var(--text-muted)]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-[var(--accent)]/50 bg-[var(--background-alt)]/40 px-3 py-2 text-[var(--text-muted)]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-[var(--surface-border)]" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline underline-offset-2 hover:opacity-90"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass)
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-[var(--background-alt)]/60 p-3 text-xs text-[var(--text)]">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-[var(--background-alt)]/70 px-1.5 py-0.5 text-[0.85em] text-[var(--accent)]">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/40 p-3">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--surface-border)]">
              <table className="min-w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--background-alt)]/60 text-[var(--text)]">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-t border-[var(--surface-border)]">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-[var(--text)]">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
