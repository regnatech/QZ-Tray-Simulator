<script setup lang="ts">
import { computed } from 'vue'
import type { PrinterStatus } from '@shared/types'

const props = defineProps<{ status: PrinterStatus }>()

const map: Record<PrinterStatus, { label: string; dot: string; text: string; bg: string }> = {
  online: { label: 'Online', dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  offline: { label: 'Offline', dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' },
  busy: { label: 'In stampa', dot: 'bg-brand-400', text: 'text-brand-300', bg: 'bg-brand-500/10' },
  error: { label: 'Errore', dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-500/10' }
}
const info = computed(() => map[props.status])
</script>

<template>
  <span class="chip" :class="[info.bg, info.text]">
    <span class="status-dot" :class="info.dot" :style="status === 'online' || status === 'busy' ? 'box-shadow:0 0 0 3px rgba(255,255,255,0.06)' : ''" />
    {{ info.label }}
  </span>
</template>
