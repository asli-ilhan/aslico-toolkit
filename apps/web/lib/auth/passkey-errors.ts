import type { AuthError } from '@supabase/supabase-js'

type ErrorWithCause = {
  message?: string
  code?: string
  name?: string
  cause?: ErrorWithCause
}

export function formatPasskeyError(err: unknown): string {
  if (!err) return 'Passkey kaydı başarısız.'

  const e = err as ErrorWithCause

  // Supabase API errors
  if (typeof e.message === 'string') {
    if (e.message.includes('passkey_disabled')) {
      return 'Supabase Dashboard → Authentication → Passkeys → Enable açık olmalı.'
    }
    if (e.message.includes('webauthn_verification_failed')) {
      return 'WebAuthn doğrulaması başarısız. RP ID ve Origins ayarlarını kontrol et.'
    }
    if (e.message.includes('ERROR_INVALID_RP_ID') || e.message.includes('invalid for this domain')) {
      return `RP ID uyuşmuyor. Supabase'de Relying Party ID = "${window.location.hostname}" olmalı (şu an: ${window.location.hostname}).`
    }
  }

  // Dig into WebAuthn cause chain
  const cause = e.cause ?? e
  const causeName = cause?.name ?? ''
  const causeMessage = cause?.message ?? ''

  if (causeName === 'SecurityError' || causeMessage.includes('relying party')) {
    return `Güvenlik hatası: Supabase Passkeys ayarında RP ID = "${window.location.hostname}" ve Origin = "${window.location.origin}" olmalı. 127.0.0.1 yerine localhost kullan.`
  }

  if (causeName === 'NotAllowedError') {
    return 'Touch ID / Face ID iptal edildi veya zaman aşımı. Tekrar dene.'
  }

  if (
    causeMessage.toLowerCase().includes('timed out') ||
    e.message?.toLowerCase().includes('timed out') ||
    causeMessage.toLowerCase().includes('cursor browser') ||
    e.message?.toLowerCase().includes('cursor browser')
  ) {
    if (isLikelyEmbeddedBrowser()) {
      return embeddedBrowserPasskeyMessage()
    }
    return 'WebAuthn zaman aşımı. Touch ID penceresi görünmediyse Safari veya Chrome kullan.'
  }

  if (causeName === 'InvalidStateError') {
    return 'Bu passkey zaten kayıtlı. Listede görünmüyorsa sayfayı yenile.'
  }

  if (causeMessage) {
    return causeMessage
  }

  if (e.message && e.message !== 'a Non-Webauthn related error has occurred') {
    return e.message
  }

  return `Passkey hatası (${causeName || 'bilinmiyor'}). Supabase → Passkeys: RP ID "${window.location.hostname}", Origin "${window.location.origin}".`
}

export function formatAuthApiError(err: AuthError | null): string {
  if (!err) return 'Bilinmeyen hata'
  return formatPasskeyError(err)
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

/** Electron / Cursor Simple Browser — platform passkeys (Touch ID) usually fail here. */
export function isLikelyEmbeddedBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('electron') || ua.includes('cursor') || ua.includes('vscode')
}

export function embeddedBrowserPasskeyMessage(): string {
  return 'Touch ID / parmak izi Cursor’un dahili tarayıcısında çalışmaz. Safari’de http://localhost:3000/login adresini aç.'
}
