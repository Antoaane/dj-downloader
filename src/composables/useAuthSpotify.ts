import axios from 'axios'
import { createPkcePair } from '../utils/pkce'
import { useAppStore } from '../store/useAppStore'

const SPOTIFY_AUTH  = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token'

export function useAuthSpotify() {
  const { setSpotifyToken, setSpotifyRefreshToken, clearSpotify, state } = useAppStore()

  async function startLogin(clientId: string, redirectUri: string) {
    const { verifier, challenge } = await createPkcePair()
    sessionStorage.setItem('spotify_pkce_verifier', verifier)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'playlist-read-private user-library-read',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })
    location.href = `${SPOTIFY_AUTH}?${params.toString()}`
  }

  async function finishLogin(clientId: string, redirectUri: string) {
    const code = new URL(location.href).searchParams.get('code')
    const verifier = sessionStorage.getItem('spotify_pkce_verifier') || ''
    if (!code) return
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    })
    const { data } = await axios.post(SPOTIFY_TOKEN, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    setSpotifyToken(data.access_token, data.expires_in)
    setSpotifyRefreshToken(data.refresh_token) // peut être undefined (Spotify la renvoie en général)
    history.replaceState({}, '', location.pathname)
  }

  /** Force un refresh via refresh_token (si dispo) */
  async function refreshAccessToken(clientId: string) {
    const refresh = state.spotify.refreshToken
    if (!refresh) throw new Error('Pas de refresh_token Spotify')
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId,
    })
    const { data } = await axios.post(SPOTIFY_TOKEN, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    setSpotifyToken(data.access_token, data.expires_in ?? 3600)
    // Spotify peut renvoyer un nouveau refresh_token
    if (data.refresh_token) setSpotifyRefreshToken(data.refresh_token)
    return data.access_token as string
  }

  /** Assure un token valide (refresh si <=60s restants) */
  async function ensureSpotifySession(clientId: string) {
    const now = Date.now()
    const ttl = state.spotify.expiresAt - now
    if (!state.spotify.accessToken) return false
    if (ttl <= 60000) {
      try { await refreshAccessToken(clientId) } catch { clearSpotify(); return false }
    }
    return true
  }

  return { startLogin, finishLogin, refreshAccessToken, ensureSpotifySession }
}
