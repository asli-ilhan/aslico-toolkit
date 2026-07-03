export interface AppConfig {
  appName: string
  appUrl: string
  nodeEnv: 'development' | 'production' | 'test'
}

export function getConfig(): AppConfig {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "asliCo's Toolkit",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  }
}
