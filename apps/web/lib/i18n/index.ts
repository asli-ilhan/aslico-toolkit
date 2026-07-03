import type { Locale, Messages } from './types'
import { en } from './messages/en'
import { tr } from './messages/tr'
import { fr } from './messages/fr'
import { es } from './messages/es'
import { ar } from './messages/ar'

export type { Locale, Messages } from './types'
export { LOCALES, RTL_LOCALES } from './types'

export const messages: Record<Locale, Messages> = { en, tr, fr, es, ar }

export const DEFAULT_LOCALE: Locale = 'en'

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[DEFAULT_LOCALE]
}
