import { createClaudeMessage } from './claude'
import { JOB_APPLICATION_GUARDRAILS, profileForApplications, sanitizeApplicationText } from './profile-guard'
import type { MasterProfileData } from './job-agent'

export interface FundingOppInput {
  funder: string
  title: string
  fundingType: string
  region: string
  description: string
  opportunityUrl?: string
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
}

export interface FundingFitResult {
  score: number
  reason: string
  eligible: boolean
  eligibilityReason: string
  eligibilityFlags: string[]
  deadline?: string | null
}

function eligibilityContext(settings: FundingSettingsInput): string {
  const partners = (settings.partnerCountries ?? []).join(', ') || 'none'
  return `Eligibility profile:
- Citizenship / home country: ${settings.homeCountry ?? settings.citizenship ?? 'TR'}
- PhD stage: ${settings.phdStage ?? 'starting'}
- Planned PhD start: ${settings.phdStartMonth ?? '2026-09'}
- Home university: ${settings.homeUniversity || 'not specified'}
- Partner countries / co-supervision targets: ${partners}
- Supervision model: ${settings.supervisionModel ?? 'co_supervision'}
- University partnership notes: ${settings.partnershipNotes || 'none'}
- Strict eligibility: ${settings.strictEligibility !== false ? 'yes — skip ineligible programmes' : 'relaxed'}

Candidate may pursue:
- PhD starting September 2026
- Chinese co-supervisor / joint supervision with China (CSC-style)
- Home university in Turkey with Netherlands partnership (joint PhD / cotutelle / bilateral)

Reject (eligible=false) if programme requires wrong citizenship, EU-only, US-only, UK-only, Commonwealth-only (Turkey not Commonwealth), postdoc-only, undergraduate-only, or already-enrolled PhD when candidate is starting fresh in 2026.
Boost eligible=true for: TÜBİTAK 2214, CSC joint PhD, Erasmus Mundus JMD, MSCA DN, NWO/NL bilateral, co-supervision/cotutelle/joint degree programmes matching China or Netherlands paths.`
}

export async function scoreFundingFit(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<FundingFitResult> {
  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `Score funding fit AND eligibility for a PhD/research candidate. Output ONLY JSON:
{"score": number, "eligible": boolean, "reason": "one sentence fit", "eligibilityReason": "why eligible or ineligible for THIS candidate", "deadline": "YYYY-MM-DD" or null, "eligibilityFlags": string[]}

score = research fit 0-100. eligible = can realistically apply given citizenship, stage, supervision model, and partnership path. Penalize wrong citizenship, wrong stage, unrelated fields. Extract deadline when stated.\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: `${eligibilityContext(settings)}

Candidate summary: ${safe.summary}
Domains: ${safe.domains.join(', ')}
PhD: ${safe.constraints.phdInProgress ?? settings.phdStage ?? 'starting'}

Opportunity:
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
${opp.description.slice(0, 6000)}`,
    }],
    maxTokens: 384,
    temperature: 0.2,
  })

  try {
    const parsed = JSON.parse(raw) as {
      score: number
      eligible?: boolean
      reason: string
      eligibilityReason?: string
      deadline?: string | null
      eligibilityFlags?: string[]
    }
    const deadline =
      typeof parsed.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline) ?
        parsed.deadline
      : null
    return {
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      reason: parsed.reason ?? '',
      eligible: parsed.eligible !== false,
      eligibilityReason: parsed.eligibilityReason ?? parsed.reason ?? '',
      eligibilityFlags: Array.isArray(parsed.eligibilityFlags) ? parsed.eligibilityFlags : [],
      deadline,
    }
  } catch {
    return {
      score: 50,
      reason: 'Could not parse fit score',
      eligible: true,
      eligibilityReason: 'Parse error — verify manually',
      eligibilityFlags: [],
      deadline: null,
    }
  }
}

export async function generateFundingPack(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<{ motivationLetter: string; researchSummary: string; projectOutline: string }> {
  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `Write funding application materials for a PhD/research candidate. Maritime AI, offshore, energy, digital twin focus. Output ONLY valid JSON with keys: motivationLetter, researchSummary, projectOutline. No markdown fences. Do not invent credentials.\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: `${eligibilityContext(settings)}

Profile summary: ${safe.summary}
Evidence (use only these): ${JSON.stringify(safe.evidence.slice(0, 12))}
PhD stage: ${settings.phdStage ?? 'starting'}
Citizenship: ${settings.homeCountry ?? settings.citizenship ?? 'TR'}

Opportunity:
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
URL: ${opp.opportunityUrl ?? 'n/a'}

Description:
${opp.description.slice(0, 8000)}

Write:
1. motivationLetter — 350-500 words, mention joint supervision / China co-supervisor or NL partnership only if aligned with eligibility profile above
2. researchSummary — 150-200 words on PhD research fit
3. projectOutline — bullet outline for research proposal (5-8 bullets)`,
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
