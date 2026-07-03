import { createClaudeMessage } from './claude'

function localeHint(locale: string): string {
  if (locale === 'tr') return 'Respond in Turkish.'
  if (locale === 'fr') return 'Respond in French.'
  if (locale === 'es') return 'Respond in Spanish.'
  if (locale === 'ar') return 'Respond in Arabic.'
  return 'Respond in English.'
}

export async function summarizeTranscript(
  transcript: string,
  locale = 'en',
): Promise<string> {
  return createClaudeMessage({
    system: `You summarize meeting and voice-note transcripts. ${localeHint(locale)} Provide: 1) a short summary (2-3 sentences), 2) key points as bullets, 3) action items if any. Keep it concise.`,
    messages: [{ role: 'user', content: transcript.slice(0, 120000) }],
    maxTokens: 2048,
    temperature: 0.3,
  })
}
