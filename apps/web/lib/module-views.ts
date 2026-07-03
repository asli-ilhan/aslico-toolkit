import type { ComponentType } from 'react'
import { TranscriptionView } from '@/components/modules/TranscriptionView'
import { JobAgentView } from '@/components/modules/job-agent/JobAgentView'

export const moduleViews: Record<string, ComponentType> = {
  transcription: TranscriptionView,
  'job-agent': JobAgentView,
}

export function getModuleView(moduleId: string): ComponentType | undefined {
  return moduleViews[moduleId]
}
