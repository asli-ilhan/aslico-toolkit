function isMissingTable(error: { code?: string; message?: string }, table: string): boolean {
  const msg = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes(table) ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  )
}

export function isMissingTranscriptionsTable(error: {
  code?: string
  message?: string
}): boolean {
  return isMissingTable(error, 'transcriptions')
}

export function isMissingJobApplicationsTable(error: {
  code?: string
  message?: string
}): boolean {
  return isMissingTable(error, 'job_applications')
}

export function isMissingJobAgentV2(error: { code?: string; message?: string }): boolean {
  return (
    isMissingTable(error, 'application_packs') ||
    isMissingTable(error, 'candidate_profiles') ||
    isMissingTable(error, 'candidate_documents')
  )
}

export function isMissingJobAgentV4(error: { code?: string; message?: string }): boolean {
  return (
    isMissingTable(error, 'outreach_campaigns') ||
    isMissingTable(error, 'gmail_connections')
  )
}

export function isMissingCalendarTable(error: { code?: string; message?: string }): boolean {
  return isMissingTable(error, 'calendar_events')
}

export function isMissingCalendarV2(error: { code?: string; message?: string }): boolean {
  return (
    isMissingTable(error, 'calendar_connections') ||
    isMissingTable(error, 'calendar_todos')
  )
}

export function isMissingNewsletterTable(error: { code?: string; message?: string }): boolean {
  return (
    isMissingTable(error, 'newsletter_issues') ||
    isMissingTable(error, 'newsletter_settings')
  )
}

export function isMissingAssistantTable(error: { code?: string; message?: string }): boolean {
  return isMissingTable(error, 'assistant_messages')
}
