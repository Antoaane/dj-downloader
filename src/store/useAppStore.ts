import { reactive, computed, watch } from 'vue'
import type { LogEntry, Playlist } from '../types/models'

const LS_KEY = 'app_tokens_v1'

type PersistShape = {
  spotify?: { accessToken: string; expiresAt: number; refreshToken?: string; profileName?: string }
  tidal?:   { accessToken: string; expiresAt: number; profileName?: string }
}

function readPersist(): PersistShape {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function writePersist(p: PersistShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(p))
}

const persisted = readPersist()

const state = reactive({
  spotify: {
    accessToken: persisted.spotify?.accessToken || '',
    expiresAt:   persisted.spotify?.expiresAt   || 0,
    refreshToken: persisted.spotify?.refreshToken || '',
    profileName: persisted.spotify?.profileName || '',
    playlists: [] as Playlist[],
  },
  tidal: {
    accessToken: persisted.tidal?.accessToken || '',
    expiresAt:   persisted.tidal?.expiresAt   || 0,
    profileName: persisted.tidal?.profileName || '',
  },
  logs: [] as LogEntry[],
  options: {
    matchWindowSec: 3,
    threshold: 0.75,
    ignoreDuplicates: true,
    idempotent: true,
    tidalQuality: 'HiFi' as 'Normal'|'High'|'HiFi'|'Master',
    outputBase: 'C:/Users/antoi/Music/tests'
  },
  progress: { global: 0, currentName: '', perPlaylist: {} as Record<string, number> }
})

export function useAppStore() {
  function save() {
    writePersist({
      spotify: {
        accessToken: state.spotify.accessToken,
        expiresAt:   state.spotify.expiresAt,
        refreshToken: state.spotify.refreshToken || undefined,
        profileName: state.spotify.profileName || undefined
      },
      tidal: {
        accessToken: state.tidal.accessToken,
        expiresAt:   state.tidal.expiresAt,
        profileName: state.tidal.profileName || undefined
      }
    })
  }

  function setSpotifyToken(token: string, expiresInSec: number) {
    state.spotify.accessToken = token
    state.spotify.expiresAt   = Date.now() + (expiresInSec * 1000)
    save()
  }
  function setSpotifyRefreshToken(refresh?: string) {
    if (refresh) {
      state.spotify.refreshToken = refresh
      save()
    }
  }
  function clearSpotify() {
    state.spotify.accessToken = ''
    state.spotify.expiresAt = 0
    state.spotify.refreshToken = ''
    save()
  }

  function setTidalToken(token: string, expiresInSec: number) {
    state.tidal.accessToken = token
    state.tidal.expiresAt   = Date.now() + (expiresInSec * 1000)
    save()
  }
  function clearTidal() {
    state.tidal.accessToken = ''
    state.tidal.expiresAt = 0
    save()
  }

  function log(entry: Omit<LogEntry, 'ts'>) { state.logs.unshift({ ...entry, ts: Date.now() }) }

  const isSpotifyConnected = computed(() => !!state.spotify.accessToken && Date.now() < state.spotify.expiresAt)
  const isTidalConnected   = computed(() => !!state.tidal.accessToken   && Date.now() < state.tidal.expiresAt)

  // persiste auto si nom profil change
  watch(() => state.spotify.profileName, save)

  return {
    state,
    setSpotifyToken, setSpotifyRefreshToken, clearSpotify,
    setTidalToken, clearTidal,
    log, isSpotifyConnected, isTidalConnected
  }
}
