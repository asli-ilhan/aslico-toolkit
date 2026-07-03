export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>
}

export { createClaudeMessage, type ClaudeMessage } from './claude'
export { transcribeAudio, type TranscribeOptions } from './transcribe'
export { summarizeTranscript } from './summarize'
export { chatWithAssistant, type ToolkitContext } from './assistant'
export { generateNewsletterIssue, type NewsletterInput, type NewsletterSections } from './newsletter'
export {
  JOB_APPLICATION_GUARDRAILS,
  coerceToString,
  sanitizeApplicationText,
  sanitizeMasterProfile,
  profileNeedsAsherivSanitizeSave,
  profileForApplications,
} from './profile-guard'
export {
  buildMasterProfile,
  buildProfileVariants,
  scoreJobFit,
  generateApplicationPack,
  generateEmailDraft,
  generateColdOutreachEmail,
  selectOutreachContacts,
  type OutreachContactInput,
  generateCoverLetter,
  generateCvSuggestions,
  type JobAgentInput,
  type MasterProfileData,
  type EvidenceItem,
  type PackInput,
} from './job-agent'

export const aiEngine = {
  version: '0.2.0',
  status: 'beta' as const,
  llm: 'anthropic' as const,
  stt: 'deepgram' as const,
}
