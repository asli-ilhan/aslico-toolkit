import type { SupabaseClient } from '@supabase/supabase-js'

const PLATFORM_CREATION_OVERRIDES = {
  hints: ['client-device'] as string[],
  authenticatorSelection: {
    authenticatorAttachment: 'platform' as const,
    residentKey: 'required' as const,
    requireResidentKey: true,
    userVerification: 'required' as const,
  },
}

const PLATFORM_REQUEST_OVERRIDES = {
  hints: ['client-device'] as string[],
  userVerification: 'required' as UserVerificationRequirement,
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
    ...base,
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

export async function registerPlatformPasskey(supabase: SupabaseClient) {
  const { data: options, error: startError } = await supabase.auth.passkey.startRegistration()
  if (startError) return { data: null, error: startError }
  if (!options?.options || !options.challenge_id) {
    return { data: null, error: new Error('Invalid registration options') }
  }

  const publicKey = mergeCreationOptions(
    parseCreationOptions(options.options as unknown as Record<string, unknown>),
  )

  const credential = await navigator.credentials.create({ publicKey })
  if (!credential || !(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error('Passkey kaydı iptal edildi') }
  }

  return supabase.auth.passkey.verifyRegistration({
    challengeId: options.challenge_id,
    credential: serializeCredential(credential) as never,
  })
}

export async function signInWithPlatformPasskey(supabase: SupabaseClient) {
  const { data: options, error: startError } = await supabase.auth.passkey.startAuthentication()
  if (startError) return { data: null, error: startError }
  if (!options?.options || !options.challenge_id) {
    return { data: null, error: new Error('Invalid authentication options') }
  }

  // Sign-in: do not restrict to platform-only — finds Touch ID passkeys already on this Mac.
  // Platform-only hints break logins when an older cross-device passkey was registered.
  const publicKey = parseRequestOptions(options.options as unknown as Record<string, unknown>)

  const credential = await navigator.credentials.get({
    publicKey: {
      ...publicKey,
      userVerification: 'required',
    },
    mediation: 'optional',
  })

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    return { data: null, error: new Error('Parmak izi girişi iptal edildi') }
  }

  return supabase.auth.passkey.verifyAuthentication({
    challengeId: options.challenge_id,
    credential: serializeCredential(credential) as never,
  })
}

/** Alias — Touch ID on Mac is a platform passkey under the hood. */
export const signInWithFingerprint = signInWithPlatformPasskey
