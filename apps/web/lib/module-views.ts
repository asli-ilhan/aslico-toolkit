import type { ComponentType } from 'react'
import { TranscriptionView } from '@/components/modules/TranscriptionView'
import { JobAgentView } from '@/components/modules/job-agent/JobAgentView'
import { CalendarView } from '@/components/modules/CalendarView'
import { NewsletterView } from '@/components/modules/NewsletterView'
import { VoiceAssistantView } from '@/components/modules/VoiceAssistantView'
import { CultureTrackerView } from '@/components/modules/CultureTrackerView'
import { TravelScoutView } from '@/components/modules/TravelScoutView'
import { LanguageTutorView } from '@/components/modules/LanguageTutorView'
import { FundingScoutView } from '@/components/modules/FundingScoutView'
import { SelfTherapyView } from '@/components/modules/SelfTherapyView'

export const moduleViews: Record<string, ComponentType> = {
  transcription: TranscriptionView,
  'job-agent': JobAgentView,
  calendar: CalendarView,
  newsletter: NewsletterView,
  'voice-assistant': VoiceAssistantView,
  'culture-tracker': CultureTrackerView,
  'travel-scout': TravelScoutView,
  'language-tutor': LanguageTutorView,
  'funding-scout': FundingScoutView,
  'self-therapy': SelfTherapyView,
}

export function getModuleView(moduleId: string): ComponentType | undefined {
  return moduleViews[moduleId]
}
