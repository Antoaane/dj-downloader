<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthSpotify } from '../composables/useAuthSpotify'
import { useSpotifyApi } from '../composables/useSpotifyApi'
import { useAppStore } from '../store/useAppStore'

const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''
const redirectUri = location.origin + '/connect-spotify'
const { startLogin, finishLogin } = useAuthSpotify()
const { me } = useSpotifyApi()
const { state } = useAppStore()
const name = ref('')

onMounted(async () => {
  await finishLogin(clientId, redirectUri)
  if (state.spotify.accessToken) {
    const profile = await me().catch(() => null)
    name.value = profile?.display_name ?? ''
    state.spotify.profileName = name.value
  }
})
</script>

<template>
  <div class="max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold">Connexion Spotify</h1>
    <p v-if="name">Connecté en tant que <b>{{ name }}</b></p>
    <button class="btn btn-primary" @click="startLogin(clientId, redirectUri)">Se connecter</button>
    <p class="text-sm opacity-70">Scopes: lecture seule (playlists & bibliothèque).</p>
  </div>
</template>
