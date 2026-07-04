export type FundingRegion =
  | 'uk'
  | 'eu'
  | 'turkey'
  | 'china'
  | 'japan'
  | 'korea'
  | 'gulf'
  | 'middle_east'
  | 'americas'
  | 'australia'
  | 'global'

export type FundingType =
  | 'phd_scholarship'
  | 'fellowship'
  | 'project_grant'
  | 'travel_grant'
  | 'conference_grant'
  | 'equipment_grant'
  | 'open_application'

export type FundingStatus =
  | 'pending_review'
  | 'approved'
  | 'submitted'
  | 'skipped'
  | 'rejected'
  | 'awarded'

export type ScanDepth = 'normal' | 'deep'

export type SupervisionModel = 'standard' | 'joint_phd' | 'co_supervision' | 'cotutelle'

export interface FundingSettings {
  regions: FundingRegion[]
  fundingTypes: FundingType[]
  disciplines: string[]
  requireFullFunding: boolean
  scanDepth: ScanDepth
  citizenship: string
  phdStage: 'starting' | 'in_progress' | 'postdoc'
  phdStartMonth: string
  homeUniversity: string
  homeCountry: string
  partnerCountries: string[]
  supervisionModel: SupervisionModel
  partnershipNotes: string
  strictEligibility: boolean
}

export interface FundingCandidate {
  funder: string
  title: string
  fundingType: FundingType
  region: FundingRegion
  description: string
  opportunityUrl?: string
  deadline?: string
  amount?: string
  source: string
  fullFunding?: boolean
  priorityTier?: 'turkey_national' | 'home_university' | 'global'
  listingKind?: 'live_opening' | 'program_catalog'
}

export const DEFAULT_FUNDING_SETTINGS: FundingSettings = {
  regions: ['uk', 'eu', 'turkey', 'china', 'japan', 'gulf', 'americas', 'global'],
  fundingTypes: [
    'phd_scholarship',
    'fellowship',
    'project_grant',
    'travel_grant',
  ],
  disciplines: [
    'maritime',
    'offshore',
    'energy',
    'renewable_energy',
    'wind',
    'machine_learning',
    'data_science',
    'ai',
    'engineering',
    'digital_twin',
  ],
  requireFullFunding: true,
  scanDepth: 'normal',
  citizenship: 'TR',
  phdStage: 'starting',
  phdStartMonth: '2026-09',
    homeUniversity: 'İstanbul Teknik Üniversitesi',
  homeCountry: 'TR',
  partnerCountries: ['china', 'netherlands'],
  supervisionModel: 'co_supervision',
  partnershipNotes: '',
  strictEligibility: true,
}

export function mergeFundingSettings(
  saved: Partial<FundingSettings> | null | undefined,
): FundingSettings {
  const merged = { ...DEFAULT_FUNDING_SETTINGS, ...(saved ?? {}) }
  merged.regions = [...new Set([...DEFAULT_FUNDING_SETTINGS.regions, ...(saved?.regions ?? [])])]
  merged.disciplines = [
    ...new Set([...DEFAULT_FUNDING_SETTINGS.disciplines, ...(saved?.disciplines ?? [])]),
  ]
  return merged
}

export function settingsFromDbRow(row: Record<string, unknown> | null | undefined): FundingSettings {
  if (!row) return mergeFundingSettings(null)
  return mergeFundingSettings({
    regions: row.regions as FundingSettings['regions'],
    fundingTypes: row.funding_types as FundingSettings['fundingTypes'],
    disciplines: row.disciplines as string[],
    requireFullFunding: row.require_full_funding as boolean,
    scanDepth: row.scan_depth as FundingSettings['scanDepth'],
    citizenship: (row.citizenship as string) ?? 'TR',
    phdStage: row.phd_stage as FundingSettings['phdStage'],
    phdStartMonth: (row.phd_start_month as string) ?? '2026-09',
    homeUniversity: (row.home_university as string) ?? '',
    homeCountry: (row.home_country as string) ?? 'TR',
    partnerCountries: (row.partner_countries as string[]) ?? ['china', 'netherlands'],
    supervisionModel: (row.supervision_model as FundingSettings['supervisionModel']) ?? 'co_supervision',
    partnershipNotes: (row.partnership_notes as string) ?? '',
    strictEligibility: row.strict_eligibility !== false,
  })
}

export function settingsToDbRow(userId: string, s: FundingSettings) {
  return {
    user_id: userId,
    regions: s.regions,
    funding_types: s.fundingTypes,
    disciplines: s.disciplines,
    require_full_funding: s.requireFullFunding,
    scan_depth: s.scanDepth,
    citizenship: s.citizenship,
    phd_stage: s.phdStage,
    phd_start_month: s.phdStartMonth,
    home_university: s.homeUniversity,
    home_country: s.homeCountry,
    partner_countries: s.partnerCountries,
    supervision_model: s.supervisionModel,
    partnership_notes: s.partnershipNotes,
    strict_eligibility: s.strictEligibility,
    updated_at: new Date().toISOString(),
  }
}
