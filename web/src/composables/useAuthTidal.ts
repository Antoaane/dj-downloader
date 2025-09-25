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
  (import.meta.env.DEV ? 'http://127.0.0.1:5178/connect-tidal' : location.origin + '/connect-tidal')

const CRED_KEY = 'tidal_user_credentials'

// ✅ scopes que ton app a déclarés côté TIDAL Dev Portal
const SCOPES = ['search.read', 'playlists.read', 'playlists.write']
const SCOPES_STR = SCOPES.join(' ')

// Essaie d'extraire { token, expiresIn } depuis les "Credentials" du SDK
function pickToken(creds: any): { token: string; expiresIn: number } | null {
  if (!creds) return null
  if (creds.accessToken?.token) {
    return { token: creds.accessToken.token, expiresIn: Number(creds.accessToken.expiresIn ?? 3600) }
  }
  if (typeof creds.token === 'string') {
    return { token: creds.token, expiresIn: Number(creds.expiresIn ?? 3600) }
  }
  if (typeof creds === 'string') {
    return { token: creds, expiresIn: 3600 }
  }
  return null
}

export function useAuthTidal() {
  const { setTidalToken } = useAppStore()

  /** Démarre le login (redirige vers TIDAL) */
  async function startLoginSdk() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    // 1) laisse le SDK construire l’URL avec code_challenge etc.
    const rawUrl = await initializeLogin({ redirectUri } as any)
    // 2) on force les paramètres problématiques
    const u = new URL(rawUrl)
    u.searchParams.set('scope', SCOPES_STR)  // <— le point clé
    // optionnel selon ta config app :
    u.searchParams.set('geo', 'FR')
    u.searchParams.set('campaignId', 'default')

    // debug
    console.log('[TIDAL] authorize URL final ->', u.toString())

    // 3) go
    window.location.href = u.toString()
  }

  /** À appeler sur /connect-tidal après retour (avec ?code=...) */
  async function finishLoginSdk() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    console.log('[TIDAL] finishLoginSdk: query =', window.location.search)

    await finalizeLogin(window.location.search)

    const creds = await credentialsProvider.getCredentials()
    console.log('[TIDAL] credentialsProvider.getCredentials() →', creds ? 'ok' : 'null')

    const picked = pickToken(creds)
    if (!picked) throw new Error('Credentials TIDAL invalides')

    setTidalToken(picked.token, picked.expiresIn)
    history.replaceState({}, '', location.pathname)
  }

  /**
   * 🔑 Fournit un token frais depuis le SDK (et met à jour le store).
   * À utiliser par les interceptors Axios (401, etc.).
   */
  async function getFreshToken(): Promise<string> {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    const creds = await credentialsProvider.getCredentials()
    const picked = pickToken(creds)
    if (!picked) throw new Error('Impossible de récupérer un token TIDAL')
    setTidalToken(picked.token, picked.expiresIn)
    return picked.token
  }

  /** Bootstrap au démarrage (si l’utilisateur était déjà loggé) */
  async function bootstrapTidalToken() {
    await init({ clientId, credentialsStorageKey: CRED_KEY })
    const creds = await credentialsProvider.getCredentials().catch(() => null)
    const picked = pickToken(creds)
    if (picked) setTidalToken(picked.token, picked.expiresIn)
  }

  async function signOut() {
    await logout()
  }

  return { startLoginSdk, finishLoginSdk, getFreshToken, bootstrapTidalToken, signOut }
}
