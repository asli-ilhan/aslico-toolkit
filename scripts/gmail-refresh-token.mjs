#!/usr/bin/env node
/**
 * Gmail refresh token helper — uses the running dev server (port 3000).
 *
 * Prerequisite: Google Cloud → OAuth Web client → Authorized redirect URIs → add
 *   http://localhost:3000/api/auth/gmail/callback
 * (must match GOOGLE_REDIRECT_URI in apps/web/.env.local exactly)
 */
import { readFileSync } from 'node:fs'
import { exec } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '../apps/web/.env.local')
const DEV_URL = 'http://localhost:3000/api/dev/gmail-token'

function loadEnvFile(path) {
  const env = {}
  try {
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
  }
  return env
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(cmd)
}

const env = loadEnvFile(ENV_PATH)
const redirectUri =
  env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:3000/api/auth/gmail/callback'
const clientId = env.GOOGLE_CLIENT_ID?.trim()

console.log('')
console.log('Gmail refresh token kurulumu')
console.log('==============================')
console.log('')
console.log('1. Dev sunucusu çalışıyor olmalı: npx pnpm@9.15.9 dev')
console.log('')
console.log('2. Google Cloud Console → Credentials → OAuth 2.0 Client IDs')
if (clientId) {
  console.log(`   Client ID: ${clientId}`)
  console.log(
    `   Direkt link: https://console.cloud.google.com/apis/credentials/oauthclient/${clientId.split('.')[0]}`,
  )
}
console.log('')
console.log('3. "Authorized redirect URIs" listesine TAM OLARAK şunu ekle ve SAVE:')
console.log('')
console.log(`   ${redirectUri}`)
console.log('')
console.log('   (8787 veya başka port DEĞİL — yukarıdaki satır birebir aynı olmalı)')
console.log('')
console.log('4. Tarayıcıda açılacak sayfada "Google ile devam et"e tıkla.')
console.log('')

openBrowser(DEV_URL)
console.log(`Tarayıcı: ${DEV_URL}`)
console.log('')
