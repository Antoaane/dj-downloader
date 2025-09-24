import { createApp, onMounted } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import './style.css'
import { useAppStore } from './store/useAppStore'
import { useAuthSpotify } from './composables/useAuthSpotify'
import { useAuthTidal } from './composables/useAuthTidal'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

const app = createApp(App)
app.use(router).use(VueQueryPlugin, { queryClient })

// Bootstrap auth (Spotify refresh si proche de l’expiration, TIDAL via SDK)
const Boot = {
  setup() {
    const store = useAppStore()
    const { ensureSpotifySession } = useAuthSpotify()
    const { bootstrapTidalToken } = useAuthTidal()
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''

    onMounted(async () => {
      // assure un token Spotify valide si on en a un en localStorage
      if (store.state.spotify.accessToken) {
        await ensureSpotifySession(clientId).catch(() => {})
      }
      // récupère un token TIDAL si l’utilisateur est déjà loggé via le SDK
      await bootstrapTidalToken().catch(() => {})
    })
    return () => null
  }
}

app.component('AuthBoot', Boot)
app.mount('#app')
