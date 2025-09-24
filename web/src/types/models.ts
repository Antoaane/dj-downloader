export type Track = {
  id: string
  isrc?: string
  title: string
  artists: string[]
  album?: string
  durationMs?: number
  explicit?: boolean
}

export type Playlist = {
  id: string
  name: string
  description?: string
  total: number
}

export type MatchCandidate = {
  tidalTrackId: string
  score: number
  reason: string
}

export type LogEntry = {
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  ctx?: Record<string, unknown>
  ts: number
}
