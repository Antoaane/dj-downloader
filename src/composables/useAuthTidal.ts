// src/composables/useAuthTidal.ts
import { useAppStore } from '../store/useAppStore'
import {
  init,
  initializeLogin,
  finalizeLogin,
  credentialsProvider,
  logout,
} from '@tidal-music/auth'

const clientId = import.meta.env.VITE_TIDAL_CLIENT_ID ?? ''
const redirectUri =
  import.meta.env.VITE_TIDAL_REDIRECT ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:5173/connect-tidal'
    : location.origin + '/connect-tidal')

// clé locale pour le stockage sécurisé du SDK
const CRED_KEY = 'tidal_user_credentials'

/** essaie d'extraire (token, expiresIn) depuis le format Credentials du SDK */
function pickToken(creds: any): { token: string; expiresIn: number } | null {
  if (!creds) return null
  // cas 1: { token, expiresIn }
  if (typeof creds.token === 'string' && typeof creds.expiresIn === 'number') {
    return { token: creds.token, expiresIn: creds.expiresIn }
  }
  // cas 2: { accessToken: { token, expiresIn } }
  if (creds.accessToken && typeof creds.accessToken.token === 'string') {
    return {
      token: creds.accessToken.token,
      expiresIn: Number(creds.accessToken.expiresIn ?? 3600),
    }
  }
  // cas 3: token direct (string)
  if (typeof creds === 'string') {
    return { token: creds, expiresIn: 3600 }
  }
  return null
}

export function useAuthTidal() {
  const { setTidalToken } = useAppStore()

  /** Débute le login (PKCE) : redirige vers TIDAL */
  async function startLoginSdk() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    const loginUrl = await initializeLogin({ redirectUri }) // <- string
    window.location.href = loginUrl
  }

  /** À appeler sur /connect-tidal après retour de TIDAL (query ?code=...) */
  async function finishLoginSdk() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    await finalizeLogin(window.location.search) // passe TOUTE la query
    const creds = await credentialsProvider.getCredentials()
    const picked = pickToken(creds)
    if (picked) {
      setTidalToken(picked.token, picked.expiresIn)
      history.replaceState({}, '', location.pathname) // clean URL
    } else {
      throw new Error('Impossible de lire le token depuis credentialsProvider')
    }
  }

  /** Récupère un token frais depuis le provider (refresh géré en interne) */
  async function getFreshToken() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    const creds = await credentialsProvider.getCredentials()
    const picked = pickToken(creds)
    if (!picked) throw new Error('Credentials invalides')
    setTidalToken(picked.token, picked.expiresIn)
    return picked.token
  }

  async function signOut() {
    await logout()
  }

  // mode DEV: tu colles un token à la main
  async function setManualToken(token: string, expiresInSec = 3600) {
    setTidalToken(token, expiresInSec)
  }

  return { startLoginSdk, finishLoginSdk, getFreshToken, signOut, setManualToken }
}
