'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'
import { useLocale } from '@/components/shell/LocaleProvider'
import { cn } from '@aslico/ui'
import { InboxTab } from './InboxTab'
import { ProfileTab } from './ProfileTab'
import { PreferencesTab } from './PreferencesTab'
import { NewPackTab } from './NewPackTab'
import { HistoryTab } from './HistoryTab'
import { WatchlistTab } from './WatchlistTab'
import { AnalyticsTab } from './AnalyticsTab'
import { OutreachTab } from './OutreachTab'
import { GuideTab } from './GuideTab'

type Tab = 'guide' | 'inbox' | 'new' | 'profile' | 'preferences' | 'watchlist' | 'analytics' | 'outreach' | 'history'

export function JobAgentView() {
  const { t } = useLocale()
  const ja = t.jobAgent
  const searchParams = useSearchParams()
  const mod = getModuleById('job-agent')
  const [tab, setTab] = useState<Tab>('guide')
  const [warning, setWarning] = useState<string | null>(null)
  const [gmailNotice, setGmailNotice] = useState<string | null>(null)

  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (
      urlTab === 'guide' ||
      urlTab === 'inbox' ||
      urlTab === 'new' ||
      urlTab === 'profile' ||
      urlTab === 'preferences' ||
      urlTab === 'watchlist' ||
      urlTab === 'analytics' ||
      urlTab === 'outreach' ||
      urlTab === 'history'
    ) {
      setTab(urlTab)
    }
    if (searchParams.get('gmail_connected') === '1') {
      setGmailNotice(ja.outreach.gmailConnected)
    } else if (searchParams.get('gmail_error')) {
      setGmailNotice(`${ja.outreach.gmailConnectFailed}: ${searchParams.get('gmail_error')}`)
    }
  }, [searchParams, ja.outreach.gmailConnected, ja.outreach.gmailConnectFailed])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'guide', label: ja.tabs.guide },
    { id: 'inbox', label: ja.tabs.inbox },
    { id: 'new', label: ja.tabs.new },
    { id: 'profile', label: ja.tabs.profile },
    { id: 'preferences', label: ja.tabs.preferences },
    { id: 'watchlist', label: ja.tabs.watchlist },
    { id: 'analytics', label: ja.tabs.analytics },
    { id: 'outreach', label: ja.tabs.outreach },
    { id: 'history', label: ja.tabs.history },
  ]

  return (
    <ShellLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <ModuleGlyph
              moduleId="job-agent"
              primary={mod?.accent.primary ?? '#f97316'}
              glow={mod?.accent.glow ?? '#ea580c'}
              size={72}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--text)]">{t.modules['job-agent'].name}</h1>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                  {t.common.beta}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{ja.subtitle}</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 border-b border-[var(--surface-border)] pb-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                tab === item.id
                  ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--accent)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {warning && (
          <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]">
            {warning}
          </p>
        )}

        {gmailNotice && (
          <p className="rounded-lg border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm text-[var(--text)]">
            {gmailNotice}
          </p>
        )}

        {tab === 'guide' && (
          <GuideTab
            onWarning={setWarning}
            onNavigate={(t) => setTab(t as Tab)}
          />
        )}
        {tab === 'inbox' && <InboxTab onWarning={setWarning} />}
        {tab === 'new' && <NewPackTab onWarning={setWarning} onDone={() => setTab('inbox')} />}
        {tab === 'profile' && <ProfileTab onWarning={setWarning} />}
        {tab === 'preferences' && <PreferencesTab onWarning={setWarning} />}
        {tab === 'watchlist' && <WatchlistTab onWarning={setWarning} />}
        {tab === 'analytics' && <AnalyticsTab onWarning={setWarning} />}
        {tab === 'outreach' && <OutreachTab onWarning={setWarning} />}
        {tab === 'history' && <HistoryTab onWarning={setWarning} />}
      </div>
    </ShellLayout>
  )
}
