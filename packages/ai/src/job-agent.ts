import { createClaudeMessage } from './claude'

export interface EvidenceItem {
  id: string
  domain: string
  claim: string
  source?: string
}

export interface MasterProfileData {
  summary: string
  domains: string[]
  languages: { language: string; level: string }[]
  constraints: {
    remotePreferred: boolean
    remoteOnly: boolean
    openToContract: boolean
    openToFreelance: boolean
    openToGig: boolean
    phdInProgress?: string
  }
  evidence: EvidenceItem[]
  voiceSamples: string[]
}

export interface PackInput {
  company: string
  role: string
  jobDescription: string
  jobUrl?: string
  remoteType?: string
  employmentType?: string
  locale?: string
}

function localeHint(locale: string): string {
  if (locale === 'tr') return 'Write in Turkish unless the job posting is clearly English-only.'
  if (locale === 'fr') return 'Write in French if appropriate for the role.'
  return 'Write in English unless the job posting is clearly Turkish.'
}

export async function buildMasterProfile(
  documents: { filename: string; docType: string; content: string }[],
): Promise<MasterProfileData> {
  const corpus = documents
    .map((d) => `--- ${d.docType}: ${d.filename} ---\n${d.content.slice(0, 12000)}`)
    .join('\n\n')
    .slice(0, 48000)

  const raw = await createClaudeMessage({
    system: `You build a structured candidate master profile from CVs and cover letters. Output ONLY valid JSON, no markdown fences. Never invent experience — only use facts present in the documents. Include evidence items with id, domain, claim, source (filename). Domains: maritime, offshore, renewable_energy, wind, digital_twin, machine_learning, data_science, ai, hci, research, other.`,
    messages: [
      {
        role: 'user',
        content: `Extract master profile JSON with keys: summary, domains (array), languages ([{language, level}]), constraints ({remotePreferred, remoteOnly, openToContract, openToFreelance, openToGig, phdInProgress}), evidence ([{id, domain, claim, source}]), voiceSamples (2-4 short authentic sentences copied or paraphrased from cover letters).

Documents:
${corpus}`,
      },
    ],
    maxTokens: 4096,
    temperature: 0.2,
  })

  try {
    const parsed = JSON.parse(raw) as MasterProfileData
    return {
      summary: parsed.summary ?? '',
      domains: parsed.domains ?? [],
      languages: parsed.languages ?? [],
      constraints: parsed.constraints ?? {
        remotePreferred: true,
        remoteOnly: false,
        openToContract: true,
        openToFreelance: true,
        openToGig: true,
      },
      evidence: parsed.evidence ?? [],
      voiceSamples: parsed.voiceSamples ?? [],
    }
  } catch {
    return {
      summary: raw.slice(0, 2000),
      domains: [],
      languages: [],
      constraints: {
        remotePreferred: true,
        remoteOnly: false,
        openToContract: true,
        openToFreelance: true,
        openToGig: true,
      },
      evidence: [],
      voiceSamples: [],
    }
  }
}

export async function scoreJobFit(
  profile: MasterProfileData,
  job: PackInput,
): Promise<{ score: number; reason: string }> {
  const raw = await createClaudeMessage({
    system: 'Score job fit 0-100. Output ONLY JSON: {"score": number, "reason": "one sentence"}. Be realistic.',
    messages: [
      {
        role: 'user',
        content: `Profile summary: ${profile.summary}
Domains: ${profile.domains.join(', ')}
Evidence count: ${profile.evidence.length}

Job: ${job.company} · ${job.role}
Remote: ${job.remoteType ?? 'unknown'}
Type: ${job.employmentType ?? 'unknown'}

Description:
${job.jobDescription.slice(0, 6000)}`,
      },
    ],
    maxTokens: 256,
    temperature: 0.1,
  })

  try {
    return JSON.parse(raw) as { score: number; reason: string }
  } catch {
    return { score: 50, reason: 'Could not parse fit score.' }
  }
}

export async function generateApplicationPack(
  profile: MasterProfileData,
  job: PackInput,
  preferences?: { remoteRequired?: boolean; onsiteMinScore?: number },
  variantSummary?: string,
): Promise<{
  tailoredCv: string
  coverLetter: string
  evidenceUsed: EvidenceItem[]
}> {
  const locale = job.locale ?? 'en'
  const evidenceJson = JSON.stringify(profile.evidence.slice(0, 40))

  const selectedRaw = await createClaudeMessage({
    system: 'Select 4-6 evidence item IDs most relevant to the job. Output ONLY JSON array of id strings.',
    messages: [
      {
        role: 'user',
        content: `Job: ${job.role} at ${job.company}\n${job.jobDescription.slice(0, 4000)}\n\nEvidence:\n${evidenceJson}`,
      },
    ],
    maxTokens: 256,
    temperature: 0.1,
  })

  let selectedIds: string[] = []
  try {
    selectedIds = JSON.parse(selectedRaw) as string[]
  } catch {
    selectedIds = profile.evidence.slice(0, 5).map((e) => e.id)
  }

  const evidenceUsed = profile.evidence.filter((e) => selectedIds.includes(e.id))
  const evidenceBlock = evidenceUsed.map((e) => `- [${e.domain}] ${e.claim}`).join('\n')

  const remoteNote =
    preferences?.remoteRequired || profile.constraints.remotePreferred
      ? 'Candidate strongly prefers remote work. If onsite/hybrid, state remote-only clearly and professionally.'
      : ''

  const profileSummary = variantSummary?.trim() || profile.summary

  const draftCv = await createClaudeMessage({
    system: `Tailor a 1-page CV in markdown. ${localeHint(locale)} Use ONLY provided evidence. Remove irrelevant disciplines. Max 6 bullets per section.`,
    messages: [
      {
        role: 'user',
        content: `Role: ${job.role} at ${job.company}\n\nProfile:\n${profileSummary}\n\nSelected evidence:\n${evidenceBlock}\n\nJob:\n${job.jobDescription.slice(0, 5000)}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.3,
  })

  const draftLetter = await createClaudeMessage({
    system: `Draft cover letter (max 320 words). ${localeHint(locale)} Factual only. No "I am excited", "passionate", "dynamic team". ${remoteNote}`,
    messages: [
      {
        role: 'user',
        content: `Role: ${job.role} at ${job.company}\n\nEvidence:\n${evidenceBlock}\n\nConstraints: ${JSON.stringify(profile.constraints)}\n\nJob:\n${job.jobDescription.slice(0, 5000)}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.35,
  })

  const voiceHint = profile.voiceSamples.length
    ? `Match this voice style:\n${profile.voiceSamples.join('\n')}`
    : 'Sound human, slightly academic-industry bridge tone.'

  const humanized = await createClaudeMessage({
    system: `Humanize the cover letter. Add 1-2 authentic nuanced sentences (e.g. research vs industry bridge, PhD + contract flexibility) WITHOUT inventing facts. ${voiceHint} Avoid AI clichés. Output ONLY the final letter.`,
    messages: [
      {
        role: 'user',
        content: `Draft to humanize:\n${draftLetter}\n\nRemote preference: ${profile.constraints.remotePreferred}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.5,
  })

  return {
    tailoredCv: draftCv,
    coverLetter: humanized,
    evidenceUsed,
  }
}

export async function buildProfileVariants(
  profile: MasterProfileData,
): Promise<Record<string, { label: string; summary: string; emphasis: string[] }>> {
  const raw = await createClaudeMessage({
    system:
      'Create three profile variants from one master profile. Output ONLY valid JSON with keys research, industry, gig. Each value: {label, summary (2-3 sentences), emphasis (string array)}. No invented facts.',
    messages: [
      {
        role: 'user',
        content: `Master profile:\n${JSON.stringify({ summary: profile.summary, domains: profile.domains, evidence: profile.evidence.slice(0, 15) })}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.25,
  })

  try {
    return JSON.parse(raw) as Record<string, { label: string; summary: string; emphasis: string[] }>
  } catch {
    return {
      research: { label: 'Research', summary: profile.summary, emphasis: profile.domains },
      industry: { label: 'Industry', summary: profile.summary, emphasis: profile.domains },
      gig: { label: 'Gig / contract', summary: profile.summary, emphasis: ['flexible', 'remote'] },
    }
  }
}

export async function generateEmailDraft(
  profile: MasterProfileData,
  job: PackInput,
  coverLetter: string,
  userEmail?: string,
): Promise<string> {
  return createClaudeMessage({
    system:
      'Write a short professional application email (max 180 words). Include subject line on first line as "Subject: ...". No AI clichés. Factual only.',
    messages: [
      {
        role: 'user',
        content: `Applicant summary: ${profile.summary.slice(0, 500)}
Role: ${job.role} at ${job.company}
Cover letter excerpt:\n${coverLetter.slice(0, 1200)}
Sign-off name/email: ${userEmail ?? 'applicant'}`,
      },
    ],
    maxTokens: 512,
    temperature: 0.35,
  })
}

export interface OutreachContactInput {
  name: string
  title: string
  email: string
}

export async function selectOutreachContacts(
  candidates: OutreachContactInput[],
  company: string,
  role: string,
): Promise<OutreachContactInput[]> {
  if (candidates.length === 0) return []
  if (candidates.length <= 3) return candidates

  const raw = await createClaudeMessage({
    system:
      'Pick up to 3 best cold-outreach recipients for a job application follow-up. Prefer hiring managers, recruiters, talent, HR, team leads. Return JSON only: {"emails":["a@x.com"]}',
    messages: [
      {
        role: 'user',
        content: `Company: ${company}
Role applied: ${role}
Candidates:\n${candidates
          .map((c) => `- ${c.name} (${c.title}) <${c.email}>`)
          .join('\n')}`,
      },
    ],
    maxTokens: 256,
    temperature: 0.1,
  })

  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as { emails?: string[] }
    const picked = new Set((parsed.emails ?? []).map((e) => e.toLowerCase()))
    const selected = candidates.filter((c) => picked.has(c.email.toLowerCase()))
    return selected.length > 0 ? selected.slice(0, 3) : candidates.slice(0, 3)
  } catch {
    return candidates.slice(0, 3)
  }
}

export async function generateColdOutreachEmail(
  profile: MasterProfileData,
  job: PackInput,
  recipients: OutreachContactInput[],
  userEmail?: string,
): Promise<{ subject: string; body: string }> {
  const raw = await createClaudeMessage({
    system: `Write a short cold outreach email after submitting a job application. Max 160 words in body.
Tone: warm, specific, human. No AI clichés. Reference the role and one real credential from the profile.
Return JSON only: {"subject":"...","body":"..."}
Sign off with the applicant's name from their email local part or "Best regards".`,
    messages: [
      {
        role: 'user',
        content: `Applicant summary: ${profile.summary.slice(0, 600)}
Domains: ${profile.domains.join(', ')}
Role applied: ${job.role} at ${job.company}
Job URL: ${job.jobUrl ?? 'n/a'}
Recipients (agent will send to all):\n${recipients.map((r) => `- ${r.name}, ${r.title}`).join('\n')}
Applicant email: ${userEmail ?? 'applicant'}`,
      },
    ],
    maxTokens: 700,
    temperature: 0.4,
  })

  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as {
      subject?: string
      body?: string
    }
    return {
      subject: parsed.subject?.trim() || `Following up on ${job.role} at ${job.company}`,
      body: parsed.body?.trim() || raw,
    }
  } catch {
    return {
      subject: `Following up on ${job.role} at ${job.company}`,
      body: raw,
    }
  }
}

// Keep legacy exports
export interface JobAgentInput {
  company: string
  role: string
  jobDescription: string
  cvProfile: string
  locale?: string
}

export async function generateCoverLetter(input: JobAgentInput): Promise<string> {
  const profile: MasterProfileData = {
    summary: input.cvProfile.slice(0, 1500),
    domains: [],
    languages: [],
    constraints: {
      remotePreferred: true,
      remoteOnly: false,
      openToContract: true,
      openToFreelance: true,
      openToGig: true,
    },
    evidence: [{ id: '1', domain: 'general', claim: input.cvProfile.slice(0, 2000) }],
    voiceSamples: [],
  }
  const pack = await generateApplicationPack(profile, input)
  return pack.coverLetter
}

export async function generateCvSuggestions(input: JobAgentInput): Promise<string> {
  const profile: MasterProfileData = {
    summary: input.cvProfile.slice(0, 1500),
    domains: [],
    languages: [],
    constraints: {
      remotePreferred: true,
      remoteOnly: false,
      openToContract: true,
      openToFreelance: true,
      openToGig: true,
    },
    evidence: [{ id: '1', domain: 'general', claim: input.cvProfile.slice(0, 2000) }],
    voiceSamples: [],
  }
  const pack = await generateApplicationPack(profile, input)
  return pack.tailoredCv
}
