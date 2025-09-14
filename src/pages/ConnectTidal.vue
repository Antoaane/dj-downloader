<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthTidal } from '../composables/useAuthTidal'
import { useAppStore } from '../store/useAppStore'

const { startLoginSdk, finishLoginSdk, setManualToken } = useAuthTidal()
const { state } = useAppStore()
const token = ref('')

onMounted(async () => {
  // si on revient de TIDAL avec ?code=... ou ?error=...
  const q = new URLSearchParams(location.search)
  if (q.has('code') || q.has('error')) {
    try {
      await finishLoginSdk()
    } catch (e: any) {
      console.error(e)
      alert(`Erreur TIDAL: ${e?.message ?? e}`)
    }
  }
})
</script>

<template>
  <div class="max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold">Connexion TIDAL</h1>

    <button class="btn btn-primary" @click="startLoginSdk()">Login via SDK (recommandé)</button>

    <div class="divider">ou</div>

    <label class="form-control">
      <div class="label"><span class="label-text">Token (dev)</span></div>
      <input class="input input-bordered" v-model="token" placeholder="Coller un access token TIDAL (temporaire)" />
    </label>
    <button class="btn" @click="setManualToken(token)">Enregistrer le token</button>

    <div v-if="state.tidal.accessToken" class="alert alert-success mt-4">
      <span>Connecté à TIDAL.</span>
    </div>
  </div>
</template>
