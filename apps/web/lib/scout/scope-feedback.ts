import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScoutModuleId } from '@/lib/scout/skipped'

export type ScoutFeedbackAction = 'dismiss' | 'skip' | 'reject' | 'delete'

export interface ScoutFeedbackInput {
  moduleId: ScoutModuleId
  action: ScoutFeedbackAction
  title: string
  subtitle?: string | null
  itemUrl?: string | null
  skipCategory?: string | null
  feedback: string
}

const MAX_LEARNINGS_CHARS = 4000

export function formatScopeLearningLine(input: ScoutFeedbackInput): string {
  const label = input.subtitle ? `${input.subtitle} · ${input.title}` : input.title
  return `• ${label}: ${input.feedback.trim()}`
}

export function appendScopeLearning(existing: string, line: string): string {
  const base = existing.trim()
  const next = base ? `${base}\n${line}` : line
  if (next.length <= MAX_LEARNINGS_CHARS) return next
  const trimmed = next.slice(-MAX_LEARNINGS_CHARS)
  const firstBreak = trimmed.indexOf('\n')
  return firstBreak > 0 ? trimmed.slice(firstBreak + 1) : trimmed
}

export async function loadScopeLearnings(
  supabase: SupabaseClient,
  userId: string,
  moduleId: ScoutModuleId,
): Promise<string> {
  if (moduleId === 'funding-scout') {
    const { data } = await supabase
      .from('funding_scout_settings')
      .select('scope_learnings')
      .eq('user_id', userId)
      .maybeSingle()
    return String(data?.scope_learnings ?? '').trim()
  }

  const { data } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  const prefs = (data?.preferences ?? {}) as { scopeLearnings?: string }
  return String(prefs.scopeLearnings ?? '').trim()
}

async function persistScopeLearnings(
  supabase: SupabaseClient,
  userId: string,
  moduleId: ScoutModuleId,
  learnings: string,
): Promise<void> {
  if (moduleId === 'funding-scout') {
    await supabase.from('funding_scout_settings').upsert({
      user_id: userId,
      scope_learnings: learnings,
      updated_at: new Date().toISOString(),
    })
    return
  }

  const { data } = await supabase
    .from('job_search_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  const prefs = (data?.preferences ?? {}) as Record<string, unknown>
  await supabase.from('job_search_preferences').upsert({
    user_id: userId,
    preferences: { ...prefs, scopeLearnings: learnings },
    updated_at: new Date().toISOString(),
  })
}

export async function saveScoutScopeFeedback(
  supabase: SupabaseClient,
  userId: string,
  input: ScoutFeedbackInput,
): Promise<{ learningsUpdated: boolean }> {
  const feedback = input.feedback.trim()
  if (!feedback) return { learningsUpdated: false }

  const { error: insertError } = await supabase.from('scout_scope_feedback').insert({
    user_id: userId,
    module_id: input.moduleId,
    action: input.action,
    item_title: input.title,
    item_subtitle: input.subtitle ?? null,
    item_url: input.itemUrl ?? null,
    skip_category: input.skipCategory ?? null,
    feedback,
  })
  if (insertError) throw insertError

  const existing = await loadScopeLearnings(supabase, userId, input.moduleId)
  const next = appendScopeLearning(existing, formatScopeLearningLine(input))
  await persistScopeLearnings(supabase, userId, input.moduleId, next)
  return { learningsUpdated: true }
}

export function buildScopeLearningsPromptBlock(learnings: string): string {
  const trimmed = learnings.trim()
  if (!trimmed) return ''
  return `\nUser scope learnings (from past rejections — treat as hard preferences for future scouting):
${trimmed}`
}
