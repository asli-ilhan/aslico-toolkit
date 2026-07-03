import type { ToolkitModule } from '@aslico/core/module-sdk'

export const templateModule: ToolkitModule = {
  id: 'template',
  name: 'Template Module',
  description: 'Copy this package to create a new toolkit module.',
  icon: '🧩',
  version: '0.0.1',
  category: 'productivity',
  shellAccent: {
    primary: '#a78bfa',
    secondary: '#67e8f9',
    glow: '#c4b5fd',
    canvasMode: 'particles',
  },
}
