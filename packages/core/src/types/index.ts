export type UserPreferences = {
  theme: {
    palette: string
    canvasMode: 'particles' | 'flow-field' | 'constellation' | 'minimal'
    motion: 'low' | 'medium' | 'high'
    accentModule?: string
  }
  interests: string[]
  newsletter: {
    time: string
    timezone: string
  }
  languages: Array<{ code: string; level: string }>
}

export type ModuleSettings = Record<string, unknown>
