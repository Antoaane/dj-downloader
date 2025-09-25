// src/composables/useTidalApi.ts
import axios from 'axios'
import { useAppStore } from '../store/useAppStore'
import { useAuthTidal } from './useAuthTidal'
import type { Track } from '../types/models'

const BASE_URL = 'https://openapi.tidal.com/v2'

export function useTidalApi() {
  const { state } = useAppStore()
  const { getFreshToken } = useAuthTidal()

  const api = axios.create({ baseURL: BASE_URL })

  // Injecte automatiquement le token + logs lisibles
  api.interceptors.request.use(async cfg => {
    let token = state.tidal.accessToken
    if (!token) token = await getFreshToken()

    cfg.headers = cfg.headers || {}
    ;(cfg.headers as any).Authorization = `Bearer ${token}`
    ;(cfg.headers as any).Accept = 'application/vnd.api+json'

    console.log('[TIDAL-FRONT][request]', {
      url: cfg.url,
      params: cfg.params,
      headers: { ...(cfg.headers as any), Authorization: 'Bearer …' }
    })
    return cfg
  })

  // ---- Helpers de parsing ----

  type IncludedMaps = {
    byKey: Map<string, any>
    artistsById: Map<string, string>       // id -> name
    albumsById: Map<string, string>        // id -> title
  }

  function buildIncludedMaps(included: any[] | undefined): IncludedMaps {
    const byKey = new Map<string, any>()
    const artistsById = new Map<string, string>()
    const albumsById = new Map<string, string>()

    if (Array.isArray(included)) {
      for (const n of included) {
        if (!n?.type || !n?.id) continue
        byKey.set(`${n.type}:${n.id}`, n)
        if (n.type === 'artists' && n?.attributes?.name) {
          artistsById.set(String(n.id), String(n.attributes.name))
        }
        if (n.type === 'albums' && n?.attributes?.title) {
          albumsById.set(String(n.id), String(n.attributes.title))
        }
      }
    }
    return { byKey, artistsById, albumsById }
  }

  // Convertit un nœud "track" TIDAL → Track (notre modèle)
  function mapTrack(node: any, maps?: IncludedMaps): Track {
    const a = node?.attributes ?? {}

    // duration peut être en secondes : la normaliser en ms
    let durationMs: number | undefined = a.duration
    if (typeof durationMs === 'number' && durationMs < 10_000) {
      durationMs = durationMs * 1000
    }

    // artistes : essayer attributes.artists, sinon relationships + included
    let artists: string[] = Array.isArray(a.artists)
      ? a.artists.map((x: any) => x?.name).filter(Boolean)
      : []

    if ((!artists || artists.length === 0) && maps) {
      const rel = node?.relationships?.artists?.data
      if (Array.isArray(rel)) {
        artists = rel
          .map((r: any) => maps.artistsById.get(String(r.id)))
          .filter(Boolean) as string[]
      }
    }

    // album
    let album: string | undefined = a.album?.title
    if (!album && maps) {
      const firstAlbumId = node?.relationships?.albums?.data?.[0]?.id
      if (firstAlbumId) album = maps.albumsById.get(String(firstAlbumId))
    }

    return {
      id: String(node?.id ?? ''),
      isrc: a.isrc ?? undefined,
      title: String(a.title ?? ''),
      artists,
      album,
      durationMs,
      explicit: typeof a.explicit === 'boolean' ? a.explicit : undefined
    }
  }

  // Extraction tolérante aux différentes variantes de réponse
  function extractTracks(payload: any): Track[] {
    if (!payload) return []

    const maps = buildIncludedMaps(payload?.included)

    // 1) data: [ {type:'tracks', attributes...}, ... ]
    if (Array.isArray(payload.data) && payload.data.length) {
      const looksLikeTracks = payload.data.every((x: any) => x?.attributes)
      if (looksLikeTracks) {
        return payload.data
          .filter((n: any) => (n?.type ?? 'tracks') === 'tracks' || n?.attributes)
          .map((n: any) => mapTrack(n, maps))
      }
    }

    // 2) included: [ {type:'tracks', ...} ]
    if (Array.isArray(payload.included) && payload.included.length) {
      const tracks = payload.included.filter((n: any) => n?.type === 'tracks')
      if (tracks.length) return tracks.map((n: any) => mapTrack(n, maps))
    }

    // 3) data.relationships.tracks.data (identifiants) + included (objets complets)
    const relIds: any[] = payload?.data?.relationships?.tracks?.data
    if (Array.isArray(relIds) && maps.byKey.size) {
      const full = relIds
        .map((r: any) => maps.byKey.get(`${r.type ?? 'tracks'}:${r.id}`))
        .filter(Boolean)
      if (full.length) return full.map((n: any) => mapTrack(n, maps))
    }

    // 4) data: { type:'tracks', ... } (objet unique)
    if (payload?.data?.type === 'tracks' && payload?.data?.attributes) {
      return [mapTrack(payload.data, maps)]
    }

    return []
  }

  /** Recherche par ISRC */
  async function searchByIsrc(isrc: string, countryCode = 'FR'): Promise<Track[]> {
    console.log('[TIDAL-FRONT] searchByIsrc called →', isrc)
    const url = `/searchResults/${encodeURIComponent(isrc)}`
    const r = await api.get(url, {
      params: {
        countryCode,
        include: 'tracks,artists,albums',
        explicitFilter: 'include,exclude'
      }
    })
    console.log('[TIDAL-FRONT] searchByIsrc response:', r.data)
    return extractTracks(r.data)
  }

  /** Recherche par mots-clés */
  async function searchByQuery(query: string, countryCode = 'FR'): Promise<Track[]> {
    console.log('[TIDAL-FRONT] searchByQuery called →', query)
    const url = `/searchResults/${encodeURIComponent(query)}`
    const r = await api.get(url, {
      params: {
        countryCode,
        include: 'tracks,artists,albums',
        explicitFilter: 'include,exclude'
      }
    })
    console.log('[TIDAL-FRONT] searchByQuery response:', r.data)
    return extractTracks(r.data)
  }

  return { searchByIsrc, searchByQuery }
}
