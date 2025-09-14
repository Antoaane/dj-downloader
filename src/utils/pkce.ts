// src/utils/pkce.ts

/**
 * Encodage base64-url (sans padding) à partir d'octets
 */
export function base64url(bytes: Uint8Array): string {
  // OK vu la petite taille (≤ 64), sinon chunker
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/**
 * SHA-256 d'une chaîne UTF-8 → renvoie des octets
 */
export async function sha256Utf8(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input)         // Uint8Array
  const digest = await crypto.subtle.digest('SHA-256', data /* BufferSource */)
  return new Uint8Array(digest)                        // normalise en bytes
}

/**
 * Génère un verifier PKCE (43–128 chars autorisés) + challenge
 * - On part d'octets aléatoires puis on base64url
 */
export async function createPkcePair() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32)) // 32*8=256 bits
  const verifier = base64url(verifierBytes)                        // déjà url-safe
  const challenge = base64url(await sha256Utf8(verifier))
  return { verifier, challenge }
}
