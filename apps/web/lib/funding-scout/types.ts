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

export interface FundingSettings {
  regions: FundingRegion[]
  fundingTypes: FundingType[]
  disciplines: string[]
  requireFullFunding: boolean
  scanDepth: ScanDepth
  citizenship: string
  phdStage: 'starting' | 'in_progress' | 'postdoc'
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
