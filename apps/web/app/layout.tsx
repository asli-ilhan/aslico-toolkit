import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/shell/ThemeProvider'
import { LocaleProvider } from '@/components/shell/LocaleProvider'
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: "asliCo's Toolkit",
  description: 'Your personal AI-powered digital studio',
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LocaleProvider>
          <ThemeProvider>
            {children}
            <LanguageSwitcher />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
