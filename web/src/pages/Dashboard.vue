<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { useSpotifyApi } from '../composables/useSpotifyApi'
import { useTidalApi } from '../composables/useTidalApi'
import { useMatcher } from '../composables/useMatcher'
import { useCache } from '../composables/useCache'
import { useTidalDl, type TidalDlJob } from '../composables/useTidalDl'
import type { Playlist, Track } from '../types/models'

const { state, log } = useAppStore()
const { me, getPlaylists, getPlaylistTracks } = useSpotifyApi()
const tidal = useTidalApi()
const { pickBest, metaHash } = useMatcher()
const cache = useCache()
const { defaultOutput } = useTidalDl()

const loading = ref(false)
const fetchingTracks = ref(false)
const playlists = ref<Playlist[]>([])
const selected = ref<string[]>([])
const filter = ref('')
const onlySelected = ref(false)
const sortBy = ref<'name' | 'size'>('name')
const profileName = ref('')

const quality = computed({
  get: () => state.options.tidalQuality,
  set: (v: 'Normal' | 'High' | 'HiFi' | 'Master') => (state.options.tidalQuality = v)
})
const outputBase = computed({
  get: () => state.options.outputBase,
  set: (v: string) => (state.options.outputBase = v)
})

const filtered = computed(() => {
  const f = filter.value.trim().toLowerCase()
  let list = playlists.value
  if (f) list = list.filter(p => (p.name + ' ' + (p.description ?? '')).toLowerCase().includes(f))
  if (onlySelected.value) list = list.filter(p => selected.value.includes(p.id))
  if (sortBy.value === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  else list = [...list].sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
  return list
})
const selectedCount = computed(() => selected.value.length)
const selectedTracksTotal = computed(() => {
  const ids = new Set(selected.value)
  return playlists.value.filter(p => ids.has(p.id)).reduce((acc, p) => acc + (p.total || 0), 0)
})

function toggleAllVisible(check: boolean) {
  const idsVisible = filtered.value.map(p => p.id)
  if (check) {
    const set = new Set(selected.value.concat(idsVisible))
    selected.value = Array.from(set)
  } else {
    const set = new Set(selected.value)
    idsVisible.forEach(id => set.delete(id))
    selected.value = Array.from(set)
  }
}
function toggleOne(id: string) {
  const i = selected.value.indexOf(id)
  if (i === -1) selected.value.push(id)
  else selected.value.splice(i, 1)
}

async function loadProfileName() {
  const res = await me().catch(() => null)
  profileName.value = res?.display_name ?? ''
}
async function loadPlaylists() {
  if (!state.spotify.accessToken) return log({ level: 'warn', message: 'Connecte Spotify d’abord.' })
  loading.value = true
  try {
    playlists.value = await getPlaylists()
    log({ level: 'success', message: `Playlists chargées: ${playlists.value.length}` })
  } catch (e: any) {
    log({ level: 'error', message: `Erreur chargement playlists: ${e.message ?? e}` })
  } finally { loading.value = false }
}

async function dryRun() {
  if (!state.spotify.accessToken) return log({ level: 'warn', message: 'Connecte Spotify d’abord.' })
  const chosen = playlists.value.filter(p => selected.value.includes(p.id))
  if (!chosen.length) return log({ level: 'warn', message: 'Sélectionne au moins une playlist.' })

  fetchingTracks.value = true
  try {
    for (const p of chosen) {
      log({ level: 'info', message: `Analyse: ${p.name}` })
      const tracks = await getPlaylistTracks(p.id)
      let found = 0
      for (const t of tracks) {
        let bestId: string | undefined
        const h = metaHash(t)
        const cached = await cache.getMap(h)
        if (cached) bestId = cached
        else {
          let candidates: Track[] = []
          if (t.isrc) candidates = await tidal.searchByIsrc(t.isrc).catch(() => [])
          if (!candidates.length) {
            const q = `${t.title} ${t.artists.join(' ')}`
            candidates = await tidal.searchByQuery(q).catch(() => [])
          }
          const best = pickBest(t, candidates, state.options.threshold)
          if (best) {
            bestId = best.tidalTrackId
            await cache.setMap(h, bestId)
          }
        }
        if (bestId) found++
      }
      log({ level: 'info', message: `${p.name}: ${found}/${p.total} candidats probables.` })
    }
  } finally { fetchingTracks.value = false }
}

async function buildJobs(): Promise<TidalDlJob[]> {
  const chosen = playlists.value.filter(p => selected.value.includes(p.id))
  if (!chosen.length) return []

  const jobs: TidalDlJob[] = []
  for (const p of chosen) {
    const srcTracks = await getPlaylistTracks(p.id)
    const links: string[] = []
    for (const t of srcTracks) {
      const h = metaHash(t)
      let bestId = await cache.getMap(h)
      if (!bestId) {
        let candidates: Track[] = []
        if (t.isrc) candidates = await tidal.searchByIsrc(t.isrc).catch(() => [])
        if (!candidates.length) {
          const q = `${t.title} ${t.artists.join(' ')}`
          candidates = await tidal.searchByQuery(q).catch(() => [])
        }
        const best = pickBest(t, candidates, state.options.threshold)
        bestId = best?.tidalTrackId
        if (bestId) await cache.setMap(h, bestId)
      }
      if (bestId) links.push(`https://tidal.com/browse/track/${bestId}`)
    }
    if (links.length) {
      jobs.push({
        quality: quality.value,
        output: defaultOutput(outputBase.value, p.name),
        links
      })
    }
  }
  return jobs
}

async function sendCommands() {
  if (!state.spotify.accessToken) return log({ level: 'warn', message: 'Connecte Spotify d’abord.' })
  try {
    const jobs = await buildJobs()
    if (!jobs.length) return log({ level: 'warn', message: 'Aucun job construit.' })
    const res = await fetch(import.meta.env.VITE_BACKEND_URL + '/tidal/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs })
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    log({ level: 'success', message: `Jobs envoyés: ${data.accepted ?? jobs.length}` })
  } catch (e: any) {
    log({ level: 'error', message: `Envoi backend échoué: ${e.message ?? e}` })
  }
}

onMounted(async () => {
  // DEBUG tokens au mount
  console.log('[DEBUG] Spotify token:', state.spotify.accessToken)
  console.log('[DEBUG] Spotify expiresAt:', new Date(state.spotify.expiresAt).toISOString())
  console.log('[DEBUG] TIDAL token:', state.tidal.accessToken)
  console.log('[DEBUG] TIDAL expiresAt:', new Date(state.tidal.expiresAt).toISOString())

  if (state.spotify.accessToken) {
    await Promise.all([loadProfileName(), loadPlaylists()])
  }
})
watch(() => state.spotify.accessToken, async (t) => {
  if (t) await Promise.all([loadProfileName(), loadPlaylists()])
  else { playlists.value = []; selected.value = []; profileName.value = '' }
})
</script>

<template>
  <div class="space-y-6">
    <!-- HEADER / OPTIONS -->
    <div class="card bg-base-200 shadow">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <h2 class="card-title">Options globales</h2>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span>Spotify :</span>
              <a class="badge" :class="state.spotify.accessToken ? 'badge-success' : 'badge-outline'"
                href="/connect-spotify">
                {{ state.spotify.accessToken ? (state.spotify.profileName || 'Connecté') : 'Connecter' }}
              </a>

              <span class="mx-2">•</span>

              <span>TIDAL :</span>
              <a class="badge" :class="state.tidal.accessToken ? 'badge-success' : 'badge-outline'"
                href="/connect-tidal">
                {{ state.tidal.accessToken ? 'Connecté' : 'Connecter' }}
              </a>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <label class="form-control">
              <span class="label-text text-xs">Qualité</span>
              <select v-model="quality" class="select select-bordered select-sm">
                <option>Normal</option>
                <option>High</option>
                <option>HiFi</option>
                <option>Master</option>
              </select>
            </label>
            <label class="form-control w-64">
              <span class="label-text text-xs">Dossier de base</span>
              <input v-model="outputBase" class="input input-bordered input-sm" />
            </label>
            <button class="btn btn-outline btn-sm" :disabled="loading" @click="loadPlaylists">
              {{ loading ? 'Chargement…' : 'Recharger playlists' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PLAYLISTS -->
    <div class="card bg-base-200 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title">Playlists Spotify</h2>
        <div class="flex flex-wrap items-center gap-3">
          <div class="join">
            <button class="btn btn-sm join-item" @click="toggleAllVisible(true)">Tout cocher</button>
            <button class="btn btn-sm join-item" @click="toggleAllVisible(false)">Tout décocher</button>
          </div>
          <label class="input input-bordered input-sm flex items-center gap-2 w-72">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 21l-4.3-4.3m1.8-4.5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input v-model="filter" type="text" class="grow" placeholder="Filtrer…" />
          </label>
          <label class="label cursor-pointer gap-2">
            <span class="label-text">N’afficher que sélectionnées</span>
            <input type="checkbox" class="toggle toggle-sm" v-model="onlySelected" />
          </label>
          <label class="form-control">
            <span class="label-text text-xs">Tri</span>
            <select v-model="sortBy" class="select select-bordered select-sm">
              <option value="name">Nom</option>
              <option value="size">Nb titres</option>
            </select>
          </label>
          <div class="ms-auto text-sm opacity-70">
            <b>{{ selectedCount }}</b> playlists, ~<b>{{ selectedTracksTotal }}</b> titres
          </div>
        </div>

        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-2">
          <div v-for="p in filtered" :key="p.id" class="card bg-base-100 border">
            <div class="card-body py-3 px-4 flex flex-row justify-between items-center">
              <div class="min-w-0">
                <h3 class="font-semibold truncate" :title="p.name">{{ p.name }}</h3>
                <p class="text-xs opacity-70 truncate">{{ p.description }}</p>
                <div class="text-xs opacity-70">{{ p.total }} titres</div>
              </div>
              <input type="checkbox" class="checkbox checkbox-sm" :checked="selected.includes(p.id)"
                @change="toggleOne(p.id)" />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-outline" :disabled="!selectedCount || fetchingTracks || !state.spotify.accessToken"
            @click="dryRun">
            {{ fetchingTracks ? 'Analyse…' : 'Dry-run' }}
          </button>

          <button class="btn btn-primary" :disabled="!selectedCount || fetchingTracks"
            @click="sendCommands">
            {{ fetchingTracks ? 'Préparation…' : 'Envoyer commandes' }}
          </button>
        </div>

      </div>
    </div>

    <!-- CONSOLE -->
    <div class="card bg-base-200 shadow">
      <div class="card-body">
        <h2 class="card-title">Console</h2>
        <div class="h-64 overflow-y-auto bg-black text-white font-mono text-sm rounded p-2 space-y-1">
          <div v-for="l in state.logs" :key="l.ts" class="flex gap-2">
            <span class="badge badge-xs mt-0.5" :class="{
              'badge-info': l.level === 'info',
              'badge-warning': l.level === 'warn',
              'badge-success': l.level === 'success',
              'badge-error': l.level === 'error'
            }"></span>
            <span class="whitespace-pre-wrap">{{ new Date(l.ts).toLocaleTimeString() }} › {{ l.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
