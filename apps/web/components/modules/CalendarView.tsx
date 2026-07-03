'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ShellLayout } from '@/components/shell/ShellLayout'
import { GlassPanel, Button, cn } from '@aslico/ui'
import { useLocale } from '@/components/shell/LocaleProvider'
import { ModuleGlyph } from '@/components/canvas/ModuleGlyph'
import { getModuleById } from '@/lib/module-registry'

interface CalEvent {
  id: string
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  all_day: boolean
  source: string
  source_account?: string | null
  color?: string | null
}

interface Todo {
  id: string
  due_date: string
  title: string
  done: boolean
}

interface Connection {
  id: string
  provider: 'google' | 'microsoft'
  account_email: string | null
}

function sourceLabel(
  source: string,
  labels: { fromJobAgent: string; fromGoogle: string; fromMicrosoft: string },
) {
  if (source === 'job-agent') return labels.fromJobAgent
  if (source === 'google') return labels.fromGoogle
  if (source === 'microsoft') return labels.fromMicrosoft
  return ''
}

function CalendarViewInner() {
  const { t, locale } = useLocale()
  const cal = t.calendar
  const mod = getModuleById('calendar')!
  const searchParams = useSearchParams()

  const [events, setEvents] = useState<CalEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [todoTitle, setTodoTitle] = useState('')
  const [todoDate, setTodoDate] = useState(new Date().toISOString().slice(0, 10))
  const [addingTodo, setAddingTodo] = useState(false)
  const [dayTodoDrafts, setDayTodoDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const to = new Date()
    to.setDate(to.getDate() + 60)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    const [evRes, todoRes, connRes] = await Promise.all([
      fetch(`/api/modules/calendar?from=${fromIso}&to=${toIso}`),
      fetch(`/api/modules/calendar/todos?from=${fromIso}&to=${toIso}`),
      fetch('/api/modules/calendar/connections'),
    ])

    const evData = await evRes.json()
    const todoData = await todoRes.json()
    const connData = await connRes.json()

    if (evData.warning === 'calendar_table_missing') setWarning(cal.warnings.tableMissing)
    if (todoData.warning === 'calendar_v2_missing' || connData.warning === 'calendar_v2_missing') {
      setWarning((w) => w ?? cal.warnings.v2Missing)
    }

    if (evRes.ok) setEvents(evData.events ?? [])
    if (todoRes.ok) setTodos(todoData.todos ?? [])
    if (connRes.ok) setConnections(connData.connections ?? [])
    setLoading(false)
  }, [cal.warnings.tableMissing, cal.warnings.v2Missing])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const connected = searchParams.get('cal_connected')
    const email = searchParams.get('cal_email')
    const err = searchParams.get('cal_error')
    if (connected && email) {
      setNotice(`${cal.connectedAs}: ${email}`)
      load()
    } else if (connected) {
      setNotice(connected)
      load()
    }
    if (err) setNotice(err)
  }, [searchParams, cal.connectedAs, load])

  const groupedDays = useMemo(() => {
    const days = new Set<string>()
    for (const ev of events) days.add(ev.starts_at.slice(0, 10))
    for (const td of todos) days.add(td.due_date)
    return [...days].sort()
  }, [events, todos])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      const key = ev.starts_at.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [events])

  const todosByDay = useMemo(() => {
    const map = new Map<string, Todo[]>()
    for (const td of todos) {
      if (!map.has(td.due_date)) map.set(td.due_date, [])
      map.get(td.due_date)!.push(td)
    }
    return map
  }, [todos])

  async function addEvent() {
    if (!title.trim() || !startsAt) return
    setSaving(true)
    const res = await fetch('/api/modules/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        starts_at: new Date(startsAt).toISOString(),
        all_day: allDay,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.warning === 'calendar_table_missing') {
      setWarning(cal.warnings.tableMissing)
      return
    }
    if (data.event) {
      setEvents((prev) => [...prev, data.event].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      setTitle('')
      setStartsAt('')
    }
  }

  async function removeEvent(id: string) {
    await fetch(`/api/modules/calendar/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  async function syncJobAgent() {
    setSyncing(true)
    const res = await fetch('/api/modules/calendar/sync-job-agent', { method: 'POST' })
    await res.json()
    setSyncing(false)
    await load()
  }

  async function syncExternal() {
    setSyncing(true)
    const res = await fetch('/api/modules/calendar/connections', { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    if (!res.ok || data.errors?.length) {
      setNotice(data.errors?.join(' · ') ?? cal.errors.syncFailed)
    }
    await load()
  }

  async function disconnect(connectionId: string) {
    await fetch(`/api/modules/calendar/connections?id=${connectionId}`, { method: 'DELETE' })
    await load()
  }

  async function addTodo(dueDate: string, text?: string) {
    const titleText = (text ?? todoTitle).trim()
    if (!titleText) return
    setAddingTodo(true)
    const res = await fetch('/api/modules/calendar/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleText, due_date: dueDate }),
    })
    const data = await res.json()
    setAddingTodo(false)
    if (data.warning === 'calendar_v2_missing') {
      setWarning(cal.warnings.v2Missing)
      return
    }
    if (data.todo) {
      setTodos((prev) => [...prev, data.todo])
      setTodoTitle('')
      setDayTodoDrafts((d) => ({ ...d, [dueDate]: '' }))
    }
  }

  async function toggleTodo(todo: Todo) {
    const res = await fetch(`/api/modules/calendar/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !todo.done }),
    })
    const data = await res.json()
    if (data.todo) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? data.todo : t)))
    }
  }

  async function deleteTodo(id: string) {
    await fetch(`/api/modules/calendar/todos/${id}`, { method: 'DELETE' })
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const googleConns = connections.filter((c) => c.provider === 'google')
  const msConns = connections.filter((c) => c.provider === 'microsoft')

  return (
    <ShellLayout>
      <div className="mb-6 flex items-center gap-4">
        <ModuleGlyph
          moduleId="calendar"
          primary={mod.accent.primary}
          glow={mod.accent.glow}
          size={72}
        />
        <div>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">
            {t.common.backToDashboard}
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{cal.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{cal.subtitle}</p>
        </div>
      </div>

      {warning && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {warning}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm text-[var(--text-muted)]">
          {notice}
        </p>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <GlassPanel className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">{cal.connectionsTitle}</h2>

          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--surface-border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">Google Calendar</p>
              {googleConns.length === 0 ?
                <p className="mt-1 text-xs text-[var(--text-muted)]">{cal.notConnected}</p>
              : <ul className="mt-2 space-y-1">
                  {googleConns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--accent)]">{c.account_email}</span>
                      <button
                        type="button"
                        className="text-[var(--text-muted)] hover:text-red-400"
                        onClick={() => disconnect(c.id)}
                      >
                        {cal.disconnect}
                      </button>
                    </li>
                  ))}
                </ul>
              }
              <a
                href="/api/auth/google-calendar/connect"
                className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
              >
                {googleConns.length === 0 ? cal.connectGoogle : cal.connectAnotherGoogle}
              </a>
            </div>

            <div className="rounded-xl border border-[var(--surface-border)] p-3">
              <p className="text-xs font-medium text-[var(--text)]">Outlook / Microsoft</p>
              {msConns.length === 0 ?
                <p className="mt-1 text-xs text-[var(--text-muted)]">{cal.notConnected}</p>
              : <ul className="mt-2 space-y-1">
                  {msConns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--accent)]">{c.account_email}</span>
                      <button
                        type="button"
                        className="text-[var(--text-muted)] hover:text-red-400"
                        onClick={() => disconnect(c.id)}
                      >
                        {cal.disconnect}
                      </button>
                    </li>
                  ))}
                </ul>
              }
              <a
                href="/api/auth/microsoft-calendar/connect"
                className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
              >
                {msConns.length === 0 ? cal.connectMicrosoft : cal.connectAnotherMicrosoft}
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={syncExternal} disabled={syncing || connections.length === 0}>
              {syncing ? cal.syncing : cal.syncExternal}
            </Button>
            <Button variant="outline" onClick={syncJobAgent} disabled={syncing}>
              {syncing ? cal.syncing : cal.syncJobAgent}
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">{cal.addTodo}</h2>
          <input
            value={todoTitle}
            onChange={(e) => setTodoTitle(e.target.value)}
            placeholder={cal.todoPlaceholder}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
          />
          <label className="block text-xs text-[var(--text-muted)]">
            {cal.todoDate}
            <input
              type="date"
              value={todoDate}
              onChange={(e) => setTodoDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <Button onClick={() => addTodo(todoDate)} disabled={addingTodo || !todoTitle.trim()}>
            {addingTodo ? t.common.loading : cal.addTodo}
          </Button>
        </GlassPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <GlassPanel className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">{cal.upcoming}</h2>

          {loading ?
            <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
          : groupedDays.length === 0 ?
            <p className="text-sm text-[var(--text-muted)]">{cal.empty}</p>
          : <div className="space-y-6">
              {groupedDays.map((day) => {
                const dayEvents = eventsByDay.get(day) ?? []
                const dayTodos = todosByDay.get(day) ?? []
                const draft = dayTodoDrafts[day] ?? ''

                return (
                  <div key={day}>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                      {new Date(day + 'T12:00:00').toLocaleDateString(locale, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>

                    {dayTodos.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {dayTodos.map((td) => (
                          <li
                            key={td.id}
                            className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              checked={td.done}
                              onChange={() => toggleTodo(td)}
                              aria-label={cal.done}
                            />
                            <span
                              className={cn(
                                'flex-1 text-sm',
                                td.done ?
                                  'text-[var(--text-muted)] line-through'
                                : 'text-[var(--text)]',
                              )}
                            >
                              {td.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteTodo(td.id)}
                              className="text-xs text-[var(--text-muted)] hover:text-red-400"
                            >
                              {t.common.delete}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-2 flex gap-2">
                      <input
                        value={draft}
                        onChange={(e) =>
                          setDayTodoDrafts((d) => ({ ...d, [day]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && draft.trim()) addTodo(day, draft)
                        }}
                        placeholder={cal.todoPlaceholder}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--background-alt)]/40 px-2 py-1 text-xs"
                      />
                      <Button
                        variant="outline"
                        className="px-2 text-xs"
                        onClick={() => addTodo(day, draft)}
                        disabled={!draft.trim()}
                      >
                        +
                      </Button>
                    </div>

                    {dayEvents.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {dayEvents.map((ev) => (
                          <li
                            key={ev.id}
                            className="flex items-start justify-between gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2"
                            style={ev.color ? { borderLeftColor: ev.color, borderLeftWidth: 3 } : undefined}
                          >
                            <div>
                              <p className="text-sm font-medium text-[var(--text)]">{ev.title}</p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {ev.all_day ?
                                  cal.allDayLabel
                                : new Date(ev.starts_at).toLocaleTimeString(locale, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                {sourceLabel(ev.source, cal) ? ` · ${sourceLabel(ev.source, cal)}` : ''}
                                {ev.source_account ? ` · ${ev.source_account}` : ''}
                              </p>
                            </div>
                            {ev.source === 'manual' && (
                              <button
                                type="button"
                                onClick={() => removeEvent(ev.id)}
                                className="text-xs text-[var(--text-muted)] hover:text-red-400"
                              >
                                {t.common.delete}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          }
        </GlassPanel>

        <GlassPanel className="h-fit space-y-3 p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">{cal.addEvent}</h2>
          <label className="block text-xs text-[var(--text-muted)]">
            {cal.eventTitle}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {cal.startsAt}
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background-alt)]/50 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            {cal.allDay}
          </label>
          <Button onClick={addEvent} disabled={saving || !title.trim() || !startsAt}>
            {saving ? t.common.loading : cal.save}
          </Button>
        </GlassPanel>
      </div>
    </ShellLayout>
  )
}

export function CalendarView() {
  const { t } = useLocale()
  return (
    <Suspense
      fallback={
        <ShellLayout>
          <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
        </ShellLayout>
      }
    >
      <CalendarViewInner />
    </Suspense>
  )
}
