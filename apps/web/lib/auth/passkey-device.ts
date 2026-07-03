const STORAGE_PREFIX = 'aslico-platform-passkey:'

export function passkeyStorageKey(hostname = window.location.hostname): string {
  return `${STORAGE_PREFIX}${hostname}`
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function saveLocalPasskeyId(rawId: ArrayBuffer): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(passkeyStorageKey(), base64UrlEncode(rawId))
}

export function loadLocalPasskeyId(): ArrayBuffer | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(passkeyStorageKey())
  if (!stored) return null
  try {
    return base64UrlDecode(stored)
  } catch {
    return null
  }
}

export function clearLocalPasskeyId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(passkeyStorageKey())
}

/** Safari/WebKit loses the user-gesture after async fetch — Touch ID needs a second tap. */
export function needsTouchIdConfirmStep(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)
  const isIosWebKit =
    /iPhone|iPad|iPod/i.test(ua) && /WebKit/i.test(ua) && !/CriOS|FxiOS/i.test(ua)
  return isSafari || isIosWebKit
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  const fn = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  if (typeof fn !== 'function') return true
  try {
    return await fn.call(PublicKeyCredential)
  } catch {
    return false
  }
}
