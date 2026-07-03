import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MARITIME_TARGETS } from '@/lib/job-agent/maritime-targets'

const SEED_DIR = join(process.cwd(), '../../packages/storage/seed')

function readSeed(name: string): string {
  return readFileSync(join(SEED_DIR, name), 'utf-8')
}

export function getSeedDocuments(): { filename: string; docType: string; content: string }[] {
  return [
    { filename: 'CV_Asli_Ilhan.pdf', docType: 'cv', content: readSeed('CV_Asli_Ilhan.txt') },
    {
      filename: 'Cover_Letter_Asli_Ilhan_Toqua.pdf',
      docType: 'cover_letter',
      content: readSeed('Cover_Letter_Asli_Ilhan_Toqua.txt'),
    },
  ]
}

export function getSeedWatchlistItems(): { kind: string; value: string; label: string }[] {
  return MARITIME_TARGETS.map((t) => ({
    kind: 'careers',
    value: t.careersUrl,
    label: `${t.company} — ${t.category}`,
  }))
}
