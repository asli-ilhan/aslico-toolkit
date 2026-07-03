import { PDFDocument, StandardFonts } from 'pdf-lib'
import type { ApplicationPack } from '@/components/modules/job-agent/types'

function wrapLines(text: string, maxChars = 90): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (next.length > maxChars) {
        if (line) lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

export async function packToPdf(pack: ApplicationPack): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([595, 842])
  const margin = 50
  let y = 800
  const lineHeight = 14

  function ensureSpace(needed = lineHeight) {
    if (y - needed < 50) {
      page = doc.addPage([595, 842])
      y = 800
    }
  }

  function drawLine(text: string, size = 11, useBold = false) {
    ensureSpace()
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: useBold ? bold : font,
      maxWidth: 495,
    })
    y -= lineHeight
  }

  function drawBlock(title: string, body: string) {
    drawLine(title, 13, true)
    y -= 4
    for (const line of wrapLines(body)) {
      if (!line) {
        y -= 6
        continue
      }
      drawLine(line)
    }
    y -= 10
  }

  drawLine(`${pack.company} · ${pack.role}`, 16, true)
  if (pack.job_url) drawLine(pack.job_url, 9)
  if (pack.fit_score != null) drawLine(`Fit: ${Math.round(pack.fit_score)}%`, 10)
  y -= 8
  drawBlock('Cover letter', pack.cover_letter ?? '')
  drawBlock('Tailored CV', pack.tailored_cv ?? '')

  return doc.save()
}

function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function packToIcs(
  pack: ApplicationPack,
  kind: 'deadline' | 'followup' | 'interview',
): string | null {
  let when: string | null = null
  let summary = ''
  if (kind === 'deadline' && pack.deadline_at) {
    when = pack.deadline_at
    summary = `Apply: ${pack.role} at ${pack.company}`
  } else if (kind === 'followup' && pack.follow_up_at) {
    when = pack.follow_up_at
    summary = `Follow up: ${pack.company}`
  } else if (kind === 'interview' && pack.follow_up_at) {
    when = pack.follow_up_at
    summary = `Interview prep: ${pack.company}`
  }
  if (!when) return null

  const uid = `${pack.id}-${kind}@aslico-toolkit`
  const dt = formatIcsDate(when)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//asliCo Toolkit//Job Agent//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${dt}`,
    `SUMMARY:${summary}`,
    pack.job_url ? `URL:${pack.job_url}` : '',
    pack.notes ? `DESCRIPTION:${pack.notes.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}
