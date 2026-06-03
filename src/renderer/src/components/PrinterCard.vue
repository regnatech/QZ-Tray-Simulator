<script setup lang="ts">
import { computed } from 'vue'
import type { PrinterWithRuntime } from '@shared/ipc'
import { ERROR_LABELS } from '@shared/types'
import Icon from './ui/Icon.vue'
import StatusBadge from './ui/StatusBadge.vue'
import { usePrintersStore } from '../stores/printers'
import { timeAgo } from '../lib/format'

const props = defineProps<{ printer: PrinterWithRuntime; compact?: boolean }>()
defineEmits<{ open: [id: string] }>()

const printers = usePrintersStore()
const errs = computed(() => printers.activeErrors(props.printer.id))
const effect = computed(() => printers.effects[props.printer.id])
const recentEffect = computed(() => effect.value && Date.now() - effect.value.at < 2500)
const paperColor = computed(() =>
  props.printer.paperLevel < 10 ? '#ef4444' : props.printer.paperLevel < 25 ? '#f59e0b' : '#22c55e'
)
</script>

<template>
  <div
    class="glass p-5 card-hover cursor-pointer relative overflow-hidden animate-fade-in"
    :data-testid="`printer-card-${printer.identifier}`"
    @click="$emit('open', printer.id)"
  >
    <div class="absolute inset-x-0 top-0 h-1" :style="{ background: printer.color }" />

    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="grid h-11 w-11 place-items-center rounded-xl shrink-0"
          :style="{ background: `${printer.color}22`, color: printer.color }"
        >
          <Icon :name="printer.icon" :size="22" />
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-white truncate">{{ printer.name }}</p>
          <p class="text-xs text-slate-500 truncate">{{ printer.driver }} · {{ printer.paperWidth }}mm</p>
        </div>
      </div>
      <StatusBadge :status="printer.status" />
    </div>

    <div v-if="recentEffect" class="mt-3 chip bg-brand-500/15 text-brand-200 animate-fade-in">
      <Icon :name="effect?.type === 'drawer' ? 'box' : effect?.type === 'cut' ? 'scissors' : 'bell'" :size="14" />
      {{ effect?.type === 'drawer' ? 'Cassetto aperto' : effect?.type === 'cut' ? 'Taglio carta' : 'Beep' }}
    </div>

    <div v-if="errs.length" class="mt-3 flex flex-wrap gap-1.5">
      <span v-for="e in errs" :key="e.id" class="chip bg-red-500/15 text-red-300">
        <Icon name="alert" :size="12" /> {{ ERROR_LABELS[e.kind] }}
      </span>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-3 text-center">
      <div class="glass-soft py-2">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Lavori</p>
        <p class="text-lg font-semibold text-white tabular-nums">{{ printer.jobsReceived }}</p>
      </div>
      <div class="glass-soft py-2">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Coda</p>
        <p class="text-lg font-semibold tabular-nums" :class="printer.queue > 0 ? 'text-amber-300' : 'text-white'">
          {{ printer.queue }}
        </p>
      </div>
      <div class="glass-soft py-2">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Carta</p>
        <p class="text-lg font-semibold tabular-nums" :style="{ color: paperColor }">{{ Math.round(printer.paperLevel) }}%</p>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span class="flex items-center gap-1.5"><Icon name="clock" :size="13" /> {{ timeAgo(printer.lastPrintAt) }}</span>
      <span class="font-mono text-[11px]">{{ printer.identifier }}</span>
    </div>

    <div class="mt-2 h-1.5 rounded-full bg-ink-700 overflow-hidden">
      <div class="h-full rounded-full transition-all duration-500" :style="{ width: `${printer.paperLevel}%`, background: paperColor }" />
    </div>
  </div>
</template>
