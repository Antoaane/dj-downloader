import type { MatchCandidate, Track } from '../types/models'
import { normalizeTitle, artistsKey } from '../utils/text'

// --- Normalisation utils ---
const asciiMap: Record<string, string> = { 'é':'e','è':'e','ê':'e','ë':'e','à':'a','â':'a','ä':'a','î':'i','ï':'i','ô':'o','ö':'o','ù':'u','û':'u','ü':'u','ç':'c' }
function toAscii(s: string) {
  return s.normalize('NFKD')
    .replace(/[^\w\s\-()&']/g, m => asciiMap[m] ?? '')
    .replace(/[\u0300-\u036f]/g, '')
}
function cleanTitle(raw: string) {
  let s = raw
  s = s.replace(/\s*[-–—]\s*(single|album)?\s*version.*$/i,'')
       .replace(/\s*\((feat\.?|with|remaster(ed)?( \d{2,4})?|live|radio edit|extended|instrumental|mono|stereo|acoustic|clean|dirty|sped up|slowed).*?\)\s*/gi,' ')
       .replace(/\s*\[(feat\.?|with|remaster.*?|live|radio edit|extended|instrumental|mono|stereo|acoustic|clean|dirty|sped up|slowed).*?\]\s*/gi,' ')
  s = s.replace(/\s*&\s*/g,' and ').replace(/\s{2,}/g,' ').trim()
  return toAscii(s).toLowerCase()
}
function cleanArtistList(artists: string[]) {
  return artists.map(a => toAscii(a).toLowerCase().replace(/\s*&\s*/g,' and ').trim())
}

// --- Similarité ---
function editDistance(a: string, b: string) {
  const dp = Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = (a[i - 1] === b[j - 1]) ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1)
      prev = tmp
    }
  }
  return dp[b.length]
}
function ratio(a: string, b: string) {
  if (!a || !b) return 0
  const d = editDistance(a, b)
  return 1 - d / Math.max(a.length, b.length)
}

// --- Scoring détaillé ---
type ScoreInfo = { score: number; titleSim: number; artistScore: number; durOk: boolean }
export function scoreCandidate(src: Track, cand: Track): ScoreInfo {
  const titleA = cleanTitle(src.title)
  const titleB = cleanTitle(cand.title)
  const artistsA = new Set(cleanArtistList(src.artists))
  const artistsB = new Set(cleanArtistList(cand.artists || []))

  const titleSim = ratio(titleA, titleB)
  const inter = [...artistsB].some(a => artistsA.has(a))
  const artistScore = inter ? 1 : 0
  const durA = src.durationMs ?? 0
  const durB = cand.durationMs ?? 0
  const durOk = durA && durB ? Math.abs(durA - durB) <= 5000 : false
  const explicitOk = (src.explicit === cand.explicit)

  let score = 0
  score += titleSim * 0.7
  score += artistScore * 0.25
  if (durOk) score += 0.05
  if (explicitOk) score += 0.02

  return { score, titleSim, artistScore, durOk }
}

// --- Best candidate (numérique) ---
export function pickBest(source: Track, candidates: Track[], threshold = 0.75): MatchCandidate | null {
  const scored = candidates.map(c => {
    const s = scoreCandidate(source, c)               // <- objet détaillé
    const reason = (c.isrc && source.isrc && c.isrc === source.isrc) ? 'ISRC' : 'fuzzy'
    return {
      tidalTrackId: (c as any).id ?? (c as any).tidalTrackId,
      score: s.score,                                  // <- on ne garde que le nombre pour MatchCandidate
      reason
    } satisfies MatchCandidate
  }).sort((a, b) => b.score - a.score)

  const top = scored[0]
  return top && top.score >= threshold ? top : null
}

// --- Cache key ---
export function metaHash(t: Track) {
  const base = [t.isrc ?? '', normalizeTitle(t.title), artistsKey(t.artists), String(t.durationMs ?? 0)].join('|')
  let h = 5381 >>> 0
  for (let i = 0; i < base.length; i++) {
    h = (((h << 5) + h) + base.charCodeAt(i)) >>> 0
  }
  return 'm' + h.toString(16)
}

// --- Hook ---
export function useMatcher() {
  return { pickBest, scoreCandidate, metaHash }
}
