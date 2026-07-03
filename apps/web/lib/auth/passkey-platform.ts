import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadLocalPasskeyId,
  saveLocalPasskeyId,
} from '@/lib/auth/passkey-device'
import { checkCreationRpId, rpIdMismatchError } from '@/lib/auth/passkey-rp-check'

/** Touch ID / Face ID only — never QR, phone, or security key. */
const PLATFORM_ONLY_HINTS = ['client-device'] as string[]

const PLATFORM_CREATION_OVERRIDES = {
  hints: PLATFORM_ONLY_HINTS,
  authenticatorSelection: {
    authenticatorAttachment: 'platform' as const,
    residentKey: 'required' as const,
    requireResidentKey: true,
    userVerification: 'required' as const,
  },
}

const PLATFORM_REQUEST_OVERRIDES = {
  hints: PLATFORM_ONLY_HINTS,
  authenticatorAttachment: 'platform' as const,
  userVerification: 'required' as UserVerificationRequirement,
}

export type PreparedPasskeyRegistration = {
  challengeId: string
  publicKey: PublicKeyCredentialCreationOptions
}

export type PreparedPasskeyAuthentication = {
  challengeId: string
  publicKey: PublicKeyCredentialRequestOptions
}

function parseCreationOptions(
  serverOptions: Record<string, unknown>,
): PublicKeyCredentialCreationOptions {
  const PKC = PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: (json: unknown) => PublicKeyCredentialCreationOptions
  }
  if (typeof PKC.parseCreationOptionsFromJSON === 'function') {
    return PKC.parseCreationOptionsFromJSON(serverOptions)
  }
  throw new Error('Tarayıcı WebAuthn JSON parser desteklemiyor. Safari veya Chrome kullan.')
}

function parseRequestOptions(
  serverOptions: Record<string, unknown>,
): PublicKeyCredentialRequestOptions {
  const PKC = PublicKeyCredential as unknown as {
    parseRequestOptionsFromJSON?: (json: unknown) => PublicKeyCredentialRequestOptions
  }
  if (typeof PKC.parseRequestOptionsFromJSON === 'function') {
    return PKC.parseRequestOptionsFromJSON(serverOptions)
  }
  throw new Error('Tarayıcı WebAuthn JSON parser desteklemiyor. Safari veya Chrome kullan.')
}

function internalCredential(id: ArrayBuffer): PublicKeyCredentialDescriptor {
  return { id, type: 'public-key', transports: ['internal'] }
}

/** Safari needs allowCredentials with this device's ID — otherwise it shows a passkey picker. */
function withPlatformAllowCredentials(
  base: PublicKeyCredentialRequestOptions,
): PublicKeyCredentialRequestOptions {
  const localId = loadLocalPasskeyId()
  if (localId) {
    return {
      ...base,
      allowCredentials: [internalCredential(localId)],
    }
  }

  if (base.allowCredentials?.length) {
    return {
      ...base,
      allowCredentials: base.allowCredentials.map((cred) => ({
        ...cred,
        transports: ['internal'],
      })),
    }
  }

  return base
}

function mergeCreationOptions(
  base: PublicKeyCredentialCreationOptions,
): PublicKeyCredentialCreationOptions {
  return {
    ...base,
    authenticatorSelection: {
      ...base.authenticatorSelection,
      ...PLATFORM_CREATION_OVERRIDES.authenticatorSelection,
    },
    hints: PLATFORM_CREATION_OVERRIDES.hints,
  } as PublicKeyCredentialCreationOptions
}

function mergeRequestOptions(base: PublicKeyCredentialRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...withPlatformAllowCredentials(base),
    authenticatorAttachment: PLATFORM_REQUEST_OVERRIDES.authenticatorAttachment,
    userVerification: PLATFORM_REQUEST_OVERRIDES.userVerification,
    hints: PLATFORM_REQUEST_OVERRIDES.hints,
  } as PublicKeyCredentialRequestOptions
}

function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  if ('toJSON' in credential && typeof credential.toJSON === 'function') {
    return credential.toJSON() as Record<string, unknown>
  }
  throw new Error('Passkey serialize failed')
}

export function missingLocalPasskeyError(): Error {
  return new Error(
    'Bu cihazda parmak izi kaydı yok. Önce giriş yapıp /account/passkeys sayfasında Touch ID ekle.',
  )
}

export async function preparePasskeyRegistration(
  supabase: SupabaseClient,
): Promise<{ data: PreparedPasskeyRegistration | null; error: Error | null }> {
  const { data: options, error: startError } = await supabase.auth.passkey.startRegistration()
  if (startError) return { data: null, error: startError }
  if (!options?.options || !options.challenge_id) {
    return { data: null, error: new Error('Invalid registration options') }
  }

  const publicKey = mergeCreationOptions(
    parseCreationOptions(options.options as unknown as Record<string, unknown>),
  )

  const rpCheck = checkCreationRpId(publicKey)
  if (!rpCheck.matches) {
    return { data: null, error: rpIdMismatchError(rpCheck) }
  }

  return {
    data: {
      challengeId: options.challenge_id,
      publicKey,
    },
    error: null,
  }
}

export async function completePasskeyRegistration(
  supabase: SupabaseClient,
  prepared: PreparedPasskeyRegistration,
) {
  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({ publicKey: prepared.publicKey })
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error('Parmak izi kaydı iptal edildi') }
  }

  saveLocalPasskeyId(credential.rawId)

  return supabase.auth.passkey.verifyRegistration({
    challengeId: prepared.challengeId,
    credential: serializeCredential(credential) as never,
  })
}

export async function registerPlatformPasskey(supabase: SupabaseClient) {
  const { data: prepared, error: prepError } = await preparePasskeyRegistration(supabase)
  if (prepError || !prepared) return { data: null, error: prepError }
  return completePasskeyRegistration(supabase, prepared)
}

export async function preparePasskeyAuthentication(
  supabase: SupabaseClient,
): Promise<{ data: PreparedPasskeyAuthentication | null; error: Error | null }> {
  const { data: options, error: startError } = await supabase.auth.passkey.startAuthentication()
  if (startError) return { data: null, error: startError }
  if (!options?.options || !options.challenge_id) {
    return { data: null, error: new Error('Invalid authentication options') }
  }

  const publicKey = mergeRequestOptions(
    parseRequestOptions(options.options as unknown as Record<string, unknown>),
  )

  if (!publicKey.allowCredentials?.length) {
    return { data: null, error: missingLocalPasskeyError() }
  }

  return {
    data: { challengeId: options.challenge_id, publicKey },
    error: null,
  }
}

export async function completePasskeyAuthentication(
  supabase: SupabaseClient,
  prepared: PreparedPasskeyAuthentication,
) {
  let credential: Credential | null
  try {
    credential = await navigator.credentials.get({
      publicKey: prepared.publicKey,
      mediation: 'optional',
    })
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error('Parmak izi girişi iptal edildi') }
  }

  saveLocalPasskeyId(credential.rawId)

  return supabase.auth.passkey.verifyAuthentication({
    challengeId: prepared.challengeId,
    credential: serializeCredential(credential) as never,
  })
}

export async function signInWithPlatformPasskey(supabase: SupabaseClient) {
  const { data: prepared, error: prepError } = await preparePasskeyAuthentication(supabase)
  if (prepError || !prepared) return { data: null, error: prepError }
  return completePasskeyAuthentication(supabase, prepared)
}

/** Alias — Touch ID on Mac is a platform passkey under the hood. */
export const signInWithFingerprint = signInWithPlatformPasskey
