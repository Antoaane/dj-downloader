import { reactive, computed } from 'vue'
import type { LogEntry, Playlist } from '../types/models'

const state = reactive({
  spotify: { accessToken: '', expiresAt: 0, profileName: '', playlists: [] as Playlist[] },
  tidal:   { accessToken: '', expiresAt: 0, profileName: '' },
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
  function setSpotifyToken(token: string, expiresIn: number) {
    state.spotify.accessToken = token
    state.spotify.expiresAt = Date.now() + expiresIn * 1000
  }
  function setTidalToken(token: string, expiresIn: number) {
    state.tidal.accessToken = token
    state.tidal.expiresAt = Date.now() + expiresIn * 1000
  }
  function log(entry: Omit<LogEntry, 'ts'>) { state.logs.unshift({ ...entry, ts: Date.now() }) }
  const isSpotifyConnected = computed(() => !!state.spotify.accessToken && Date.now() < state.spotify.expiresAt)
  const isTidalConnected   = computed(() => !!state.tidal.accessToken   && Date.now() < state.tidal.expiresAt)
  return { state, setSpotifyToken, setTidalToken, log, isSpotifyConnected, isTidalConnected }
}
