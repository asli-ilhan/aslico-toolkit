#!/usr/bin/env node
/**
 * End-to-end Job Agent + Gmail smoke test (dev only).
 * Usage: node scripts/test-job-agent.mjs
 */
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const COOKIE = join(dirname(fileURLToPath(import.meta.url)), '.test-cookies.txt')

const results = []

function log(icon, name, detail = '') {
  const line = `${icon} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  results.push({ icon, name, detail })
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
  ...opts,
  headers: {
    ...(opts.body && !(opts.body instanceof FormData) ?
      { 'Content-Type': 'application/json' }
    : {}),
    ...opts.headers,
  },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text.slice(0, 200) }
  }
  return { res, json }
}

async function curlAuth() {
  const { execSync } = await import('node:child_process')
  try {
    unlinkSync(COOKIE)
  } catch {
  }
  execSync(
    `curl -s -c "${COOKIE}" -b "${COOKIE}" -L -o /dev/null -w "%{http_code}" "${BASE}/api/auth/setup"`,
    { encoding: 'utf8' },
  )
}

async function authedFetch(path, opts = {}) {
  const { execSync } = await import('node:child_process')
  const method = opts.method ?? 'GET'
  const bodyFlag =
    opts.body ?
      `-H "Content-Type: application/json" -d '${JSON.stringify(opts.body).replace(/'/g, "'\\''")}'`
    : ''
  const out = execSync(
    `curl -s -b "${COOKIE}" -X ${method} ${bodyFlag} "${BASE}${path}"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
  try {
    return { json: JSON.parse(out), raw: out }
  } catch {
    return { json: null, raw: out }
  }
}

async function main() {
  console.log(`\nJob Agent E2E test — ${BASE}\n`)

  // 1. Health
  try {
    const res = await fetch(`${BASE}/login`)
    if (res.ok) log('✓', 'Dev server', `${res.status}`)
    else log('✗', 'Dev server', `HTTP ${res.status}`)
  } catch (e) {
    log('✗', 'Dev server', String(e))
    process.exit(1)
  }

  // 2. Auth
  try {
    await curlAuth()
    const { json } = await authedFetch('/api/modules/job-agent/profile')
    if (json && !json.error) log('✓', 'Auth (dev setup)', 'session OK')
    else log('✗', 'Auth', json?.error ?? 'no session')
  } catch (e) {
    log('✗', 'Auth', String(e))
  }

  // 3. Gmail
  const gmail = await authedFetch('/api/modules/job-agent/gmail')
  if (gmail.json?.connected && gmail.json?.mode === 'env') {
    log('✓', 'Gmail backend', gmail.json.email ?? 'connected')
  } else if (gmail.json?.connected) {
    log('✓', 'Gmail', `mode=${gmail.json.mode}`)
  } else {
    log('✗', 'Gmail', gmail.json?.warning ?? gmail.json?.error ?? 'not connected')
  }

  // 4. Profile
  const profile = await authedFetch('/api/modules/job-agent/profile')
  if (profile.json && !profile.json.error) {
    const hasProfile = Boolean(profile.json.profile?.summary || profile.json.profile?.cv_master)
    log(hasProfile ? '✓' : '○', 'Profile', hasProfile ? 'has data' : 'empty (OK)')
  } else {
    log('✗', 'Profile API', profile.json?.error ?? profile.json?.warning ?? 'fail')
  }

  // 5. Preferences
  const prefs = await authedFetch('/api/modules/job-agent/preferences')
  if (prefs.json && !prefs.json.error) {
    log('✓', 'Preferences', prefs.json.warning ?? 'OK')
  } else {
    log('✗', 'Preferences', prefs.json?.error ?? prefs.json?.warning ?? 'fail')
  }

  // 6. Watchlist
  const watch = await authedFetch('/api/modules/job-agent/watchlist')
  if (watch.json?.items !== undefined) {
    log('✓', 'Watchlist', `${watch.json.items.length} item(s)`)
  } else {
    log('✗', 'Watchlist', watch.json?.error ?? watch.json?.warning ?? 'fail')
  }

  // 7. Inbox
  const inbox = await authedFetch('/api/modules/job-agent')
  if (inbox.json?.items !== undefined) {
    log('✓', 'Inbox', `${inbox.json.items.length} pending pack(s)`)
  } else {
    log('✗', 'Inbox', inbox.json?.error ?? inbox.json?.warning ?? 'fail')
  }

  // 8. History packs
  const packs = await authedFetch('/api/modules/job-agent/packs')
  if (packs.json?.items !== undefined) {
    log('✓', 'History packs', `${packs.json.items.length} pack(s)`)
  } else {
    log('✗', 'History packs', packs.json?.error ?? 'fail')
  }

  // 9. Analytics
  const analytics = await authedFetch('/api/modules/job-agent/analytics')
  if (analytics.json && !analytics.json.error) {
    log('✓', 'Analytics', `total=${analytics.json.total ?? analytics.json.funnel?.total ?? '?'}`)
  } else {
    log('✗', 'Analytics', analytics.json?.error ?? analytics.json?.warning ?? 'fail')
  }

  // 10. Brief
  const brief = await authedFetch('/api/modules/job-agent/brief')
  if (brief.json && !brief.json.error) {
    log('✓', 'Daily brief', 'OK')
  } else {
    log('✗', 'Brief', brief.json?.error ?? 'fail')
  }

  // 11. Outreach list
  const outreach = await authedFetch('/api/modules/job-agent/outreach')
  if (outreach.json?.items !== undefined) {
    log('✓', 'Outreach', `${outreach.json.items.length} campaign(s)`)
  } else {
    log('✗', 'Outreach', outreach.json?.error ?? outreach.json?.warning ?? 'fail')
  }

  // 12. SQL migrations check
  const warnings = [
    inbox.json?.warning,
    prefs.json?.warning,
    outreach.json?.warning,
    gmail.json?.warning,
  ].filter(Boolean)
  if (warnings.length) {
    log('⚠', 'SQL migrations', warnings.join(', '))
  } else {
    log('✓', 'SQL tables', 'v2/v3/v4 present')
  }

  // 13. Scrape endpoint (smoke — invalid URL should return error gracefully)
  const scrape = await authedFetch('/api/modules/job-agent/scrape', {
    method: 'POST',
    body: { url: 'https://example.com/not-a-job' },
  })
  if (scrape.json && (scrape.json.error || scrape.json.title || scrape.json.warning)) {
    log('✓', 'Scrape endpoint', scrape.json.error ? 'handles bad URL' : 'responded')
  } else {
    log('○', 'Scrape endpoint', 'unexpected response')
  }

  // 14. Nightly (dry run — may take time)
  process.stdout.write('  … nightly discovery (may take 10–30s)\n')
  const nightly = await authedFetch('/api/modules/job-agent/nightly', { method: 'POST' })
  if (nightly.json?.log || nightly.json?.ok !== undefined) {
    const lines = nightly.json.log?.length ?? 0
    log('✓', 'Nightly', `${lines} log line(s)${nightly.json.warning ? ` [${nightly.json.warning}]` : ''}`)
  } else {
    log('○', 'Nightly', nightly.json?.error ?? 'no response')
  }

  // 15. Pack detail + export if any pack exists
  const allPacks = packs.json?.items ?? []
  if (allPacks.length > 0) {
    const packId = allPacks[0].id
    const detail = await authedFetch(`/api/modules/job-agent/packs/${packId}`)
    if (detail.json?.pack) {
      log('✓', 'Pack detail', packId.slice(0, 8))
    } else {
      log('✗', 'Pack detail', detail.json?.error ?? 'fail')
    }

    const outreachPack = await authedFetch(`/api/modules/job-agent/packs/${packId}/outreach`)
    if (outreachPack.json !== null) {
      log('✓', 'Pack outreach', outreachPack.json.campaign ? 'has campaign' : 'no campaign yet')
    }

    // Export smoke (PDF)
    const { execSync } = await import('node:child_process')
    const exportCode = execSync(
      `curl -s -b "${COOKIE}" -o /dev/null -w "%{http_code}" "${BASE}/api/modules/job-agent/packs/${packId}/export?format=pdf"`,
      { encoding: 'utf8' },
    )
    log(exportCode === '200' ? '✓' : '○', 'PDF export', `HTTP ${exportCode}`)
  } else {
    log('○', 'Pack detail/export', 'no packs to test')
  }

  // 16. Transcription module
  const trans = await authedFetch('/api/modules/transcription')
  if (trans.json?.items !== undefined) {
    log('✓', 'Transcription', `${trans.json.items.length} item(s)`)
  } else if (trans.json?.warning?.includes('missing')) {
    log('○', 'Transcription', trans.json.warning)
  } else {
    log(trans.json?.error ? '○' : '✓', 'Transcription', trans.json?.error ?? 'OK')
  }

  try {
    unlinkSync(COOKIE)
  } catch {
  }

  const failed = results.filter((r) => r.icon === '✗').length
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Sonuç: ${results.length - failed}/${results.length} geçti, ${failed} hata\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
