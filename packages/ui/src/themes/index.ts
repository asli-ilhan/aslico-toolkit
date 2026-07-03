export interface ThemeTokens {
  id: string
  name: string
  colors: {
    background: string
    backgroundAlt: string
    surface: string
    surfaceBorder: string
    text: string
    textMuted: string
    accent: string
    accentSoft: string
    glow: string
  }
  canvas: {
    particle: string
    particleAlt: string
    background: string
  }
  motion: 'low' | 'medium' | 'high'
}

export const studioLight: ThemeTokens = {
  id: 'studio-light',
  name: 'Studio Light',
  colors: {
    background: '#ffffff',
    backgroundAlt: '#fafaf9',
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceBorder: 'rgba(249, 115, 22, 0.42)',
    text: '#1c1917',
    textMuted: '#78716c',
    accent: '#f97316',
    accentSoft: 'rgba(249, 115, 22, 0.12)',
    glow: '#fb923c',
  },
  canvas: {
    particle: '#fb923c',
    particleAlt: '#fdba74',
    background: '#ffffff',
  },
  motion: 'medium',
}

/** @deprecated alias — same as studioLight */
export const midnightGarden = studioLight

export const themes: Record<string, ThemeTokens> = {
  'studio-light': studioLight,
  'midnight-garden': studioLight,
}

export const defaultThemeId = 'studio-light'
