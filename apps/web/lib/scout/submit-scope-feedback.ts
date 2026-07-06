import type { ScoutFeedbackAction } from '@/lib/scout/scope-feedback'
import type { ScoutModuleId } from '@/lib/scout/skipped'

export async function submitScoutScopeFeedback(input: {
  moduleId: ScoutModuleId
  action: ScoutFeedbackAction
  title: string
  subtitle?: string | null
  itemUrl?: string | null
  skipCategory?: string | null
  feedback: string
}): Promise<boolean> {
  const feedback = input.feedback.trim()
  if (!feedback) return false

  const res = await fetch('/api/modules/scout-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.ok
}
