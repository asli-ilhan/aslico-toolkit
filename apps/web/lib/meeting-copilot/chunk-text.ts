/** Approximate chars per chunk (~250–350 tokens). */
const TARGET_CHARS = 1100
const OVERLAP_CHARS = 160
const MAX_TOTAL_CHARS = 2_000_000

/**
 * Split document text into overlapping chunks on paragraph/sentence boundaries.
 * No hard truncate of the source document — entire text is retained across chunks.
 */
export function chunkKnowledgeText(text: string): string[] {
  const cleaned = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const bounded =
    cleaned.length > MAX_TOTAL_CHARS
      ? `${cleaned.slice(0, MAX_TOTAL_CHARS)}\n\n[document truncated at ${MAX_TOTAL_CHARS} chars]`
      : cleaned

  if (bounded.length <= TARGET_CHARS) return [bounded]

  const paragraphs = bounded.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const units: string[] = []
  for (const p of paragraphs) {
    if (p.length <= TARGET_CHARS) {
      units.push(p)
      continue
    }
    const sentences = p.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean)
    if (sentences.length <= 1) {
      for (let i = 0; i < p.length; i += TARGET_CHARS - OVERLAP_CHARS) {
        units.push(p.slice(i, i + TARGET_CHARS))
      }
    } else {
      let buf = ''
      for (const s of sentences) {
        if (!buf) {
          buf = s
        } else if ((buf + ' ' + s).length <= TARGET_CHARS) {
          buf = `${buf} ${s}`
        } else {
          units.push(buf)
          buf = s
        }
      }
      if (buf) units.push(buf)
    }
  }

  if (units.length <= 1) return units

  const chunks: string[] = []
  for (let i = 0; i < units.length; i++) {
    let chunk = units[i]
    if (i > 0 && OVERLAP_CHARS > 0) {
      const prev = units[i - 1]
      const overlap = prev.slice(Math.max(0, prev.length - OVERLAP_CHARS))
      chunk = `${overlap} ${chunk}`.trim()
    }
    // Merge undersized tails forward
    while (i + 1 < units.length && chunk.length < TARGET_CHARS * 0.55) {
      i += 1
      chunk = `${chunk}\n\n${units[i]}`.trim()
    }
    chunks.push(chunk)
  }
  return chunks.filter(Boolean)
}
