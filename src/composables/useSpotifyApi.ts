import axios from 'axios'
import { useAppStore } from '../store/useAppStore'
import type { Playlist, Track } from '../types/models'

export function useSpotifyApi() {
  const { state } = useAppStore()
  const api = axios.create({ baseURL: 'https://api.spotify.com/v1' })

  api.interceptors.request.use(cfg => {
    cfg.headers = cfg.headers ?? {}
    cfg.headers.Authorization = `Bearer ${state.spotify.accessToken}`
    return cfg
  })

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

  async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
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
    return out
  }

  return { me, getPlaylists, getPlaylistTracks }
}
