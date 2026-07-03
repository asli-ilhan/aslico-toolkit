import type { ComponentType } from 'react'
import { TranscriptionView } from '@/components/modules/TranscriptionView'
import { JobAgentView } from '@/components/modules/job-agent/JobAgentView'
import { CalendarView } from '@/components/modules/CalendarView'
import { NewsletterView } from '@/components/modules/NewsletterView'
import { VoiceAssistantView } from '@/components/modules/VoiceAssistantView'

export const moduleViews: Record<string, ComponentType> = {
  transcription: TranscriptionView,
  'job-agent': JobAgentView,
  calendar: CalendarView,
  newsletter: NewsletterView,
  'voice-assistant': VoiceAssistantView,
}

export function getModuleView(moduleId: string): ComponentType | undefined {
  return moduleViews[moduleId]
}
