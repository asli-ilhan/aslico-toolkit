#!/usr/bin/env node
/**
 * Local autofill service — Job Agent UI button talks to this on port 9321.
 * Keep running while applying: pnpm autofill:daemon
 */
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { autofillApplicationPage } from './autofill-shared.mjs'

const PORT = Number(process.env.AUTOFILL_PORT ?? 9321)

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'aslico-autofill' }))
    return
  }

  if (req.method !== 'POST' || req.url !== '/autofill') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  let body = ''
  for await (const chunk of req) body += chunk

  let pack
  try {
    pack = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const jobUrl = String(pack.jobUrl ?? pack.job_url ?? '').trim()
  if (!jobUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'jobUrl required' }))
    return
  }

  try {
    const browser = await chromium.launch({ headless: false, slowMo: 60 })
    const page = await browser.newPage()
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    const filled = await autofillApplicationPage(page, pack, pack.senderEmail ?? pack.sender_email)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        filled,
        company: pack.company,
        role: pack.role,
        message: 'Form dolduruldu. Tarayıcıda kontrol et ve kendin gönder.',
      }),
    )

    console.log(
      `[autofill] ${pack.company ?? '?'} · ${pack.role ?? '?'} — cover:${filled.coverLetter} cv:${filled.cv}`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Autofill failed'
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: message }))
    console.error('[autofill]', message)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log(`asliCo autofill servisi — http://127.0.0.1:${PORT}`)
  console.log('Job Agent → paket → "Formu otomatik doldur" butonuna bas.')
  console.log('Kapatmak için Ctrl+C')
  console.log('')
})
