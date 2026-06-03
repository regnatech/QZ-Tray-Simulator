<script setup lang="ts">
import { computed, onMounted } from 'vue'
import StatTile from '../components/ui/StatTile.vue'
import BarChart from '../components/ui/BarChart.vue'
import Icon from '../components/ui/Icon.vue'
import { useStatisticsStore } from '../stores/statistics'
import { usePrintersStore } from '../stores/printers'
import { formatDuration } from '../lib/format'

const stats = useStatisticsStore()
const printers = usePrintersStore()

onMounted(() => stats.load())

const daily = computed(() =>
  stats.summary.daily.map((d) => ({ label: d.date.slice(5), value: d.count }))
)
const maxPrinter = computed(() => Math.max(1, ...stats.summary.perPrinter.map((p) => p.count)))
const colorFor = (id: string): string => printers.byId(id)?.color ?? '#6366f1'
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <StatTile label="Stampe oggi" :value="stats.summary.totalToday" icon="receipt" accent="#6366f1" />
      <StatTile label="Settimana" :value="stats.summary.totalWeek" icon="chart" accent="#06b6d4" />
      <StatTile label="Mese" :value="stats.summary.totalMonth" icon="layers" accent="#8b5cf6" />
      <StatTile label="Tempo medio" :value="formatDuration(stats.summary.avgDurationMs)" icon="clock" accent="#22c55e" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 glass p-6">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-6">Stampe giornaliere</h2>
        <BarChart :data="daily" accent="#6366f1" :height="220" />
      </div>

      <div class="glass p-6">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Utilizzo per stampante</h2>
        <div class="space-y-4">
          <div v-for="p in stats.summary.perPrinter" :key="p.printerId">
            <div class="flex items-center justify-between text-sm mb-1.5">
              <span class="text-slate-300">{{ p.printerName }}</span>
              <span class="text-slate-400 tabular-nums">{{ p.count }}</span>
            </div>
            <div class="h-2 rounded-full bg-ink-700 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :style="{ width: `${(p.count / maxPrinter) * 100}%`, background: colorFor(p.printerId) }" />
            </div>
          </div>
          <p v-if="!stats.summary.perPrinter.length" class="text-sm text-slate-500 text-center py-6">Nessun dato disponibile</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="glass p-5 flex items-center gap-4">
        <Icon name="activity" :size="24" class="text-brand-400" />
        <div><p class="text-2xl font-bold text-white tabular-nums">{{ stats.summary.totalJobs }}</p><p class="text-xs text-slate-500">Stampe totali</p></div>
      </div>
      <div class="glass p-5 flex items-center gap-4">
        <Icon name="alert" :size="24" class="text-red-400" />
        <div><p class="text-2xl font-bold text-white tabular-nums">{{ stats.summary.totalErrors }}</p><p class="text-xs text-slate-500">Errori attivi</p></div>
      </div>
      <div class="glass p-5 flex items-center gap-4">
        <Icon name="printer" :size="24" class="text-emerald-400" />
        <div><p class="text-2xl font-bold text-white tabular-nums">{{ printers.printers.length }}</p><p class="text-xs text-slate-500">Stampanti</p></div>
      </div>
    </div>
  </div>
</template>
