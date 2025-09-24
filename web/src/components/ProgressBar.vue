<script setup lang="ts">
defineProps<{ value: number, label?: string }>()
</script>

<template>
  <div>
    <div class="flex justify-between mb-1">
      <span class="text-sm opacity-70">{{ label ?? 'Progression' }}</span>
      <span class="text-sm">{{ Math.round(value) }}%</span>
    </div>
    <progress class="progress progress-primary w-full" :value="value" max="100"></progress>
  </div>
</template>
