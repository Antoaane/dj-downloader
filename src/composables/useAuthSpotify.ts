import axios from 'axios'
import { createPkcePair } from '../utils/pkce'
import { useAppStore } from '../store/useAppStore'

const SPOTIFY_AUTH = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token'

export function useAuthSpotify() {
  const { setSpotifyToken } = useAppStore()

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
    const res = await axios.post(SPOTIFY_TOKEN, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    setSpotifyToken(res.data.access_token, res.data.expires_in)
    history.replaceState({}, '', location.pathname)
  }

  return { startLogin, finishLogin }
}
