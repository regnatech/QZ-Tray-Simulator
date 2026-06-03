<script setup lang="ts">
import { computed } from 'vue'
import { ERROR_LABELS } from '@shared/types'
import Icon from '../components/ui/Icon.vue'
import { usePrintersStore } from '../stores/printers'
import { useHistoryStore } from '../stores/history'
import { timeAgo } from '../lib/format'

const printers = usePrintersStore()
const history = useHistoryStore()

const summary = computed(() => ({
  online: printers.printers.filter((p) => p.status === 'online' || p.status === 'busy').length,
  errors: printers.printers.filter((p) => p.status === 'error').length,
  offline: printers.printers.filter((p) => p.status === 'offline').length,
  queue: printers.totalQueue
}))

const statusStyle: Record<string, { ring: string; glow: string; text: string }> = {
  online: { ring: 'ring-emerald-500/40', glow: 'bg-emerald-500/5', text: 'text-emerald-400' },
  busy: { ring: 'ring-brand-500/50', glow: 'bg-brand-500/10', text: 'text-brand-300' },
  error: { ring: 'ring-red-500/50', glow: 'bg-red-500/10', text: 'text-red-400' },
  offline: { ring: 'ring-white/5', glow: 'bg-transparent', text: 'text-slate-500' }
}
function lastFor(printerId: string): string {
  const last = history.entries.find((e) => e.printerId === printerId)
  return last ? timeAgo(last.createdAt) : 'nessuna'
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass p-4 flex items-center gap-3">
        <span class="status-dot bg-emerald-400 animate-pulse" /><div><p class="text-2xl font-bold text-white tabular-nums">{{ summary.online }}</p><p class="text-xs text-slate-500">Operative</p></div>
      </div>
      <div class="glass p-4 flex items-center gap-3">
        <span class="status-dot bg-red-400" /><div><p class="text-2xl font-bold text-white tabular-nums">{{ summary.errors }}</p><p class="text-xs text-slate-500">In errore</p></div>
      </div>
      <div class="glass p-4 flex items-center gap-3">
        <span class="status-dot bg-slate-500" /><div><p class="text-2xl font-bold text-white tabular-nums">{{ summary.offline }}</p><p class="text-xs text-slate-500">Offline</p></div>
      </div>
      <div class="glass p-4 flex items-center gap-3">
        <Icon name="layers" :size="20" class="text-amber-400" /><div><p class="text-2xl font-bold text-white tabular-nums">{{ summary.queue }}</p><p class="text-xs text-slate-500">In coda totale</p></div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
      <div
        v-for="p in printers.printers"
        :key="p.id"
        class="glass p-5 ring-1 transition-all duration-300 relative overflow-hidden"
        :class="[statusStyle[p.status].ring, statusStyle[p.status].glow]"
        :data-testid="`monitor-${p.identifier}`"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="grid h-9 w-9 place-items-center rounded-lg" :style="{ background: `${p.color}22`, color: p.color }">
              <Icon :name="p.icon" :size="18" />
            </div>
            <div>
              <p class="font-semibold text-white text-sm leading-tight">{{ p.name }}</p>
              <p class="text-[11px] font-mono text-slate-500">{{ p.identifier }}</p>
            </div>
          </div>
          <span class="status-dot" :class="statusStyle[p.status].text.replace('text', 'bg')" />
        </div>

        <div class="mt-4 flex items-end justify-between">
          <div>
            <p class="text-[10px] uppercase tracking-wide text-slate-500">Stato</p>
            <p class="text-sm font-semibold uppercase" :class="statusStyle[p.status].text">{{ p.status }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-wide text-slate-500">Coda</p>
            <p class="text-2xl font-bold tabular-nums" :class="p.queue ? 'text-amber-300' : 'text-white'">{{ p.queue }}</p>
          </div>
        </div>

        <div v-if="p.status === 'busy'" class="mt-3 h-1 rounded-full bg-ink-700 overflow-hidden">
          <div class="h-full w-1/3 bg-brand-500 rounded-full animate-pulse" style="animation: shimmer 1.4s infinite" />
        </div>

        <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Ultima: {{ lastFor(p.id) }}</span>
          <span>{{ p.jobsReceived }} job</span>
        </div>

        <div v-if="printers.activeErrors(p.id).length" class="mt-2 text-[11px] text-red-300 flex items-center gap-1">
          <Icon name="alert" :size="12" /> {{ printers.activeErrors(p.id).map((e) => ERROR_LABELS[e.kind]).join(', ') }}
        </div>
      </div>
    </div>
  </div>
</template>
