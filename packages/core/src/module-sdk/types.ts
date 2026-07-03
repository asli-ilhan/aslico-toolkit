export type ModuleCategory = 'productivity' | 'learning' | 'creative' | 'life'

export type CanvasMode = 'particles' | 'flow-field' | 'constellation' | 'minimal'

export interface ShellAccent {
  primary: string
  secondary: string
  glow: string
  canvasMode?: CanvasMode
}

export interface ModuleRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  handler: string
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: string
}

export interface CronJob {
  name: string
  schedule: string
  handler: string
}

export interface EventHandler<T extends string = string> {
  event: T
  handler: string
}

export interface ModuleContext {
  userId: string
  settings: Record<string, unknown>
}

export interface ToolkitModule {
  id: string
  name: string
  description: string
  icon: string
  version: string
  category: ModuleCategory
  routes?: ModuleRoute[]
  agentTools?: AgentTool[]
  cronJobs?: CronJob[]
  eventHandlers?: EventHandler[]
  shellAccent?: ShellAccent
  onInstall?: (ctx: ModuleContext) => Promise<void>
  onEnable?: (ctx: ModuleContext) => Promise<void>
}

export interface ModuleManifest {
  id: string
  name: string
  description: string
  icon: string
  category: ModuleCategory
  accent: ShellAccent
  status: 'active' | 'coming-soon' | 'beta'
  href: string
}
