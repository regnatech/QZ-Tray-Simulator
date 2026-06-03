<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppLayout from './components/AppLayout.vue'
import { useAppStore } from './stores/app'

const app = useAppStore()
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    await app.init()
  } catch (e) {
    error.value = (e as Error).message
  }
})
onBeforeUnmount(() => app.dispose())
</script>

<template>
  <AppLayout v-if="app.ready" />
  <div v-else-if="error" class="h-full grid place-items-center text-red-300">
    <div class="text-center">
      <p class="text-lg font-semibold">Errore di inizializzazione</p>
      <p class="text-sm text-slate-400 mt-2">{{ error }}</p>
    </div>
  </div>
  <div v-else class="h-full grid place-items-center" data-testid="loading">
    <div class="flex flex-col items-center gap-4">
      <div class="h-10 w-10 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
      <p class="text-sm text-slate-400">Avvio del simulatore…</p>
    </div>
  </div>
</template>
