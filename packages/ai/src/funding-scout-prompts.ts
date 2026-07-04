import type { MasterProfileData } from './job-agent'
import type { FundingOppInput, FundingSettingsInput } from './funding-scout'

/** System prompt — research-funding scout operating rules. */
export const FUNDING_SCOUT_SYSTEM_PROMPT = `You are a research-funding scout for an individual researcher. Given a researcher profile and opening text enriched with PRIMARY SOURCE fetches and optional WEB VERIFICATION SNIPPETS, evaluate REAL funding calls and return structured, verified records.

OPERATING RULES
1. Decompose mentally across categories: (a) national/domestic, (b) EU/supranational, (c) field-specific & industry, (d) country-bilateral per geography, (e) compute/infrastructure, (f) demographic-specific (women-in-STEM, early-career).
2. Evaluate one opening at a time with focus. Never merge multiple programs.
3. Domestic programs (TÜBİTAK, KYK, YÖK, İTÜ): expect Turkish-language context. International: English.
4. Verify, don't recall. Deadlines, amounts, and eligibility change constantly.
   - HIGHEST priority: text under "--- PRIMARY SOURCE" (fresh page fetch from opportunity URL).
   - SECOND priority: "--- WEB VERIFICATION SNIPPETS" (targeted search hits).
   - LOWEST priority: initial listing description.
   Use ONLY facts present in these provided sections. If a deadline or amount is NOT in any section, set deadline null, amount null, confidence "unverified", and explain in verify_notes what the user must check on the primary source.
5. Prefer primary sources. Mark confidence "verified" ONLY when deadline or amount appears explicitly in PRIMARY SOURCE or WEB VERIFICATION sections — never from training memory.
6. Classify every result with: name, applicant_type ("student-direct" | "PI-led / join-as-scholar"), eligibility_gates (array of short strings), disqualifiers (hard blockers for THIS profile — empty if none), deadline (YYYY-MM-DD or null), deadline_cycle (e.g. "annual", "rolling", or null), amount (string or null), host_geography, source_url, fit_reason, confidence ("verified" | "unverified"), verify_notes, score (0-100 fit), eligible (boolean).
7. Be honest about uncertainty. Mark confidence "unverified" when deadline, amount, or citizenship eligibility cannot be confirmed from provided text.
8. Flag disqualifiers up front. If topic fits but profile likely fails a HARD gate (wrong citizenship, age cap, must already be enrolled, Commonwealth-only for Turkish citizen, postdoc-only, undergraduate-only), set eligible=false and list in disqualifiers.

OUTPUT: JSON only. No prose, no markdown fences.`

export function buildResearcherProfileBlock(
  profile: MasterProfileData,
  settings: FundingSettingsInput,
): string {
  const langs = profile.languages?.length ?
    profile.languages.map((l) => `${l.language} (${l.level})`).join(', ')
  : 'English, Turkish'

  const geographies = [
    'domestic (Turkey)',
    ...(settings.partnerCountries ?? []),
    ...(settings.regions ?? []),
  ].filter(Boolean)
  const uniqueGeo = [...new Set(geographies.map((g) => g.toLowerCase()))]

  return `Researcher profile:
- Field: ${profile.domains?.join(', ') || 'naval architecture / marine technology + AI-ML (hydrodynamics, CFD, digital twins)'}
- Summary: ${profile.summary || 'PhD researcher — maritime AI, offshore, digital twin'}
- Level: ${settings.phdStage === 'starting' ? 'incoming' : settings.phdStage} PhD (${settings.phdStartMonth ?? '2026-09'}) at ${settings.homeUniversity || 'home university'}, ${settings.homeCountry ?? 'TR'}
- Citizenship: ${settings.homeCountry ?? settings.citizenship ?? 'TR'}
- Languages: ${langs}
- Supervision model: ${settings.supervisionModel ?? 'co_supervision'} (China co-supervisor / NL cotutelle path)
- Partnership notes: ${settings.partnershipNotes || 'none'}
- Geographies of interest: ${uniqueGeo.join(', ')}
- Goal: stackable individual scholarships + PI-led bilateral projects to join as bursiyer/scholar
- Strict eligibility mode: ${settings.strictEligibility !== false ? 'yes — reject hard disqualifiers' : 'relaxed'}`
}

export function buildSingleOpeningTask(
  profile: MasterProfileData,
  settings: FundingSettingsInput,
  opp: FundingOppInput,
): string {
  const primaryBlock = opp.primarySourceText ?
    `\n--- PRIMARY SOURCE (${opp.primarySourceFetchedAt ?? 'fetched'}) ---\n${opp.primarySourceText.slice(0, 12000)}`
  : ''
  const verifyBlock = opp.searchVerificationSnippets?.length ?
    `\n--- WEB VERIFICATION SNIPPETS ---\n${opp.searchVerificationSnippets.map((h) => `[${h.title}] ${h.url}\n${h.snippet}`).join('\n\n').slice(0, 4000)}`
  : ''

  return `${buildResearcherProfileBlock(profile, settings)}

OPENING TO VERIFY (use PRIMARY SOURCE first, then WEB VERIFICATION, then listing text):
Funder: ${opp.funder}
Title: ${opp.title}
Type: ${opp.fundingType}
Region: ${opp.region}
URL: ${opp.opportunityUrl ?? 'not provided'}
Listing description:
${opp.description.slice(0, 6000)}${primaryBlock}${verifyBlock}

Return ONE JSON object with fields: name, applicant_type, eligibility_gates, disqualifiers, deadline, deadline_cycle, amount, host_geography, source_url, fit_reason, confidence, verify_notes, score, eligible.`
}

export function buildBatchOpeningsTask(
  profile: MasterProfileData,
  settings: FundingSettingsInput,
  openings: FundingOppInput[],
): string {
  const payload = openings.map((opp, index) => {
    const parts: string[] = [opp.description.slice(0, 2500)]
    if (opp.primarySourceText) {
      parts.push(`PRIMARY SOURCE (${opp.primarySourceFetchedAt ?? 'fetched'}): ${opp.primarySourceText.slice(0, 3500)}`)
    }
    if (opp.searchVerificationSnippets?.length) {
      const verify = opp.searchVerificationSnippets
        .map((h) => `[${h.title}] ${h.url}\n${h.snippet}`)
        .join('\n')
        .slice(0, 2000)
      parts.push(`WEB VERIFICATION: ${verify}`)
    }
    return {
      index,
      funder: opp.funder,
      title: opp.title,
      type: opp.fundingType,
      region: opp.region,
      url: opp.opportunityUrl ?? null,
      text: parts.join('\n\n'),
    }
  })

  return `${buildResearcherProfileBlock(profile, settings)}

OPENINGS TO VERIFY (${openings.length} — enriched with primary fetches + web search where available):
Priority for facts: PRIMARY SOURCE sections > WEB VERIFICATION SNIPPETS > listing text.
${JSON.stringify(payload, null, 2)}

Return a JSON array with one evaluation object per opening. Each object MUST include "index" matching the input. Sort by deadline proximity (null deadlines last). Fields per object: index, name, applicant_type, eligibility_gates, disqualifiers, deadline, deadline_cycle, amount, host_geography, source_url, fit_reason, confidence, verify_notes, score, eligible.`
}

export const FUNDING_EVALUATION_JSON_SHAPE = {
  index: 'number (batch only)',
  name: 'string',
  applicant_type: '"student-direct" | "PI-led / join-as-scholar"',
  eligibility_gates: 'string[]',
  disqualifiers: 'string[]',
  deadline: 'YYYY-MM-DD | null',
  deadline_cycle: 'string | null',
  amount: 'string | null',
  host_geography: 'string',
  source_url: 'string | null',
  fit_reason: 'string',
  confidence: '"verified" | "unverified"',
  verify_notes: 'string',
  score: '0-100',
  eligible: 'boolean',
}
