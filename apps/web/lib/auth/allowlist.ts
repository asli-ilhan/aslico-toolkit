/** Single-user allowlist — only this email may access the toolkit. */
export function getAllowedEmail(): string {
  const email =
    process.env.ALLOWED_EMAIL ??
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL ??
    ''
  return email.toLowerCase().trim()
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = getAllowedEmail()
  if (!allowed || !email) return false
  return email.toLowerCase().trim() === allowed
}

export function mapAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('rate limit')) {
    return 'Supabase e-posta limiti doldu. ~1 saat bekle veya passkey ile gir.'
  }
  if (message === 'unauthorized' || lower.includes('not authorized')) {
    return 'Bu toolkit yalnızca yetkili hesap için.'
  }
  if (message === 'auth_callback_failed') {
    return 'Giriş linki geçersiz veya süresi dolmuş. Yeni link iste.'
  }
  return message
}
