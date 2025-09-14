import type { MatchCandidate, Track } from '../types/models'
import { normalizeTitle, artistsKey } from '../utils/text'

export function metaHash(t: Track) {
  const base = [t.isrc ?? '', normalizeTitle(t.title), artistsKey(t.artists), t.durationMs ?? 0].join('|')
  let h = 5381; for (let i = 0; i < base.length; i++) h = ((h << 5) + h) + base.charCodeAt(i)
  return 'm' + (h >>> 0).toString(16)
}

export function scoreCandidate(source: Track, candidate: Track) {
  let score = 0
  if (source.isrc && candidate.isrc && source.isrc === candidate.isrc) return 1.0
  if (normalizeTitle(source.title) === normalizeTitle(candidate.title)) score += 0.45
  if (artistsKey(source.artists) === artistsKey(candidate.artists)) score += 0.35
  if (source.durationMs && candidate.durationMs) {
    const diff = Math.abs(source.durationMs - candidate.durationMs) / 1000
    if (diff <= 2) score += 0.15
    else if (diff <= 4) score += 0.08
  }
  if (source.album && candidate.album && source.album.toLowerCase() === candidate.album.toLowerCase()) score += 0.05
  return Math.min(score, 0.99)
}

export function useMatcher() {
  function pickBest(source: Track, candidates: Track[], threshold = 0.75): MatchCandidate | null {
    const scored = candidates.map(c => ({
      tidalTrackId: c.id,
      score: scoreCandidate(source, c),
      reason: c.isrc && source.isrc && c.isrc === source.isrc ? 'ISRC' : 'Heuristic'
    })).sort((a,b) => b.score - a.score)
    const top = scored[0]
    return top && top.score >= threshold ? top : null
  }
  return { pickBest, scoreCandidate, metaHash }
}
