<script setup lang="ts">
import { computed } from 'vue'
import type { ErrorKind } from '@shared/types'
import { ERROR_LABELS } from '@shared/types'
import Icon from './ui/Icon.vue'
import Toggle from './ui/Toggle.vue'
import { usePrintersStore } from '../stores/printers'

const props = defineProps<{ printerId: string }>()
const printers = usePrintersStore()

const KINDS: ErrorKind[] = [
  'paper_low',
  'paper_empty',
  'offline',
  'unreachable',
  'cover_open',
  'buffer_full',
  'generic'
]

const active = computed(() => new Set(printers.activeErrors(props.printerId).map((e) => e.kind)))

function toggle(kind: ErrorKind, value: boolean): void {
  void printers.setError(props.printerId, kind, value)
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2 text-sm font-medium text-slate-300">
      <Icon name="alert" :size="16" class="text-amber-400" /> Simulazione errori
    </div>
    <div class="space-y-1.5">
      <div
        v-for="kind in KINDS"
        :key="kind"
        class="flex items-center justify-between glass-soft px-3 py-2"
      >
        <span class="text-sm" :class="active.has(kind) ? 'text-red-300' : 'text-slate-300'">
          {{ ERROR_LABELS[kind] }}
        </span>
        <Toggle :model-value="active.has(kind)" @update:model-value="(v) => toggle(kind, v)" />
      </div>
    </div>
    <button class="btn-ghost w-full text-xs mt-2" @click="printers.clearErrors(printerId)">
      <Icon name="refresh" :size="14" /> Ripristina tutto
    </button>
  </div>
</template>
