import { PDFDocument, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib'
import type { ApplicationPack } from '@/components/modules/job-agent/types'

const PAGE = { width: 595, height: 842 } as const
const MARGIN = 56
const CONTENT_WIDTH = PAGE.width - MARGIN * 2

function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2022|\u203A/g, '-')
    .replace(/\u00B7/g, '·')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '')
}

function wrapLines(text: string, maxChars = 88): string[] {
  const lines: string[] = []
  for (const paragraph of sanitizePdfText(text).split('\n')) {
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

interface PdfWriter {
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
  ensureSpace(needed?: number): void
  draw(text: string, opts?: { size?: number; bold?: boolean; indent?: number; gapAfter?: number }): void
  drawLines(lines: string[], opts?: { size?: number; bold?: boolean; indent?: number; gapAfter?: number }): void
}

async function createWriter(): Promise<{ doc: PDFDocument; w: PdfWriter }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN

  const w: PdfWriter = {
    page,
    y,
    font,
    bold,
    ensureSpace(needed = 16) {
      if (this.y - needed < MARGIN) {
        page = doc.addPage([PAGE.width, PAGE.height])
        this.page = page
        this.y = PAGE.height - MARGIN
      }
    },
    draw(text, opts = {}) {
      const size = opts.size ?? 11
      const indent = opts.indent ?? 0
      const gapAfter = opts.gapAfter ?? 14
      this.ensureSpace(gapAfter + 4)
      this.page.drawText(sanitizePdfText(text), {
        x: MARGIN + indent,
        y: this.y,
        size,
        font: opts.bold ? bold : font,
        maxWidth: CONTENT_WIDTH - indent,
      })
      this.y -= gapAfter
    },
    drawLines(lines, opts = {}) {
      for (const line of lines) {
        if (!line) {
          this.y -= 8
          this.ensureSpace()
          continue
        }
        this.draw(line, { ...opts, gapAfter: opts.gapAfter ?? 13 })
      }
    },
  }

  return { doc, w }
}

function extractContactLine(text: string): string | null {
  const first = text.split('\n').find((l) => l.trim())?.trim() ?? ''
  if (/@/.test(first) && (/linkedin|\+|\·|·/.test(first) || first.length < 120)) return first
  return null
}

function extractSignerName(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (/^(best regards|sincerely|kind regards|yours faithfully)/i.test(line)) {
      const next = lines[i + 1]
      if (next && next.length < 60 && !/^dear /i.test(next)) return next
    }
    if (/^asli ilhan$/i.test(line) || (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line) && line.length < 40)) {
      return line
    }
  }
  return 'Asli Ilhan'
}

function parseCoverLetterBody(text: string): { contact: string | null; paragraphs: string[]; salutation: string } {
  const raw = sanitizePdfText(text).trim()
  const contact = extractContactLine(raw)
  const withoutContact = contact ? raw.replace(contact, '').trim() : raw
  const lines = withoutContact.split('\n').map((l) => l.trim())
  let salutation = 'Dear Hiring Team,'
  const bodyLines: string[] = []
  for (const line of lines) {
    if (/^dear /i.test(line)) {
      salutation = line
      continue
    }
    if (/^(best regards|sincerely|kind regards)/i.test(line)) break
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line) && line.length < 40) continue
    if (/^application\s*·/i.test(line)) continue
    bodyLines.push(line)
  }
  const paragraphs: string[] = []
  let buf = ''
  for (const line of bodyLines) {
    if (!line) {
      if (buf) paragraphs.push(buf.trim())
      buf = ''
      continue
    }
    buf = buf ? `${buf} ${line}` : line
  }
  if (buf) paragraphs.push(buf.trim())
  return { contact, paragraphs, salutation }
}

export async function packToCoverLetterPdf(pack: ApplicationPack): Promise<Uint8Array> {
  const { doc, w } = await createWriter()
  const body = pack.cover_letter ?? ''
  const { contact, paragraphs, salutation } = parseCoverLetterBody(body)
  const signer = extractSignerName(body)
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  if (contact) {
    w.draw(contact, { size: 9, gapAfter: 20 })
  }

  w.draw(date, { size: 10, gapAfter: 18 })
  w.draw(`${pack.company}`, { size: 11, bold: true, gapAfter: 6 })
  if (pack.role) w.draw(`Re: ${pack.role}`, { size: 10, gapAfter: 16 })

  w.draw(salutation, { size: 11, gapAfter: 14 })
  for (const p of paragraphs) {
    w.drawLines(wrapLines(p), { size: 11, gapAfter: 13 })
    w.y -= 6
  }

  w.y -= 8
  w.draw('Best regards,', { size: 11, gapAfter: 28 })
  w.draw(signer, { size: 11, bold: true })

  return doc.save()
}

type CvBlock =
  | { kind: 'name'; text: string }
  | { kind: 'tagline'; text: string }
  | { kind: 'contact'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'role'; text: string }
  | { kind: 'org'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'body'; text: string }

function isSectionHeader(line: string): boolean {
  const t = line.trim()
  if (t.length < 4 || t.length > 48) return false
  if (/^[A-Z][A-Z0-9 &/\-—]+$/.test(t) && /[A-Z]{2,}/.test(t)) return true
  if (/^(experience|education|skills|certifications|languages|research|technical)/i.test(t)) return true
  return false
}

function isRoleLine(line: string): boolean {
  return /\d{4}/.test(line) && (line.includes('–') || line.includes('-') || line.includes('Present'))
}

function parseCvBlocks(text: string): CvBlock[] {
  const lines = sanitizePdfText(text).split('\n').map((l) => l.trim())
  const blocks: CvBlock[] = []
  let seenName = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    if (!seenName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line) && line.length < 40) {
      blocks.push({ kind: 'name', text: line })
      seenName = true
      const next = lines[i + 1]
      if (next && next.includes('·')) {
        blocks.push({ kind: 'tagline', text: next })
        i++
      }
      continue
    }

    if (/@/.test(line) && (/linkedin|\+|\·|·/.test(line))) {
      blocks.push({ kind: 'contact', text: line })
      continue
    }

    if (isSectionHeader(line)) {
      blocks.push({ kind: 'section', text: line })
      continue
    }

    if (line.startsWith('›') || line.startsWith('-') || line.startsWith('•')) {
      blocks.push({ kind: 'bullet', text: line.replace(/^[›\-•]\s*/, '') })
      continue
    }

    if (isRoleLine(line)) {
      blocks.push({ kind: 'role', text: line })
      const org = lines[i + 1]
      if (org && !isSectionHeader(org) && !isRoleLine(org) && org.length < 90) {
        blocks.push({ kind: 'org', text: org })
        i++
      }
      continue
    }

    blocks.push({ kind: 'body', text: line })
  }

  return blocks
}

export async function packToCvPdf(pack: ApplicationPack): Promise<Uint8Array> {
  const { doc, w } = await createWriter()
  const blocks = parseCvBlocks(pack.tailored_cv ?? '')

  if (blocks.length === 0) {
    w.draw(`${pack.company} · ${pack.role}`, { size: 14, bold: true, gapAfter: 16 })
    w.drawLines(wrapLines(pack.tailored_cv ?? ''), { size: 10 })
    return doc.save()
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'name':
        w.draw(block.text, { size: 20, bold: true, gapAfter: 6 })
        break
      case 'tagline':
        w.draw(block.text, { size: 10, gapAfter: 10 })
        break
      case 'contact':
        w.draw(block.text, { size: 9, gapAfter: 14 })
        break
      case 'section':
        w.y -= 6
        w.draw(block.text.toUpperCase(), { size: 11, bold: true, gapAfter: 8 })
        w.page.drawLine({
          start: { x: MARGIN, y: w.y + 4 },
          end: { x: PAGE.width - MARGIN, y: w.y + 4 },
          thickness: 0.5,
        })
        w.y -= 6
        break
      case 'role':
        w.draw(block.text, { size: 10, bold: true, gapAfter: 4 })
        break
      case 'org':
        w.draw(block.text, { size: 9, gapAfter: 6 })
        break
      case 'bullet': {
        const bulletLines = wrapLines(block.text, 80)
        for (let j = 0; j < bulletLines.length; j++) {
          const prefix = j === 0 ? '•  ' : '   '
          w.draw(`${prefix}${bulletLines[j]}`, { size: 9, gapAfter: 11 })
        }
        break
      }
      case 'body':
        w.drawLines(wrapLines(block.text), { size: 9, gapAfter: 12 })
        break
    }
  }

  return doc.save()
}

/** Combined bundle: cover letter then CV, each as a properly formatted section. */
export async function packToPdf(pack: ApplicationPack): Promise<Uint8Array> {
  const letterBytes = await packToCoverLetterPdf(pack)
  const cvBytes = await packToCvPdf(pack)
  const merged = await PDFDocument.create()
  const letterDoc = await PDFDocument.load(letterBytes)
  const cvDoc = await PDFDocument.load(cvBytes)
  const letterPages = await merged.copyPages(letterDoc, letterDoc.getPageIndices())
  const cvPages = await merged.copyPages(cvDoc, cvDoc.getPageIndices())
  for (const p of letterPages) merged.addPage(p)
  for (const p of cvPages) merged.addPage(p)
  return merged.save()
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
