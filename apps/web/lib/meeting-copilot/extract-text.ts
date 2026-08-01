import JSZip from 'jszip'

/** Soft cap only for pathological files; chunking retains content across pieces. */
const MAX_CHARS = 2_000_000

function stripXml(xml: string): string {
  return xml
    .replace(/<a:t[^>]*>/g, '')
    .replace(/<\/a:t>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText } = await import('unpdf')
  const data = new Uint8Array(buffer)
  const result = await extractText(data, { mergePages: true })
  const raw = result.text as string | string[]
  const text = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '')
  return text.replace(/\s+\n/g, '\n').trim()
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return (result.value ?? '').trim()
}

async function extractPptx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0)
      const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0)
      return na - nb
    })

  const parts: string[] = []
  for (const name of slideFiles) {
    const xml = await zip.files[name].async('string')
    const text = stripXml(xml)
    if (text) {
      const n = name.match(/slide(\d+)/i)?.[1] ?? '?'
      parts.push(`--- Slide ${n} ---\n${text}`)
    }
  }
  // Notes
  const noteFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(n))
    .sort()
  for (const name of noteFiles) {
    const xml = await zip.files[name].async('string')
    const text = stripXml(xml)
    if (text) parts.push(`--- Notes ---\n${text}`)
  }
  return parts.join('\n\n').trim()
}

function extOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function isSupportedKnowledgeFile(filename: string, mime?: string): boolean {
  const ext = extOf(filename)
  if (['pdf', 'docx', 'pptx', 'txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm'].includes(ext)) {
    return true
  }
  const m = (mime || '').toLowerCase()
  return (
    m.includes('pdf') ||
    m.includes('wordprocessingml') ||
    m.includes('presentationml') ||
    m.startsWith('text/')
  )
}

export async function extractKnowledgeText(
  buffer: ArrayBuffer,
  filename: string,
  mime?: string,
): Promise<{ text: string; kind: string }> {
  const ext = extOf(filename)
  const m = (mime || '').toLowerCase()

  let text = ''
  let kind = ext || 'file'

  if (ext === 'pdf' || m.includes('pdf')) {
    text = await extractPdf(buffer)
    kind = 'pdf'
  } else if (ext === 'docx' || m.includes('wordprocessingml')) {
    text = await extractDocx(buffer)
    kind = 'docx'
  } else if (ext === 'pptx' || m.includes('presentationml')) {
    text = await extractPptx(buffer)
    kind = 'pptx'
  } else if (
    ['txt', 'md', 'markdown', 'csv', 'json', 'html', 'htm'].includes(ext) ||
    m.startsWith('text/') ||
    m.includes('json')
  ) {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim()
    kind = ext || 'text'
  } else {
    throw new Error(`Unsupported file type: ${filename}`)
  }

  text = text.replace(/\u0000/g, '').trim()
  if (!text) {
    throw new Error(`No extractable text in ${filename}`)
  }
  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS)}\n\n[truncated]`
  }
  return { text, kind }
}
