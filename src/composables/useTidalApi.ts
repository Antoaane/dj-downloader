// src/composables/useTidalApi.ts
// TIDAL OpenAPI v2 — debug heavy logs

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { Playlist, Track } from '../types/models'
import { useAppStore } from '../store/useAppStore'
import { useAuthTidal } from './useAuthTidal'

// ----------- Debug helpers -----------
const DEBUG = (import.meta.env.VITE_TIDAL_DEBUG ?? '1') !== '0' // active par défaut
const tag = (m: string) => `[TIDAL] ${m}`
const obf = (s?: string) => (s ? s.slice(0, 6) + '…' + s.slice(-4) : '')

// normalise la base pour garantir /v2
function normalizeBase(b?: string) {
  const base = (b || 'https://openapi.tidal.com').replace(/\/+$/,'')
  if (/\/v\d+$/.test(base)) return base // déjà /v1 ou /v2
  return base + '/v2'
}

// ----------- ENV / BASE -----------
const API_BASE = normalizeBase(import.meta.env.VITE_TIDAL_API_BASE as string | undefined)
const CLIENT_ID = (import.meta.env.VITE_TIDAL_CLIENT_ID || '').trim()
const DEFAULT_COUNTRY = (import.meta.env.VITE_TIDAL_COUNTRY || 'FR').trim()

if (DEBUG) {
  console.log(tag('boot'), {
    API_BASE,
    CLIENT_ID_present: !!CLIENT_ID,
    DEFAULT_COUNTRY,
    env_base_raw: import.meta.env.VITE_TIDAL_API_BASE
  })
}

// ----------- Mapping robuste -----------
function mapTracksPayload(payload: any): Track[] {
  if (DEBUG) console.log(tag('mapTracksPayload: raw keys'), payload && Object.keys(payload))
  if (!payload) return []
  const items =
    payload.items ||
    payload?.data?.items ||
    payload?.tracks?.items ||
    payload?.data?.tracks?.items ||
    []
  const mapped = (items as any[]).map((x: any) => ({
    id: x.id,
    isrc: x.isrc ?? x.externalIds?.isrc,
    title: x.title,
    artists: (x.artists || x.artist?.items || []).map((a: any) => a.name),
    album: x.album?.title ?? x.album?.name,
    durationMs: x.durationMs ?? x.duration ?? 0,
    explicit: !!(x.explicit ?? x.content?.explicit),
  }))
  if (DEBUG) console.log(tag(`mapTracksPayload: mapped ${mapped.length} items`))
  return mapped
}

// pour typer nos flags internes d’interceptor
type ExtConfig = InternalAxiosRequestConfig & { __retry401?: boolean; __ts?: number }

export function useTidalApi() {
  const { state } = useAppStore()
  const { getFreshToken } = useAuthTidal()

  const api = axios.create({ baseURL: API_BASE })

  // ---- Request interceptor
  api.interceptors.request.use((cfg) => {
    const c = cfg as ExtConfig
    c.headers = c.headers ?? {}
    const token = state.tidal.accessToken
    if (token) (c.headers as Record<string, string>).Authorization = `Bearer ${token}`
    if (CLIENT_ID) (c.headers as Record<string, string>)['Client-Id'] = CLIENT_ID
    c.__ts = Date.now()

    if (DEBUG) {
      const url = `${c.baseURL || ''}${c.url || ''}`
      console.log(tag('REQ →'), {
        method: (c.method || 'get').toUpperCase(),
        url,
        params: c.params,
        hasAuth: !!token,
        authPreview: obf(token),
        clientIdSet: !!CLIENT_ID
      })
    }
    return c
  })

  // ---- Response interceptor
  api.interceptors.response.use(
    (r) => {
      if (DEBUG) {
        const cfg = r.config as ExtConfig
        const dur = cfg.__ts ? `${Date.now() - cfg.__ts}ms` : 'n/a'
        const url = `${cfg.baseURL || ''}${cfg.url || ''}`
        console.log(tag('RES ✓'), { status: r.status, url, duration: dur, keys: r.data && Object.keys(r.data) })
      }
      return r
    },
    async (err: AxiosError) => {
      const res = err.response
      const cfg = err.config as ExtConfig | undefined
      const url = cfg ? `${cfg.baseURL || ''}${cfg.url || ''}` : 'n/a'
      if (DEBUG) {
        console.error(tag('RES ✗'), {
          status: res?.status,
          url,
          params: cfg?.params,
          data: res?.data || err.message
        })
      }

      // 401 → on tente 1 refresh
      if (res?.status === 401 && cfg && !cfg.__retry401) {
        try {
          cfg.__retry401 = true
          const fresh = await getFreshToken()
          cfg.headers = cfg.headers ?? {}
          ;(cfg.headers as Record<string, string>).Authorization = `Bearer ${fresh}`
          if (CLIENT_ID) (cfg.headers as Record<string, string>)['Client-Id'] = CLIENT_ID
          if (DEBUG) console.log(tag('retry with fresh token'), { url, authPreview: obf(fresh) })
          return api(cfg)
        } catch (e) {
          if (DEBUG) console.error(tag('refresh failed'), e)
        }
      }
      throw err
    }
  )

  // ---- Utilities: log + small helpers
  function logCall(name: string, params: Record<string, any>) {
    if (DEBUG) console.log(tag(`${name}()`), params)
  }

  // ----------------- Endpoints v2 -----------------

  /** Suggestions (UI) */
  async function searchSuggestions(query: string, countryCode = DEFAULT_COUNTRY) {
    logCall('searchSuggestions', { query, countryCode })
    const r = await api.get('/searchSuggestions', { params: { query, countryCode, limit: 10 } })
    return r.data
  }

  /** Résultats de recherche (types=TRACKS) */
  async function searchResultsTracks(query: string, countryCode = DEFAULT_COUNTRY): Promise<Track[]> {
    logCall('searchResultsTracks', { query, countryCode })
    try {
      const r = await api.get('/searchResults', {
        params: { query, types: 'TRACKS', countryCode, limit: 50 },
      })
      return mapTracksPayload(r.data)
    } catch (e: any) {
      // si v2 diffère (ex: /search/results), on tente un alias
      if (e?.response?.status === 404) {
        console.warn(tag('searchResults 404, try /search (legacy)')), console.warn(e?.response?.data)
        const r2 = await api.get('/search', {
          params: { query, types: 'TRACKS', countryCode, limit: 50 },
        })
        return mapTracksPayload(r2.data)
      }
      throw e
    }
  }

  /** Tracks par ISRC */
  async function getTracksByIsrc(isrc: string, countryCode = DEFAULT_COUNTRY): Promise<Track[]> {
    logCall('getTracksByIsrc', { isrc, countryCode })
    try {
      const r = await api.get('/tracks', { params: { isrc, countryCode, limit: 50 } })
      return mapTracksPayload(r.data)
    } catch (e: any) {
      if (e?.response?.status === 404) {
        console.warn(tag('tracks?isrc 404, fallback searchResults isrc:')), console.warn(e?.response?.data)
      }
      const r2 = await api.get('/searchResults', {
        params: { query: `isrc:${isrc}`, types: 'TRACKS', countryCode, limit: 50 },
      })
      return mapTracksPayload(r2.data)
    }
  }

  /** Track par ID */
  async function getTrackById(id: string, countryCode = DEFAULT_COUNTRY): Promise<Track | null> {
    logCall('getTrackById', { id, countryCode })
    try {
      const r = await api.get(`/tracks/${id}`, { params: { countryCode } })
      const arr = mapTracksPayload(r.data)
      return arr[0] ?? null
    } catch (e: any) {
      if (DEBUG) console.error(tag('getTrackById failed'), e?.response?.status, e?.response?.data || e)
      return null
    }
  }

  /** Legacy /search (si /searchResults indispo) */
  async function searchLegacy(query: string, countryCode = DEFAULT_COUNTRY): Promise<Track[]> {
    logCall('searchLegacy', { query, countryCode })
    const r = await api.get('/search', {
      params: { query, types: 'TRACKS', countryCode, limit: 50 },
    })
    return mapTracksPayload(r.data)
  }

  // ----------------- API publique (utilisée par le Dashboard) -----------------

  async function searchByIsrc(isrc: string, countryCode = DEFAULT_COUNTRY) {
    return getTracksByIsrc(isrc, countryCode)
  }

  async function searchByQuery(query: string, countryCode = DEFAULT_COUNTRY) {
    try {
      return await searchResultsTracks(query, countryCode)
    } catch (e: any) {
      if (DEBUG) console.warn(tag('searchByQuery → fallback legacy'), e?.response?.status)
      return await searchLegacy(query, countryCode)
    }
  }

  async function searchSmart(src: Track, opts?: { country?: string }) {
    const countryCode = opts?.country || DEFAULT_COUNTRY
    logCall('searchSmart', { title: src.title, artists: src.artists, isrc: src.isrc, countryCode })

    if (src.isrc) {
      try {
        const byIsrc = await getTracksByIsrc(src.isrc, countryCode)
        if (byIsrc.length) return byIsrc
      } catch (e) {
        if (DEBUG) console.warn(tag('searchSmart isrc failed'), e)
      }
    }

    const title = src.title
    const artists = src.artists.join(' ')
    const cleaned = title
      .replace(/\s*[-–—]\s*(single|album)?\s*version.*$/i, '')
      .replace(/\s*\((feat\.?|with|remaster(ed)?( \d{2,4})?|live|radio edit|extended|instrumental|mono|stereo|acoustic|clean|dirty|sped up|slowed).*?\)\s*/gi, ' ')
      .replace(/\s*\[(feat\.?|with|remaster.*?|live|radio edit|extended|instrumental|mono|stereo|acoustic|clean|dirty|sped up|slowed).*?\]\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    const tries = [
      `${title} ${artists}`,
      `${cleaned} ${artists}`,
      `${title}`,
      `${artists}`,
    ]

    for (const q of tries) {
      try {
        const r = await searchResultsTracks(q, countryCode)
        if (r.length) { if (DEBUG) console.log(tag('searchSmart hit'), { q, count: r.length }); return r }
      } catch (e) {
        if (DEBUG) console.warn(tag('searchResults error, try legacy'), e)
        const r2 = await searchLegacy(q, countryCode).catch(() => [])
        if (r2.length) { if (DEBUG) console.log(tag('searchSmart legacy hit'), { q, count: r2.length }); return r2 }
      }
    }
    if (DEBUG) console.warn(tag('searchSmart no results'))
    return []
  }

  // (Playlists — inutiles pour ton flux “tidal-dl”, mais je garde)
  async function getOrCreatePlaylist(name: string, description?: string): Promise<Playlist> {
    console.warn(tag('getOrCreatePlaylist is not guaranteed on OpenAPI v2'))
    const r = await api.post('/me/playlists', { name, description })
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
    searchSuggestions,
    searchByQuery,
    searchByIsrc,
    searchSmart,
    getTrackById,
    getOrCreatePlaylist,
    replacePlaylistTracks,
    addPlaylistTracksChunked,
  }
}
