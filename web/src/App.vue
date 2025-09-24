<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen">
    <div class="navbar bg-base-100 border-b">
      <div class="flex-1">
        <RouterLink to="/" class="btn btn-ghost normal-case text-xl">TIDAL Sync</RouterLink>
      </div>
      <div class="flex-none gap-2 pr-4">
        <RouterLink to="/connect-spotify" class="btn btn-sm">Spotify</RouterLink>
        <RouterLink to="/connect-tidal" class="btn btn-sm btn-primary">TIDAL</RouterLink>
      </div>
    </div>
    <main class="container mx-auto p-4">
      <RouterView />
    </main>
  </div>
</template>
