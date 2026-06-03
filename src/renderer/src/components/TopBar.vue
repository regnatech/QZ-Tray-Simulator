<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './ui/Icon.vue'
import { useAppStore } from '../stores/app'
import { useSimulationStore } from '../stores/simulation'

const route = useRoute()
const app = useAppStore()
const simulation = useSimulationStore()

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  printers: 'Stampanti virtuali',
  history: 'Storico stampe',
  monitor: 'Control Center',
  simulations: 'Generatore di traffico',
  statistics: 'Statistiche',
  settings: 'Impostazioni',
  system: 'Dashboard Sistema'
}
const title = computed(() => titles[(route.name as string) ?? 'dashboard'] ?? 'Clicketta')
</script>

<template>
  <header class="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/[0.06] bg-ink-900/40 backdrop-blur-xl drag">
    <div class="no-drag">
      <h1 class="text-lg font-semibold text-white">{{ title }}</h1>
    </div>

    <div class="flex items-center gap-3 no-drag">
      <div
        v-if="simulation.state.running"
        class="chip bg-amber-500/15 text-amber-300 animate-pulse"
      >
        <Icon name="zap" :size="14" /> Traffico {{ simulation.state.rate }}/min · {{ simulation.state.generated }}
      </div>

      <div class="chip bg-white/[0.04] text-slate-300">
        <span class="status-dot" :class="app.servers.qz.running ? 'bg-emerald-400' : 'bg-slate-500'" />
        QZ {{ app.servers.qz.running ? 'online' : 'offline' }}
      </div>

      <button class="btn-ghost" title="Notifiche">
        <Icon name="bell" :size="18" />
      </button>
    </div>
  </header>
</template>
