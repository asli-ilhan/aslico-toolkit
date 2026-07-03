#!/usr/bin/env node
/**
 * One-shot Playwright autofill (CLI). Prefer UI button + autofill-daemon.
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { autofillApplicationPage } from './autofill-shared.mjs'

const [jsonPath, jobUrl] = process.argv.slice(2)
if (!jsonPath || !jobUrl) {
  console.error('Usage: node scripts/job-agent-autofill.mjs <pack.json> <application-url>')
  console.error('Or use: pnpm autofill:daemon + Job Agent "Formu otomatik doldur" button')
  process.exit(1)
}

const pack = JSON.parse(readFileSync(jsonPath, 'utf8'))

const browser = await chromium.launch({ headless: false, slowMo: 80 })
const page = await browser.newPage()
await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

const filled = await autofillApplicationPage(page, pack)

console.log('Autofill done:', filled)
console.log('Company:', pack.company, '| Role:', pack.role)
console.log('Review the form and submit manually. Ctrl+C to close.')

await page.waitForTimeout(600_000)
await browser.close()
