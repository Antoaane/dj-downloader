<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthTidal } from '../composables/useAuthTidal'
import { useAppStore } from '../store/useAppStore'

const { startLoginSdk, finishLoginSdk, signOut } = useAuthTidal()
const { state, clearTidal } = useAppStore()
const name = ref('') // si tu affiches un nom plus tard

onMounted(async () => {
  const q = new URLSearchParams(location.search)
  if (q.has('code') || q.has('error')) {
    try { await finishLoginSdk() } finally {
      // nettoie la query d'URL
      history.replaceState({}, '', location.pathname)
    }
  }
})

async function logout() {
  await signOut().catch(()=>{})
  clearTidal()
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold">Connexion TIDAL</h1>
    <div class="flex gap-2">
      <button class="btn btn-primary" @click="startLoginSdk()">Se connecter</button>
      <button v-if="state.tidal.accessToken" class="btn btn-outline" @click="logout">Se déconnecter</button>
    </div>
    <div class="text-sm opacity-70">
      Statut: <span class="badge" :class="state.tidal.accessToken ? 'badge-success' : 'badge-outline'">
        {{ state.tidal.accessToken ? 'Connecté' : 'Non connecté' }}
      </span>
    </div>
  </div>
</template>
