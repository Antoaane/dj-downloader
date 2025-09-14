// src/composables/useTidalApi.ts
/**
 * Client TIDAL user-scoped (recherche + playlists)
 * - PAS d'import du SDK d'auth ici.
 * - On utilise axios + un interceptor 401 qui demande un token frais à useAuthTidal().
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { Playlist, Track } from '../types/models'
import { useAppStore } from '../store/useAppStore'
import { useAuthTidal } from './useAuthTidal'

const API_BASE = import.meta.env.VITE_TIDAL_API_BASE || 'https://api.tidal.com/v1'

export function useTidalApi() {
  const { state } = useAppStore()
  const { getFreshToken } = useAuthTidal()

  const api = axios.create({ baseURL: API_BASE })

  // Ajout du bearer à chaque requête
  api.interceptors.request.use((cfg) => {
    cfg.headers = cfg.headers ?? {}
    const token = state.tidal.accessToken
    if (token) (cfg.headers as Record<string, string>).Authorization = `Bearer ${token}`
    return cfg
  })

  // Si 401 → on tente 1 refresh via credentialsProvider du SDK (indirectement)
  api.interceptors.response.use(
    (r) => r,
    async (err: AxiosError) => {
      const res = err.response
      const original = err.config as (InternalAxiosRequestConfig & { __retry401?: boolean }) | undefined
      if (res?.status === 401 && original && !original.__retry401) {
        try {
          original.__retry401 = true
          const fresh = await getFreshToken() // met aussi le store à jour
          original.headers = original.headers ?? {}
          ;(original.headers as Record<string, string>).Authorization = `Bearer ${fresh}`
          return api(original)
        } catch (e) {
          // refresh impossible → on laisse tomber
        }
      }
      throw err
    }
  )

  // ---------- Fonctions métier ----------
  // NB: adapte les routes exactes selon la ref que tu utilises côté TIDAL.

  async function searchByIsrc(isrc: string): Promise<Track[]> {
    const r = await api.get(`/search/tracks`, { params: { isrc } })
    return (r.data?.items ?? []) as Track[]
  }

  async function searchByQuery(q: string): Promise<Track[]> {
    const r = await api.get(`/search/tracks`, { params: { q } })
    return (r.data?.items ?? []) as Track[]
  }

  async function getOrCreatePlaylist(name: string, description?: string): Promise<Playlist> {
    const found = await api.get(`/me/playlists`, { params: { q: name } }).catch(() => ({ data: { items: [] } }))
    const existing = (found.data?.items as Playlist[] | undefined)?.find(p => p.name === name)
    if (existing) return existing
    const r = await api.post(`/me/playlists`, { name, description })
    return r.data as Playlist
  }

  async function replacePlaylistTracks(playlistId: string, trackIds: string[]) {
    await api.put(`/playlists/${playlistId}/tracks`, { trackIds })
  }

  async function addPlaylistTracksChunked(playlistId: string, trackIds: string[], chunkSize = 100) {
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const chunk = trackIds.slice(i, i + chunkSize)
      await api.post(`/playlists/${playlistId}/tracks`, { trackIds: chunk })
    }
  }

  return {
    searchByIsrc,
    searchByQuery,
    getOrCreatePlaylist,
    replacePlaylistTracks,
    addPlaylistTracksChunked,
  }
}
