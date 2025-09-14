<script setup lang="ts">
import { ref } from 'vue'
import PlaylistList from '../components/PlaylistList.vue'
import MatchOptions from '../components/MatchOptions.vue'
import ConsoleLog from '../components/ConsoleLog.vue'
import ProgressBar from '../components/ProgressBar.vue'
import { useAppStore } from '../store/useAppStore'
import { useSpotifyApi } from '../composables/useSpotifyApi'
import { useTidalApi } from '../composables/useTidalApi'
import { useMatcher } from '../composables/useMatcher'
import { useCache } from '../composables/useCache'
import { useTidalDl, type TidalDlJob } from '../composables/useTidalDl'
import type { Playlist, Track } from '../types/models'

const { state, log } = useAppStore()
const { getPlaylists, getPlaylistTracks } = useSpotifyApi()
const tidal = useTidalApi()
const { pickBest, metaHash } = useMatcher()
const cache = useCache()
const { defaultOutput } = useTidalDl()

const loading = ref(false)
const playlists = ref<Playlist[]>([])
const selected = ref<string[]>([])

async function loadPlaylists() { /* inchangé */ }
async function dryRun() { /* inchangé */ }

/** fabrique les jobs tidal-dl à partir des playlists sélectionnées */
async function buildJobs(): Promise<TidalDlJob[]> {
  const chosen = playlists.value.filter(p => selected.value.includes(p.id))
  if (chosen.length === 0) {
    log({ level:'warn', message:'Sélectionne au moins une playlist.' })
    return []
  }

  const jobs: TidalDlJob[] = []
  for (const p of chosen) {
    log({ level:'info', message:`Préparation des liens pour: ${p.name}` })

    const srcTracks = await getPlaylistTracks(p.id)
    const links: string[] = []

    for (const t of srcTracks) {
      const h = metaHash(t)
      let bestId = await cache.getMap(h)
      if (!bestId) {
        let candidates: Track[] = []
        if (t.isrc) candidates = await tidal.searchByIsrc(t.isrc).catch(()=>[])
        if (candidates.length === 0) {
          const q = `${t.title} ${t.artists.join(' ')}`
          candidates = await tidal.searchByQuery(q).catch(()=>[])
        }
        const best = pickBest(t, candidates, state.options.threshold)
        bestId = best?.tidalTrackId
        if (bestId) await cache.setMap(h, bestId)
      }

      if (bestId) {
        // URL TIDAL “track” standard ; adapte si tu préfères l’ID direct
        links.push(`https://tidal.com/browse/track/${bestId}`)
      } else {
        log({ level:'warn', message:`Non trouvé: ${t.title} – ${t.artists.join(', ')}` })
      }
    }

    if (links.length) {
      jobs.push({
        quality: state.options.tidalQuality,
        output: defaultOutput(state.options.outputBase, p.name),
        links
      })
      log({ level:'success', message:`${p.name}: ${links.length} liens prêts.` })
    } else {
      log({ level:'warn', message:`${p.name}: 0 lien valide.` })
    }
  }
  return jobs
}

/** envoie la liste de jobs au backend */
async function sendCommands() {
  if (!state.tidal.accessToken) return log({ level:'warn', message:'Connecte TIDAL d’abord.' })

  try {
    const jobs = await buildJobs()
    if (!jobs.length) return

    const res = await fetch(import.meta.env.VITE_BACKEND_URL + '/tidal/jobs', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ jobs })
    })
    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText)
      throw new Error(txt)
    }
    const data = await res.json()
    log({ level:'success', message:`Jobs envoyés: ${data.accepted ?? jobs.length}` })
  } catch (e:any) {
    log({ level:'error', message:`Envoi backend échoué: ${e.message ?? e}` })
  }
}
</script>

<template>
  <div class="grid lg:grid-cols-3 gap-4">
    <section class="lg:col-span-2 space-y-4">
      <div class="flex items-center gap-2">
        <button class="btn btn-outline" :disabled="loading" @click="loadPlaylists">
          {{ loading ? 'Chargement...' : 'Charger mes playlists Spotify' }}
        </button>
        <button class="btn" @click="dryRun">Dry-run</button>
        <button class="btn btn-primary" @click="sendCommands">Générer & envoyer commandes</button>
      </div>

      <ProgressBar :value="state.progress.global" :label="state.progress.currentName || 'Global'" />
      <PlaylistList :items="playlists" v-model="selected" />
      <MatchOptions />
    </section>

    <aside class="space-y-4">
      <!-- inchangé -->
      <ConsoleLog />
    </aside>
  </div>
</template>
