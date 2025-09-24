<script setup lang="ts">
import { useAppStore } from '../store/useAppStore'
const { state } = useAppStore()
</script>

<template>
  <!-- ... tes options existantes ... -->

  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label class="form-control">
      <span class="label-text">Qualité TIDAL</span>
      <select v-model="state.options.tidalQuality" class="select select-bordered">
        <option>Normal</option>
        <option>High</option>
        <option>HiFi</option>
        <option>Master</option>
      </select>
    </label>

    <label class="form-control">
      <span class="label-text">Dossier de base (output)</span>
      <input v-model="state.options.outputBase" class="input input-bordered" placeholder="C:/Users/antoi/Music/tests" />
    </label>
  </div>
</template>
