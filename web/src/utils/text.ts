export function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, ' ')
    .replace(/\s*\[.*?\]/g, ' ')
    .replace(/\bfeat\.?\b/g, ' ')
    .replace(/\s*-\s*remaster(?:ed)?\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function artistsKey(artists: string[]) {
  return artists.map(a => a.toLowerCase().trim()).sort().join(' & ')
}
