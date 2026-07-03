#!/usr/bin/env node
/**
 * Deletes candidate_documents rows whose filename contains "test" (case-insensitive).
 * Usage: node scripts/delete-test-documents.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, 'apps/web/.env.local')

function loadEnv() {
  if (!existsSync(envPath)) throw new Error('Missing apps/web/.env.local')
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase env vars')

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

const listRes = await fetch(
  `${url}/rest/v1/candidate_documents?select=id,filename&filename=ilike.*test*`,
  { headers },
)

if (!listRes.ok) {
  console.error(await listRes.text())
  process.exit(1)
}

const rows = await listRes.json()
if (!rows.length) {
  console.log('No test documents found.')
  process.exit(0)
}

const delRes = await fetch(
  `${url}/rest/v1/candidate_documents?filename=ilike.*test*`,
  {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation' },
  },
)

if (!delRes.ok) {
  console.error(await delRes.text())
  process.exit(1)
}

const deleted = await delRes.json()
console.log(
  `Deleted ${deleted.length} test document(s): ${deleted.map((r) => r.filename).join(', ')}`,
)
