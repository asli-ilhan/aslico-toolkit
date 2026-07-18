export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>
}

export { createClaudeMessage, type ClaudeMessage } from './claude'
export { transcribeAudio, transcribeAudioFromUrl, type TranscribeOptions } from './transcribe'
export { summarizeTranscript } from './summarize'
export { chatWithAssistant, type ToolkitContext } from './assistant'
export { generateNewsletterIssue, type NewsletterInput, type NewsletterSections } from './newsletter'
export { generateCultureScout, type CultureScoutSections, type CultureScoutInput } from './culture-tracker'
export { generateTravelScout, type TravelScoutSections, type TravelScoutInput } from './travel-scout'
export {
  generateDailyLesson,
  languageTutorChat,
  generateFlashcardsFromWords,
  generateWeeklyReport,
  parseErrorsFromFriendReply,
  parseGrammarMastery,
  gradeSpeakingWriting,
  type TutorLanguage,
  type ChatMode,
  type DailyLessonSections,
} from './language-tutor'
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
export {
  scoreFundingFit,
  scoreFundingFitBatch,
  evaluateFundingOpening,
  evaluateFundingOpeningsBatch,
  generateFundingPack,
  type FundingOppInput,
  type FundingSettingsInput,
  type FundingFitResult,
  type FundingProgramEvaluation,
} from './funding-scout'
export { FUNDING_SCOUT_SYSTEM_PROMPT, buildResearcherProfileBlock } from './funding-scout-prompts'
export {
  generateTherapyScript,
  type TherapyScriptInput,
  type TherapyScriptResult,
} from './self-therapy'
export { THERAPY_SCRIPT_EXAMPLES, type TherapyScriptExample } from './self-therapy-examples'
export { synthesizeSpeech, type SpeakOptions } from './elevenlabs-tts'

export const aiEngine = {
  version: '0.3.0',
  status: 'beta' as const,
  llm: 'anthropic' as const,
  stt: 'deepgram' as const,
  tts: 'elevenlabs' as const,
}
