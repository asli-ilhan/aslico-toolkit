export interface ApplicationPack {
  id: string
  company: string
  role: string
  job_url: string | null
  job_description: string | null
  remote_type: string | null
  employment_type: string | null
  fit_score: number | null
  fit_reason: string | null
  ai_risk_level: string
  ai_risk_reason: string | null
  auto_submit_blocked: boolean | null
  tailored_cv: string | null
  cover_letter: string | null
  email_draft: string | null
  notes: string | null
  deadline_at: string | null
  follow_up_at: string | null
  funnel_stage: string
  profile_variant: string | null
  domain_fit: Record<string, number> | null
  status: string
  source: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  submitted_at: string | null
}
