<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TrafficRate } from '@shared/types'
import Icon from '../components/ui/Icon.vue'
import { useSimulationStore } from '../stores/simulation'
import { usePrintersStore } from '../stores/printers'
import { useAppStore } from '../stores/app'

const simulation = useSimulationStore()
const printers = usePrintersStore()
const app = useAppStore()

const RATES: TrafficRate[] = [10, 50, 100, 500]
const rate = ref<TrafficRate>(10)
const selected = ref<string[]>([])

const running = computed(() => simulation.state.running)

function togglePrinter(id: string): void {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}
async function start(): Promise<void> {
  await simulation.start(rate.value, selected.value)
  app.toast('success', `Simulazione avviata a ${rate.value} stampe/min`)
}
async function stop(): Promise<void> {
  await simulation.stop()
  app.toast('info', 'Simulazione interrotta')
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 space-y-6">
      <div class="glass p-6">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Frequenza di stampa</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            v-for="r in RATES"
            :key="r"
            class="glass-soft p-5 text-center transition-all border-2"
            :class="rate === r ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:border-white/10'"
            :data-testid="`rate-${r}`"
            @click="rate = r"
          >
            <p class="text-3xl font-bold text-white tabular-nums">{{ r }}</p>
            <p class="text-xs text-slate-500 mt-1">stampe / minuto</p>
          </button>
        </div>
        <p class="text-xs text-slate-500 mt-3">
          Utile per stress test del parser, della coda e dell'interfaccia. Le frequenze elevate generano scontrini realistici in continuo.
        </p>
      </div>

      <div class="glass p-6">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Stampanti coinvolte</h2>
        <p v-if="!selected.length" class="text-xs text-slate-500 mb-3">Nessuna selezione: verranno usate tutte le stampanti attive.</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            v-for="p in printers.printers"
            :key="p.id"
            class="glass-soft p-3 flex items-center gap-2 transition border-2 text-left"
            :class="selected.includes(p.id) ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:border-white/10'"
            @click="togglePrinter(p.id)"
          >
            <div class="grid h-8 w-8 place-items-center rounded-lg" :style="{ background: `${p.color}22`, color: p.color }">
              <Icon :name="p.icon" :size="16" />
            </div>
            <span class="text-sm text-slate-200 truncate">{{ p.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div class="glass p-6 text-center">
        <div class="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 text-amber-300 mb-4" :class="running ? 'animate-pulse' : ''">
          <Icon name="zap" :size="32" />
        </div>
        <p class="text-4xl font-bold text-white tabular-nums">{{ simulation.state.generated }}</p>
        <p class="text-sm text-slate-500 mb-5">stampe generate</p>

        <button v-if="!running" class="btn-primary w-full" data-testid="sim-start" @click="start">
          <Icon name="play" :size="16" /> Avvia simulazione
        </button>
        <button v-else class="btn-danger w-full" data-testid="sim-stop" @click="stop">
          <Icon name="stop" :size="16" /> Interrompi
        </button>
      </div>

      <div v-if="running" class="glass p-5 space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-slate-500">Frequenza</span><span class="text-white">{{ simulation.state.rate }}/min</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Stampanti</span><span class="text-white">{{ simulation.state.printerIds.length }}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Coda attuale</span><span class="text-amber-300">{{ printers.totalQueue }}</span></div>
      </div>
    </div>
  </div>
</template>
