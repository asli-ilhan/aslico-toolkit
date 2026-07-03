/** Passkeys are domain-bound (one RP ID in Supabase). Off by default — use magic link instead. */
export function isPasskeyAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSKEY_ENABLED === 'true'
}
