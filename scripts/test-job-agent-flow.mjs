#!/usr/bin/env node
/**
 * Full Job Agent flow test: document → profile → pack → submit → outreach
 * Usage: node scripts/test-job-agent-flow.mjs
 */
import { unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const COOKIE = join(dirname(fileURLToPath(import.meta.url)), '.test-cookies.txt')

function api(method, path, body) {
  const bodyFlag =
    body ?
      `-H "Content-Type: application/json" -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`
    : ''
  const out = execSync(`curl -s -b "${COOKIE}" -X ${method} ${bodyFlag} "${BASE}${path}"`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180000,
  })
  return JSON.parse(out)
}

function log(icon, msg) {
  console.log(`${icon} ${msg}`)
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('\n── Tam akış testi ──\n')

  try {
    unlinkSync(COOKIE)
  } catch {
  }
  execSync(`curl -s -c "${COOKIE}" -b "${COOKIE}" -L -o /dev/null "${BASE}/api/auth/setup"`)

  // 1. Test CV yükle
  log('…', 'Test CV yükleniyor')
  const doc = api('POST', '/api/modules/job-agent/documents', {
    filename: 'test-cv.txt',
    docType: 'cv',
    content: `Asli Ilhan — HCI Researcher & Creative Technologist
Experience: MIT Media Lab research, maritime UX, ML pipelines, full-stack (Next.js, Python).
Skills: user research, prototyping, Claude/AI tooling, offshore wind domain knowledge.
Education: MSc relevant field. Based in Europe, open to remote.`,
  })
  if (doc.item?.id) log('✓', `CV yüklendi (${doc.item.id.slice(0, 8)})`)
  else {
    log('✗', `CV yüklenemedi: ${doc.error}`)
    process.exit(1)
  }

  // 2. Profil oluştur (Claude)
  log('…', 'Master profil oluşturuluyor (Claude, ~30s)')
  const profile = api('POST', '/api/modules/job-agent/profile')
  if (profile.profile?.summary) log('✓', `Profil: ${profile.profile.summary.slice(0, 80)}…`)
  else {
    log('✗', `Profil hatası: ${profile.error}`)
    process.exit(1)
  }

  // 3. İş paketi oluştur (Claude)
  log('…', 'Başvuru paketi oluşturuluyor (Claude, ~45s)')
  const pack = api('POST', '/api/modules/job-agent/packs', {
    company: 'Spotify',
    role: 'Product Designer — Discovery',
    jobDescription: `We're looking for a product designer to shape music discovery experiences.
Remote-friendly, EU timezone. Research-driven, prototyping, cross-functional collaboration.
Requirements: 3+ years UX, portfolio, user research, Figma.`,
    jobUrl: 'https://jobs.spotify.com/test',
    remoteType: 'remote',
    locale: 'en',
  })
  if (pack.item?.id) {
    log('✓', `Paket oluşturuldu — fit ${pack.item.fit_score}/100 (${pack.item.id.slice(0, 8)})`)
  } else {
    log('✗', `Paket hatası: ${pack.error}`)
    process.exit(1)
  }

  const packId = pack.item.id

  // 4. PDF export
  const pdfCode = execSync(
    `curl -s -b "${COOKIE}" -o /dev/null -w "%{http_code}" "${BASE}/api/modules/job-agent/packs/${packId}/export?format=pdf"`,
    { encoding: 'utf8' },
  )
  log(pdfCode === '200' ? '✓' : '✗', `PDF export HTTP ${pdfCode}`)

  // 5. ICS export
  const icsCode = execSync(
    `curl -s -b "${COOKIE}" -o /dev/null -w "%{http_code}" "${BASE}/api/modules/job-agent/packs/${packId}/export?format=ics"`,
    { encoding: 'utf8' },
  )
  log(icsCode === '200' ? '✓' : '✗', `ICS export HTTP ${icsCode}`)

  // 6. Submit → outreach pipeline
  log('…', 'Submitted olarak işaretleniyor → outreach başlıyor')
  const submit = api('PATCH', `/api/modules/job-agent/packs/${packId}`, { status: 'submitted' })
  if (submit.item?.status === 'submitted') log('✓', 'Submitted')
  else {
    log('✗', `Submit hatası: ${submit.error}`)
    process.exit(1)
  }

  // 7. Outreach pipeline bekle
  log('…', 'Outreach pipeline bekleniyor (contacts + draft, ~60s)')
  let campaign = null
  for (let i = 0; i < 24; i++) {
    await sleep(5000)
    const outreach = api('GET', `/api/modules/job-agent/packs/${packId}/outreach`)
    if (outreach.campaign?.status === 'draft_ready') {
      campaign = outreach
      break
    }
    if (outreach.campaign?.status === 'failed') {
      log('✗', `Outreach failed: ${outreach.campaign.error}`)
      process.exit(1)
    }
    process.stdout.write('.')
  }
  console.log('')

  if (campaign?.campaign) {
    log('✓', `Outreach draft hazır — ${campaign.recipients?.length ?? 0} alıcı`)
    log(' ', `Konu: ${campaign.campaign.subject?.slice(0, 60)}`)
  } else {
    log('○', 'Outreach henüz draft_ready değil (timeout) — manuel kontrol et')
  }

  // 8. Gmail token (dry — sadece bağlantı kontrolü, mail GÖNDERME)
  const gmail = api('GET', '/api/modules/job-agent/gmail')
  log(gmail.connected ? '✓' : '✗', `Gmail: ${gmail.email} (${gmail.mode})`)

  // 9. Temizlik — test paketini sil
  const del = api('DELETE', `/api/modules/job-agent/packs/${packId}`)
  log(del.ok ? '✓' : '○', 'Test paketi silindi')

  const delDoc = api('DELETE', `/api/modules/job-agent/documents/${doc.item.id}`)
  log(delDoc.ok ? '✓' : '○', 'Test CV silindi')

  try {
    unlinkSync(COOKIE)
  } catch {
  }

  console.log('\n── Tam akış testi bitti ──\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
