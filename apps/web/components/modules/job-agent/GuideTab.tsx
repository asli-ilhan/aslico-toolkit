'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { isAutofillDaemonRunning } from '@/lib/job-agent/autofill-client'
import { DiscoveryPanel } from './DiscoveryPanel'

const ONCE_SETUP = 'pnpm install\nnpx playwright install chromium'
const DAEMON_CMD = 'pnpm autofill:daemon'

interface SetupStatus {
  sqlV2: boolean
  sqlV3: boolean
  sqlV4: boolean
  profile: boolean
  gmail: boolean
  gmailMode: 'env' | 'oauth' | null
  inboxCount: number
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
    if (statusRes.ok) {
      setStatus({
        sqlV2: !!data.sqlV2,
        sqlV3: !!data.sqlV3,
        sqlV4: !!data.sqlV4,
        profile: !!data.profile,
        gmail: !!data.gmail,
        gmailMode: data.gmailMode ?? null,
        inboxCount: data.inboxCount ?? 0,
      })
    }
    setDaemonOk(daemon)
    setLoading(false)
  }, [onWarning])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !status) {
    return <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
  }

  const dbReady = status.sqlV2 && status.sqlV3 && status.sqlV4
  const gmailDone = status.gmail
  const gmailNeedsUser = status.gmailMode !== 'env'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{g.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{g.subtitle}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={dbReady ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.database}: {dbReady ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={status.profile ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.profile}: {status.profile ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={gmailDone ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.gmail}: {gmailDone ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs">
          <span className={daemonOk === true ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.autofill}: {daemonOk === true ? g.done : g.pending}
          </span>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-center text-xs sm:col-span-3 lg:col-span-1">
          <span className={status.inboxCount > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
            {g.progress.inbox}: {status.inboxCount > 0 ? status.inboxCount : g.pending}
          </span>
        </div>
      </div>

      <ol className="space-y-4">
        <li>
          <StepCard done={dbReady} title={g.steps.database.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.database.body}</p>
            <p className="text-xs text-[var(--text-muted)]">{g.steps.database.supabaseHint}</p>
            <ul className="list-inside list-disc text-xs text-[var(--text-muted)]">
              <li>
                {g.steps.database.fileV2}
                {!status.sqlV2 ? ` — ${g.pending}` : ` — ${g.done}`}
              </li>
              <li>
                {g.steps.database.fileV3}
                {!status.sqlV3 ? ` — ${g.pending}` : ` — ${g.done}`}
              </li>
              <li>
                {g.steps.database.fileV4}
                {!status.sqlV4 ? ` — ${g.pending}` : ` — ${g.done}`}
              </li>
            </ul>
            <Button variant="outline" className="mt-2" onClick={load}>
              {g.refresh}
            </Button>
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
            <p className="text-xs text-[var(--text-muted)]">{g.steps.discovery.nightlyNote}</p>
            <DiscoveryPanel onComplete={load} onWarning={onWarning} compact />
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
          <StepCard done={daemonOk === true} title={g.steps.autofill.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.autofill.body}</p>
            <p className="text-xs font-medium text-[var(--text)]">{g.steps.autofill.onceLabel}</p>
            <p className="text-xs text-[var(--text-muted)]">{g.steps.autofill.onceHint}</p>
            <CopyBlock text={ONCE_SETUP} />
            <p className="text-xs font-medium text-[var(--text)]">{g.steps.autofill.sessionLabel}</p>
            <p className="text-xs">
              {daemonOk === true ?
                <span className="text-[var(--accent)]">{g.steps.autofill.running}</span>
              : <span className="text-[var(--text-muted)]">{g.steps.autofill.stopped}</span>}
            </p>
            <CopyBlock text={DAEMON_CMD} />
            <p className="text-xs text-[var(--text-muted)]">
              {t.jobAgent.autofill.run} — {t.jobAgent.inbox.title}
            </p>
            <Button variant="outline" className="mt-2" onClick={load}>
              {g.refresh}
            </Button>
          </StepCard>
        </li>

        <li>
          <StepCard done={gmailDone} title={g.steps.gmail.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.gmail.body}</p>
            {status.gmailMode === 'env' ?
              <p className="text-xs text-[var(--accent)]">{g.steps.gmail.envDone}</p>
            : <p className="text-xs">
                {gmailDone ?
                  <span className="text-[var(--accent)]">{g.steps.gmail.connected}</span>
                : <span className="text-[var(--text-muted)]">{g.steps.gmail.pending}</span>}
              </p>
            }
            {gmailNeedsUser && (
              <Button variant="outline" onClick={() => onNavigate('preferences')}>
                {g.steps.gmail.action}
              </Button>
            )}
          </StepCard>
        </li>

        <li>
          <StepCard title={g.steps.outreach.title}>
            <p className="text-sm text-[var(--text-muted)]">{g.steps.outreach.body}</p>
            <Button variant="outline" onClick={() => onNavigate('outreach')}>
              {g.steps.outreach.action}
            </Button>
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
