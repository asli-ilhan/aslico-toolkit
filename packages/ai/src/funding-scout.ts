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
  phdStage?: string
  disciplines?: string[]
}

export async function scoreFundingFit(
  profile: MasterProfileData,
  opp: FundingOppInput,
  settings: FundingSettingsInput,
): Promise<{ score: number; reason: string; deadline?: string | null }> {
  const safe = profileForApplications(profile)
  const raw = await createClaudeMessage({
    system: `Score funding fit 0-100 for a PhD/research candidate. Output ONLY JSON: {"score": number, "reason": "one sentence", "deadline": "YYYY-MM-DD" or null}. Penalize wrong citizenship, undergraduate-only, or unrelated fields. Extract application deadline from the text when explicitly stated; null if rolling or unknown.\n${JOB_APPLICATION_GUARDRAILS}`,
    messages: [{
      role: 'user',
      content: `Candidate: ${safe.summary}
Domains: ${safe.domains.join(', ')}
PhD: ${safe.constraints.phdInProgress ?? settings.phdStage ?? 'starting'}
Citizenship: ${settings.citizenship ?? 'TR'}

Opportunity:
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
${opp.description.slice(0, 6000)}`,
    }],
    maxTokens: 256,
    temperature: 0.2,
  })

  try {
    const parsed = JSON.parse(raw) as { score: number; reason: string; deadline?: string | null }
    const deadline =
      typeof parsed.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline) ?
        parsed.deadline
      : null
    return {
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      reason: parsed.reason ?? '',
      deadline,
    }
  } catch {
    return { score: 50, reason: 'Could not parse fit score', deadline: null }
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
      content: `Profile summary: ${safe.summary}
Evidence (use only these): ${JSON.stringify(safe.evidence.slice(0, 12))}
PhD stage: ${settings.phdStage ?? 'starting'}
Citizenship: ${settings.citizenship ?? 'TR'}

Opportunity:
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
URL: ${opp.opportunityUrl ?? 'n/a'}

Description:
${opp.description.slice(0, 8000)}

Write:
1. motivationLetter — 350-500 words, authentic, not generic AI tone
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
