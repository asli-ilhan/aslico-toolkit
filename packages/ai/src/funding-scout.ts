import { createClaudeMessage } from './claude'
import { JOB_APPLICATION_GUARDRAILS, profileForApplications, sanitizeApplicationText } from './profile-guard'
import type { MasterProfileData } from './job-agent'
import {
  FUNDING_SCOUT_SYSTEM_PROMPT,
  buildBatchOpeningsTask,
  buildResearcherProfileBlock,
  buildSingleOpeningTask,
} from './funding-scout-prompts'

export interface FundingOppInput {
  funder: string
  title: string
  fundingType: string
  region: string
  description: string
  opportunityUrl?: string
  primarySourceText?: string
  primarySourceFetchedAt?: string
  searchVerificationSnippets?: { title: string; url: string; snippet: string }[]
}

export interface FundingSettingsInput {
  citizenship?: string
  homeCountry?: string
  phdStage?: string
  phdStartMonth?: string
  homeUniversity?: string
  partnerCountries?: string[]
  supervisionModel?: string
  partnershipNotes?: string
  strictEligibility?: boolean
  disciplines?: string[]
  regions?: string[]
}

export interface FundingProgramEvaluation {
  index?: number
  name: string
  score: number
  eligible: boolean
  applicant_type: 'student-direct' | 'PI-led / join-as-scholar'
  eligibility_gates: string[]
  disqualifiers: string[]
  deadline: string | null
  deadline_cycle: string | null
  amount: string | null
  host_geography: string
  fit_reason: string
  confidence: 'verified' | 'unverified'
  verify_notes: string
  source_url: string | null
}

export interface FundingFitResult {
  score: number
  reason: string
  eligible: boolean
  eligibilityReason: string
  eligibilityFlags: string[]
  deadline?: string | null
  applicantType?: FundingProgramEvaluation['applicant_type']
  confidence?: FundingProgramEvaluation['confidence']
  amount?: string | null
  disqualifiers?: string[]
  verifyNotes?: string
  deadlineCycle?: string | null
  hostGeography?: string
}

function parseDeadline(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizeEvaluation(raw: Record<string, unknown>): FundingProgramEvaluation {
  const applicantType = raw.applicant_type === 'PI-led / join-as-scholar' ?
    'PI-led / join-as-scholar'
  : 'student-direct'
  const confidence = raw.confidence === 'verified' ? 'verified' : 'unverified'

  const disqualifiers = Array.isArray(raw.disqualifiers) ? raw.disqualifiers.map(String) : []
  const eligible = raw.eligible === false || disqualifiers.length > 0 ? false : true

  return {
    index: typeof raw.index === 'number' ? raw.index : undefined,
    name: String(raw.name ?? raw.title ?? 'Funding opportunity'),
    score: Math.min(100, Math.max(0, Math.round(Number(raw.score) || 0))),
    eligible,
    applicant_type: applicantType,
    eligibility_gates: Array.isArray(raw.eligibility_gates) ? raw.eligibility_gates.map(String) : [],
    disqualifiers,
    deadline: parseDeadline(raw.deadline),
    deadline_cycle: raw.deadline_cycle ? String(raw.deadline_cycle) : null,
    amount: raw.amount ? String(raw.amount) : null,
    host_geography: String(raw.host_geography ?? ''),
    fit_reason: String(raw.fit_reason ?? raw.reason ?? ''),
    confidence,
    verify_notes: String(raw.verify_notes ?? ''),
    source_url: raw.source_url ? String(raw.source_url) : null,
  }
}

function evaluationToFitResult(ev: FundingProgramEvaluation): FundingFitResult {
  const hardBlock = ev.disqualifiers.length > 0
  return {
    score: ev.score,
    reason: ev.fit_reason,
    eligible: hardBlock ? false : ev.eligible,
    eligibilityReason: hardBlock ?
      `Disqualifiers: ${ev.disqualifiers.join('; ')}`
    : ev.fit_reason,
    eligibilityFlags: [
      `confidence:${ev.confidence}`,
      `applicant_type:${ev.applicant_type}`,
      ...ev.eligibility_gates.slice(0, 4),
    ],
    deadline: ev.deadline,
    applicantType: ev.applicant_type,
    confidence: ev.confidence,
    amount: ev.amount,
    disqualifiers: ev.disqualifiers,
    verifyNotes: ev.verify_notes,
    deadlineCycle: ev.deadline_cycle,
    hostGeography: ev.host_geography,
  }
}

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1].trim() : trimmed
  return JSON.parse(body)
}

export async function evaluateFundingOpeningsBatch(
  profile: MasterProfileData,
  settings: FundingSettingsInput,
  openings: FundingOppInput[],
): Promise<FundingProgramEvaluation[]> {
  if (!openings.length) return []

  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `${FUNDING_SCOUT_SYSTEM_PROMPT}\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: buildBatchOpeningsTask(safe, settings, openings),
    }],
    maxTokens: 4096,
    temperature: 0.15,
  })

  try {
    const parsed = parseJsonPayload(raw)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.map((row) => normalizeEvaluation(row as Record<string, unknown>))
  } catch {
    return []
  }
}

export async function evaluateFundingOpening(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<FundingProgramEvaluation> {
  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `${FUNDING_SCOUT_SYSTEM_PROMPT}\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: buildSingleOpeningTask(safe, settings, opp),
    }],
    maxTokens: 768,
    temperature: 0.15,
  })

  try {
    const parsed = parseJsonPayload(raw) as Record<string, unknown>
    return normalizeEvaluation(parsed)
  } catch {
    return normalizeEvaluation({
      name: opp.title,
      score: 40,
      eligible: true,
      applicant_type: 'student-direct',
      eligibility_gates: [],
      disqualifiers: [],
      deadline: null,
      fit_reason: 'Could not parse AI evaluation — verify manually',
      confidence: 'unverified',
      verify_notes: 'Re-check primary source',
    })
  }
}

export async function scoreFundingFit(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<FundingFitResult> {
  const ev = await evaluateFundingOpening(profile, opp, settings)
  return evaluationToFitResult(ev)
}

export async function scoreFundingFitBatch(
  profile: MasterProfileData,
  settings: FundingSettingsInput,
  openings: FundingOppInput[],
): Promise<Map<number, FundingFitResult>> {
  const evaluations = await evaluateFundingOpeningsBatch(profile, settings, openings)
  const map = new Map<number, FundingFitResult>()
  for (const ev of evaluations) {
    const idx = ev.index ?? evaluations.indexOf(ev)
    map.set(idx, evaluationToFitResult(ev))
  }
  return map
}

export async function generateFundingPack(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<{ motivationLetter: string; researchSummary: string; projectOutline: string }> {
  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `Write funding application materials for a PhD/research candidate. Output ONLY valid JSON with keys: motivationLetter, researchSummary, projectOutline. No markdown fences. Do not invent credentials.\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: `${buildResearcherProfileBlock(safe, settings)}

Profile evidence (use only these): ${JSON.stringify(safe.evidence.slice(0, 12))}

Opportunity:
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
URL: ${opp.opportunityUrl ?? 'n/a'}

Description:
${opp.description.slice(0, 8000)}

Write:
1. motivationLetter — 350-500 words, authentic tone, aligned with supervision path in profile
2. researchSummary — 150-200 words on PhD research fit
3. projectOutline — 5-8 bullet research proposal outline`,
    }],
    maxTokens: 4096,
    temperature: 0.35,
  })

  try {
    const parsed = JSON.parse(raw) as { motivationLetter: string; researchSummary: string; projectOutline: string }
    return {
      motivationLetter: sanitizeApplicationText(parsed.motivationLetter ?? ''),
      researchSummary: sanitizeApplicationText(parsed.researchSummary ?? ''),
      projectOutline: sanitizeApplicationText(parsed.projectOutline ?? ''),
    }
  } catch {
    return {
      motivationLetter: sanitizeApplicationText(raw),
      researchSummary: '',
      projectOutline: '',
    }
  }
}
