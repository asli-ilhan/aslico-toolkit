'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isAutofillDaemonRunning } from '@/lib/job-agent/autofill-client'
import { DiscoveryPanel } from './DiscoveryPanel'

interface SetupStatus {
  sqlV2: boolean
  sqlV3: boolean
  sqlV4: boolean
  profile: boolean
  gmail: boolean
  gmailMode: 'env' | 'oauth' | null
  inboxCount: number
  isProduction: boolean
  isDev: boolean
  appUrl: string
}

interface GuideTabProps {
  onWarning: (msg: string | null) => void
  onNavigate: (tab: string) => void
}

function StepCard({
  done,
  optional,
  title,
  children,
}: {
  done?: boolean
  optional?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <GlassPanel className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            done ? 'bg-[var(--accent)] text-white' : 'border border-[var(--surface-border)] text-[var(--text-muted)]',
          )}
          aria-hidden
        >
          {done ? '✓' : optional ? '·' : '○'}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          {children}
        </div>
      </div>
    </GlassPanel>
  )
}

function CopyBlock({ text }: { text: string }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/60 p-3 pr-16 text-xs text-[var(--text)]">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)] hover:opacity-90"
      >
        {copied ? '✓' : t.jobAgent.guide.copy}
      </button>
    </div>
  )
}

export function GuideTab({ onWarning, onNavigate }: GuideTabProps) {
  const { t } = useLocale()
  const g = t.jobAgent.guide
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [daemonOk, setDaemonOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    onWarning(null)
    const [statusRes, daemon] = await Promise.all([
      fetch('/api/modules/job-agent/setup-status'),
      isAutofillDaemonRunning(),
    ])
    const data = await statusRes.json()
    if (statusRes.ok) setStatus(data)
    setDaemonOk(daemon)
    setLoading(false)
  }, [onWarning])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !status) {
    return <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
  }

  const sqlDone = status.sqlV2 && status.sqlV3 && status.sqlV4

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{g.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{g.subtitle}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={sqlDone ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.db}: {sqlDone ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={status.profile ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.profile}: {status.profile ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={status.gmail ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.gmail}: {status.gmail ? g.done : g.pending}
          </span>
        </div>
      </div>

      <ol className="space-y-4">
        <li>
          <StepCard done={sqlDone} title={g.steps.sql.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.sql.body}</p>
            <ul className="list-inside list-disc text-xs text-[var(--text-muted)]">
              <li className={status.sqlV2 ? 'text-[var(--accent)]' : ''}>job_agent_v2.sql {status.sqlV2 ? '✓' : ''}</li>
              <li className={status.sqlV3 ? 'text-[var(--accent)]' : ''}>job_agent_v3.sql {status.sqlV3 ? '✓' : ''}</li>
              <li className={status.sqlV4 ? 'text-[var(--accent)]' : ''}>job_agent_v4_outreach.sql {status.sqlV4 ? '✓' : ''}</li>
            </ul>
            <CopyBlock text={g.steps.sql.files} />
          </StepCard>
        </li>

        <li>
          <StepCard done={status.profile} title={g.steps.profile.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.profile.body}</p>
            <Button variant="outline" onClick={() => onNavigate('profile')}>
              {g.steps.profile.action}
            </Button>
          </StepCard>
        </li>

        <li>
          <StepCard optional title={g.steps.prefs.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.prefs.body}</p>
            <Button variant="outline" onClick={() => onNavigate('preferences')}>
              {g.steps.prefs.action}
            </Button>
          </StepCard>
        </li>

        <li>
          <StepCard done={status.inboxCount > 0} title={g.steps.discovery.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.discovery.body}</p>
            <DiscoveryPanel onComplete={load} onWarning={onWarning} compact />
            {status.isProduction && (
              <p className="text-xs text-[var(--accent)]">{g.steps.discovery.cron}</p>
            )}
          </StepCard>
        </li>

        <li>
          <StepCard title={g.steps.inbox.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.inbox.body}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {g.steps.inbox.pending}: {status.inboxCount}
            </p>
            <Button variant="outline" onClick={() => onNavigate('inbox')}>
              {g.steps.inbox.action}
            </Button>
          </StepCard>
        </li>

        <li>
          <StepCard done={status.gmail} title={g.steps.gmail.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.gmail.body}</p>
            {status.gmail && status.gmailMode === 'env' && (
              <p className="text-xs text-[var(--accent)]">{g.steps.gmail.envOk}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onNavigate('preferences')}>
                {g.steps.gmail.action}
              </Button>
              {!status.gmail && status.isDev && (
                <a
                  href="/api/dev/gmail-token"
                  className="inline-flex items-center rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  {g.steps.gmail.tokenLink}
                </a>
              )}
            </div>
          </StepCard>
        </li>

        <li>
          <StepCard done={daemonOk === true} title={g.steps.autofill.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.autofill.body}</p>
            <p className="text-xs">
              {daemonOk === true ?
                <span className="text-[var(--accent)]">{g.steps.autofill.running}</span>
              : <span className="text-[var(--text-muted)]">{g.steps.autofill.stopped}</span>}
            </p>
            <CopyBlock text="pnpm autofill:daemon" />
            <Button variant="outline" className="mt-2" onClick={load}>
              {g.refresh}
            </Button>
          </StepCard>
        </li>

        <li>
          <StepCard title={g.steps.deploy.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.deploy.body}</p>
            <ol className="list-decimal space-y-3 pl-4 text-sm text-[var(--text-muted)]">
              <li>{g.steps.deploy.s1}</li>
              <li>{g.steps.deploy.s2}</li>
              <li>{g.steps.deploy.s3}</li>
              <li>{g.steps.deploy.s4}</li>
            </ol>
            <CopyBlock text={g.steps.deploy.gitInit} />
            <CopyBlock text={`cd apps/web && npx vercel --prod`} />
            <p className="text-xs text-[var(--text-muted)]">{g.steps.deploy.envHint}</p>
            <ul className="list-inside list-disc text-xs text-[var(--text-muted)]">
              {g.steps.deploy.envList.split('|').map((item) => (
                <li key={item}>{item.trim()}</li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)]">{g.steps.deploy.cronNote}</p>
          </StepCard>
        </li>
      </ol>

      <GlassPanel className="border-[var(--accent)]/20 bg-[var(--accent-soft)]/30 p-4">
        <p className="text-sm font-medium text-[var(--text)]">{g.dailyTitle}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{g.dailyBody}</p>
      </GlassPanel>
    </div>
  )
}
