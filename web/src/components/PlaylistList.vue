<script setup lang="ts">
import type { Playlist } from '../types/models'

const props = defineProps<{ items: Playlist[]; modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue':[string[]] }>()

function toggle(id: string, checked: boolean) {
  const set = new Set(props.modelValue)
  checked ? set.add(id) : set.delete(id)
  emit('update:modelValue', Array.from(set))
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Nom</th>
          <th>Nb titres</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in items" :key="p.id">
          <td>
            <input type="checkbox" class="checkbox"
              :checked="modelValue.includes(p.id)"
              @change="(e:any)=> toggle(p.id, e.target.checked)"/>
          </td>
          <td>{{ p.name }}</td>
          <td><div class="badge badge-outline">{{ p.total }}</div></td>
          <td class="truncate max-w-[420px]">{{ p.description }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
