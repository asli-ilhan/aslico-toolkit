export type RpDiagnosis = {
  hostname: string
  origin: string
  serverRpId: string | null
  matches: boolean
  fixMessage: string | null
}

function isRpIdValidForHost(rpId: string, hostname: string): boolean {
  const host = hostname.toLowerCase()
  const id = rpId.toLowerCase()
  if (host === id) return true
  if (host.endsWith(`.${id}`)) return true
  return false
}

export function diagnoseRpId(
  serverRpId: string | null | undefined,
  hostname: string,
  origin: string,
): RpDiagnosis {
  const rpId = serverRpId ?? null
  if (!rpId) {
    return {
      hostname,
      origin,
      serverRpId: null,
      matches: false,
      fixMessage:
        'Supabase passkey yanıtında RP ID yok. Dashboard → Authentication → Passkeys bölümünü aç.',
    }
  }

  const matches = isRpIdValidForHost(rpId, hostname)
  if (matches) {
    return { hostname, origin, serverRpId: rpId, matches: true, fixMessage: null }
  }

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const fixMessage = isLocal
    ? `Supabase şu an RP ID = "${rpId}" kullanıyor — local için "localhost" olmalı. Dashboard → Passkeys → RP ID: localhost, Origin: http://localhost:3000`
    : `Supabase RP ID = "${rpId}" ama site "${hostname}". Dashboard → Passkeys → RP ID: ${hostname}, Origin: ${origin}`

  return { hostname, origin, serverRpId: rpId, matches: false, fixMessage }
}

export function rpIdMismatchError(diagnosis: RpDiagnosis): Error {
  return new Error(diagnosis.fixMessage ?? 'RP ID uyuşmuyor')
}

export function checkCreationRpId(
  publicKey: PublicKeyCredentialCreationOptions,
  hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
): RpDiagnosis {
  return diagnoseRpId(publicKey.rp?.id ?? null, hostname, origin)
}
