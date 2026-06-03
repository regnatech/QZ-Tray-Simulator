<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import StatTile from '../components/ui/StatTile.vue'
import PrinterCard from '../components/PrinterCard.vue'
import ReceiptViewer from '../components/ReceiptViewer.vue'
import Sparkline from '../components/ui/Sparkline.vue'
import Icon from '../components/ui/Icon.vue'
import { usePrintersStore } from '../stores/printers'
import { useStatisticsStore } from '../stores/statistics'
import { useHistoryStore } from '../stores/history'
import { useSimulationStore } from '../stores/simulation'
import { formatDuration } from '../lib/format'

const router = useRouter()
const printers = usePrintersStore()
const stats = useStatisticsStore()
const history = useHistoryStore()
const simulation = useSimulationStore()

const spark = computed(() => stats.summary.daily.map((d) => d.count))
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <StatTile label="Stampe oggi" :value="stats.summary.totalToday" icon="receipt" accent="#6366f1" :hint="`${stats.summary.totalWeek} questa settimana`" />
      <StatTile label="Stampanti online" :value="`${printers.online.length}/${printers.printers.length}`" icon="printer" accent="#22c55e" />
      <StatTile label="Tempo medio" :value="formatDuration(stats.summary.avgDurationMs)" icon="clock" accent="#06b6d4" />
      <StatTile label="In coda" :value="printers.totalQueue" icon="layers" accent="#f59e0b" :hint="`${stats.summary.totalErrors} errori attivi`" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide">Monitoraggio live</h2>
          <button class="btn-ghost text-xs" @click="router.push('/monitor')">
            Control Center <Icon name="monitor" :size="14" />
          </button>
        </div>
        <div v-if="printers.printers.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PrinterCard
            v-for="p in printers.printers"
            :key="p.id"
            :printer="p"
            @open="router.push('/printers')"
          />
        </div>
        <div v-else class="glass p-10 text-center text-slate-500">
          Nessuna stampante configurata.
          <button class="text-brand-400 hover:underline ml-1" @click="router.push('/printers')">Creane una</button>
        </div>

        <div class="glass p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300">Andamento ultimi 14 giorni</h3>
            <span class="text-2xl font-semibold text-white tabular-nums">{{ stats.summary.totalJobs }}</span>
          </div>
          <Sparkline :values="spark" accent="#6366f1" :width="640" :height="60" class="w-full" />
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide">Ultimo scontrino</h2>
          <button v-if="history.latest" class="btn-ghost text-xs" @click="router.push('/history')">
            Storico <Icon name="history" :size="14" />
          </button>
        </div>
        <div class="glass p-5">
          <ReceiptViewer
            v-if="history.latest"
            :rendered="history.latest.rendered"
            :animate="false"
          />
          <div v-else class="text-center text-slate-500 py-12 text-sm">
            <Icon name="receipt" :size="32" class="mx-auto mb-3 opacity-40" />
            In attesa della prima stampa…
            <button class="block mx-auto mt-3 text-brand-400 hover:underline" @click="router.push('/simulations')">
              Avvia una simulazione
            </button>
          </div>
        </div>

        <div v-if="simulation.state.running" class="glass p-5">
          <div class="flex items-center gap-2 text-amber-300 text-sm font-medium">
            <Icon name="zap" :size="16" /> Simulazione attiva
          </div>
          <p class="text-xs text-slate-400 mt-2">{{ simulation.state.rate }} stampe/min · {{ simulation.state.generated }} generate</p>
        </div>
      </div>
    </div>
  </div>
</template>
