import type { MasterProfileData, EvidenceItem } from './job-agent'

/** Never surface in job applications — personal company conflicts with employer applications. */
export const JOB_APPLICATION_GUARDRAILS = `CRITICAL — job application rules:
- NEVER mention "Asheriv" or any spelling variant (AsherIV, ASHERIV, etc.).
- NEVER describe the candidate as "founder", "CEO", "currently developing" a personal company, or building their own startup for job materials.
- If source documents mention Asheriv or a personal venture, REFRAME that work ONLY as PhD / academic research — e.g. predictive maintenance for maritime assets, ship maintenance logs, onboard sensor data, vessel operational telemetry, ASI (automatic sensor identification) datasets, digital-twin pipelines for offshore/wind assets.
- Do not invent employers. Do not leave awkward gaps — replace with the research framing above.`

const ASHERIV_PATTERN = /\basheriv\b/gi
const FOUNDER_STARTUP_PATTERN =
  /\b(currently developing|founding|founder of|co-?founder|my (own )?company|personal startup|building asheriv)\b/gi

const DEFAULT_RESEARCH_CLAIM =
  'PhD research on predictive maintenance for maritime and offshore assets using maintenance logs, ship sensor streams, and ASI operational datasets.'

const DEFAULT_CONSTRAINTS: MasterProfileData['constraints'] = {
  remotePreferred: true,
  remoteOnly: false,
  openToContract: true,
  openToFreelance: true,
  openToGig: true,
}

/** Coerce LLM/DB values to plain strings without throwing. */
export function coerceToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((v) => coerceToString(v)).filter(Boolean).join('\n')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['text', 'sentence', 'sample', 'content', 'value']) {
      if (typeof obj[key] === 'string') return obj[key] as string
    }
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return ''
}

export function sanitizeApplicationText(text: unknown): string {
  const s = coerceToString(text)
  if (!s.trim()) return s

  let out = s

  out = out.replace(
    /currently developing asheriv[^.\n]*/gi,
    'PhD research on predictive maintenance for maritime systems using sensor logs, vessel sensor data, and ASI datasets',
  )
  out = out.replace(
    /(?:founder|co-?founder|ceo|building|developing)\s+(?:of\s+)?asheriv[^.\n]*/gi,
    'PhD research on ship maintenance analytics using sensor logs and onboard sensor data',
  )
  out = out.replace(ASHERIV_PATTERN, '')
  out = out.replace(/\(\s*\)/g, '')
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim()

  return out
}

function reframeEvidenceClaim(claim: unknown): string {
  const text = coerceToString(claim)
  if (!text.trim()) return DEFAULT_RESEARCH_CLAIM

  const lower = text.toLowerCase()
  if (!lower.includes('asheriv') && !FOUNDER_STARTUP_PATTERN.test(text)) {
    return text
  }

  FOUNDER_STARTUP_PATTERN.lastIndex = 0

  if (
    lower.includes('sensor') ||
    lower.includes('maintenance') ||
    lower.includes('ship') ||
    lower.includes('maritime') ||
    lower.includes('phd') ||
    lower.includes('asi')
  ) {
    return sanitizeApplicationText(text) || DEFAULT_RESEARCH_CLAIM
  }

  return DEFAULT_RESEARCH_CLAIM
}

function normalizeEvidenceItem(item: unknown): EvidenceItem {
  if (!item || typeof item !== 'object') {
    return { id: '', domain: 'other', claim: '' }
  }
  const raw = item as Record<string, unknown>
  return {
    id: coerceToString(raw.id) || `ev-${Date.now()}`,
    domain: coerceToString(raw.domain) || 'other',
    claim: coerceToString(raw.claim),
    source: raw.source != null ? coerceToString(raw.source) : undefined,
  }
}

function sanitizeEvidenceItem(item: EvidenceItem): EvidenceItem {
  const claim = reframeEvidenceClaim(item.claim)
  return {
    ...item,
    claim,
    source: item.source ? sanitizeApplicationText(item.source) : item.source,
  }
}

function normalizeLanguages(
  languages: unknown,
): MasterProfileData['languages'] {
  if (!Array.isArray(languages)) return []
  return languages
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const raw = entry as Record<string, unknown>
      const language = coerceToString(raw.language)
      const level = coerceToString(raw.level)
      if (!language) return null
      return { language, level: level || 'unknown' }
    })
    .filter((x): x is { language: string; level: string } => x != null)
}

export function normalizeMasterProfile(profile: Partial<MasterProfileData> | null | undefined): MasterProfileData {
  if (!profile || typeof profile !== 'object') {
    return {
      summary: '',
      domains: [],
      languages: [],
      constraints: { ...DEFAULT_CONSTRAINTS },
      evidence: [],
      voiceSamples: [],
    }
  }

  const rawConstraints =
    profile.constraints && typeof profile.constraints === 'object'
      ? (profile.constraints as Record<string, unknown>)
      : {}

  return {
    summary: coerceToString(profile.summary),
    domains: Array.isArray(profile.domains)
      ? profile.domains.map((d) => coerceToString(d)).filter(Boolean)
      : [],
    languages: normalizeLanguages(profile.languages),
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      remotePreferred: Boolean(rawConstraints.remotePreferred ?? DEFAULT_CONSTRAINTS.remotePreferred),
      remoteOnly: Boolean(rawConstraints.remoteOnly ?? DEFAULT_CONSTRAINTS.remoteOnly),
      openToContract: Boolean(rawConstraints.openToContract ?? DEFAULT_CONSTRAINTS.openToContract),
      openToFreelance: Boolean(rawConstraints.openToFreelance ?? DEFAULT_CONSTRAINTS.openToFreelance),
      openToGig: Boolean(rawConstraints.openToGig ?? DEFAULT_CONSTRAINTS.openToGig),
      phdInProgress: rawConstraints.phdInProgress
        ? coerceToString(rawConstraints.phdInProgress)
        : undefined,
    },
    evidence: Array.isArray(profile.evidence)
      ? profile.evidence.map(normalizeEvidenceItem)
      : [],
    voiceSamples: Array.isArray(profile.voiceSamples)
      ? profile.voiceSamples.map((s) => coerceToString(s)).filter(Boolean)
      : [],
  }
}

export function sanitizeMasterProfile(
  profile: Partial<MasterProfileData> | null | undefined,
): MasterProfileData {
  const base = normalizeMasterProfile(profile)
  const constraints = base.constraints

  return {
    ...base,
    summary: sanitizeApplicationText(base.summary),
    constraints: {
      ...constraints,
      phdInProgress: constraints.phdInProgress
        ? sanitizeApplicationText(constraints.phdInProgress)
        : constraints.phdInProgress,
    },
    evidence: base.evidence.map((e) => sanitizeEvidenceItem(e)),
    voiceSamples: base.voiceSamples.map(sanitizeApplicationText).filter(Boolean),
  }
}

/** True when Asheriv / founder-startup wording was removed or reframed. */
export function profileNeedsAsherivSanitizeSave(
  raw: Partial<MasterProfileData> | null | undefined,
): boolean {
  const base = normalizeMasterProfile(raw)
  const blob = JSON.stringify(base).toLowerCase()
  if (blob.includes('asheriv')) return true
  return FOUNDER_STARTUP_PATTERN.test(JSON.stringify(base))
}

export function profileForApplications(
  profile: Partial<MasterProfileData> | null | undefined,
): MasterProfileData {
  return sanitizeMasterProfile(profile)
}
