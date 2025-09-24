import axios from 'axios'
import { useAppStore } from '../store/useAppStore'
import { useAuthSpotify } from './useAuthSpotify'
import type { Playlist, Track } from '../types/models'

export function useSpotifyApi() {
  const { state } = useAppStore()
  const { ensureSpotifySession, refreshAccessToken } = useAuthSpotify()
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''

  const api = axios.create({ baseURL: 'https://api.spotify.com/v1' })

  // Avant chaque requête, si le token expire dans <60s on refresh
  api.interceptors.request.use(async cfg => {
    await ensureSpotifySession(clientId).catch(() => {})
    cfg.headers = cfg.headers ?? {}
    cfg.headers.Authorization = `Bearer ${state.spotify.accessToken}`
    return cfg
  })

  // Si 401 -> tente un refresh une fois puis rejoue
  api.interceptors.response.use(
    r => r,
    async err => {
      const original: any = err.config
      if (err.response?.status === 401 && !original.__retried) {
        original.__retried = true
        try {
          await refreshAccessToken(clientId)
          original.headers = original.headers || {}
          original.headers.Authorization = `Bearer ${state.spotify.accessToken}`
          return api(original)
        } catch {/* fallthrough */}
      }
      throw err
    }
  )

  async function me() {
    const r = await api.get('/me')
    return r.data as { display_name: string }
  }

  async function getPlaylists(limit = 50): Promise<Playlist[]> {
    let url = `/me/playlists?limit=${limit}`
    const all: Playlist[] = []
    for (;;) {
      const r = await api.get(url)
      r.data.items.forEach((p: any) => {
        all.push({ id: p.id, name: p.name, description: p.description ?? '', total: p.tracks.total })
      })
      if (!r.data.next) break
      url = r.data.next
    }
    return all
  }

  async function getTrackById(id: string): Promise<Track | null> {
    try {
      const r = await api.get(`/tracks/${id}`)
      const t = r.data
      return {
        id: t.id,
        isrc: t.external_ids?.isrc,
        title: t.name,
        artists: t.artists?.map((a: any) => a.name) ?? [],
        album: t.album?.name,
        durationMs: t.duration_ms,
        explicit: t.explicit
      }
    } catch { return null }
  }

  async function getPlaylistTracks(playlistId: string, backfillIsrc = false): Promise<Track[]> {
    let url = `/playlists/${playlistId}/tracks?limit=100`
    const out: Track[] = []
    for (;;) {
      const r = await api.get(url)
      r.data.items.forEach((it: any) => {
        const t = it.track
        if (!t) return
        out.push({
          id: t.id,
          isrc: t.external_ids?.isrc,
          title: t.name,
          artists: t.artists?.map((a: any) => a.name) ?? [],
          album: t.album?.name,
          durationMs: t.duration_ms,
          explicit: t.explicit
        })
      })
      if (!r.data.next) break
      url = r.data.next
    }

    if (backfillIsrc) {
      for (let i = 0; i < out.length; i++) {
        if (!out[i].isrc) {
          const full = await getTrackById(out[i].id).catch(() => null)
          if (full?.isrc) out[i].isrc = full.isrc
        }
      }
    }
    return out
  }

  return { me, getPlaylists, getPlaylistTracks, getTrackById }
}
