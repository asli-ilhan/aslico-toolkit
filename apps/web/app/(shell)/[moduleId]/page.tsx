import { notFound } from 'next/navigation'
import { ModulePageView } from '@/components/shell/ModulePageView'
import { getModuleById } from '@/lib/module-registry'

interface ModulePageProps {
  params: Promise<{ moduleId: string }>
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleId } = await params
  const mod = getModuleById(moduleId)

  if (!mod) {
    notFound()
  }

  return <ModulePageView moduleId={moduleId} />
}

export function generateStaticParams() {
  return [
    { moduleId: 'transcription' },
    { moduleId: 'doc-editor' },
    { moduleId: 'job-agent' },
    { moduleId: 'calendar' },
    { moduleId: 'voice-assistant' },
    { moduleId: 'newsletter' },
    { moduleId: 'culture-tracker' },
    { moduleId: 'travel-scout' },
    { moduleId: 'language-tutor' },
    { moduleId: 'funding-scout' },
  ]
}
