<script setup lang="ts">
import { useAppStore } from '../store/useAppStore'
const { state } = useAppStore()
</script>

<template>
  <div class="card bg-base-200">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <h3 class="card-title">Console</h3>
        <span class="badge">Logs: {{ state.logs.length }}</span>
      </div>
      <div class="h-64 overflow-auto mt-2">
        <ul class="space-y-2">
          <li v-for="l in state.logs" :key="l.ts" class="text-sm">
            <span
              :class="{
                'text-success': l.level==='success',
                'text-info': l.level==='info',
                'text-warning': l.level==='warn',
                'text-error': l.level==='error'
              }">
              [{{ new Date(l.ts).toLocaleTimeString() }}] {{ l.level.toUpperCase() }}:
            </span>
            <span class="ml-2">{{ l.message }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
