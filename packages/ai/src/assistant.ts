import { createClaudeMessage } from './claude'
import { JOB_APPLICATION_GUARDRAILS } from './profile-guard'

export interface ToolkitContext {
  locale: string
  pendingInbox?: number
  deadlines?: Array<{ title: string; at: string }>
  followUps?: Array<{ title: string; at: string }>
  todayEvents?: Array<{ title: string; at: string }>
  interests?: string[]
  latestNewsletterTitle?: string
}

export async function chatWithAssistant(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ToolkitContext,
): Promise<string> {
  const ctxLines: string[] = []
  if (context.pendingInbox != null && context.pendingInbox > 0) {
    ctxLines.push(`Job Agent inbox: ${context.pendingInbox} pack(s) pending review.`)
  }
  if (context.deadlines?.length) {
    ctxLines.push(
      `Upcoming deadlines: ${context.deadlines.map((d) => `${d.title} (${d.at})`).join('; ')}`,
    )
  }
  if (context.followUps?.length) {
    ctxLines.push(
      `Follow-ups due: ${context.followUps.map((d) => `${d.title} (${d.at})`).join('; ')}`,
    )
  }
  if (context.todayEvents?.length) {
    ctxLines.push(
      `Today's calendar: ${context.todayEvents.map((e) => `${e.title} (${e.at})`).join('; ')}`,
    )
  }
  if (context.interests?.length) {
    ctxLines.push(`User interests: ${context.interests.join(', ')}`)
  }
  if (context.latestNewsletterTitle) {
    ctxLines.push(`Latest newsletter: ${context.latestNewsletterTitle}`)
  }

  const system = `You are asliCo Toolkit voice assistant — warm, concise, practical.
Reply in ${context.locale === 'tr' ? 'Turkish' : context.locale === 'fr' ? 'French' : context.locale === 'es' ? 'Spanish' : context.locale === 'ar' ? 'Arabic' : 'English'} unless the user writes in another language.
You help with: job applications (Job Agent), calendar, daily newsletter/brief, transcription.
Keep answers short (2-4 sentences) unless the user asks for detail. No markdown headers.
When discussing job applications, CVs, or cover letters: ${JOB_APPLICATION_GUARDRAILS}
${ctxLines.length ? `\nCurrent user context:\n${ctxLines.join('\n')}` : ''}`

  const messages = [
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  return createClaudeMessage({ system, messages, maxTokens: 1024, temperature: 0.4 })
}
