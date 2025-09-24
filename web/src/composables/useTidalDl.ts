// Construit les jobs tidal-dl à partir de ton état + des matches
export type TidalDlJob = {
  quality: 'Normal'|'High'|'HiFi'|'Master'
  output: string            // dossier où sauvegarder
  links: string[]           // URLs/IDs/filePath acceptés par -l (on met URLs)
  // Optionnel si tu veux que le backend lance réellement la commande:
  // run?: boolean
}

export function useTidalDl() {
  const ILLEGAL = /[<>:"/\\|?*\u0000-\u001F]/g
  const sanitize = (s: string) => s.replace(ILLEGAL, '_').trim()

  function defaultOutput(base: string, playlistName: string) {
    return `${base.replace(/[\\/]$/,'')}/${sanitize(playlistName)}`
  }

  function buildCommand({ quality, output, links }: TidalDlJob) {
    // une seule commande qui prend un filePath serait possible,
    // mais ici on illustre la forme simple: un lien = une commande.
    // Tu peux laisser le backend grouper par playlist.
    const q = quality
    const o = `"${output}"`
    return links.map(l => `tidal-dl -q ${q} -l "${l}" -o ${o}`)
  }

  return { sanitize, defaultOutput, buildCommand }
}
