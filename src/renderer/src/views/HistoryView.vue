<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { HistoryEntry } from '@shared/types'
import Icon from '../components/ui/Icon.vue'
import Modal from '../components/ui/Modal.vue'
import ReceiptViewer from '../components/ReceiptViewer.vue'
import ESCPosParserViewer from '../components/ESCPosParserViewer.vue'
import { useHistoryStore } from '../stores/history'
import { usePrintersStore } from '../stores/printers'
import { useAppStore } from '../stores/app'
import { formatDateTime, formatDuration, formatBytes } from '../lib/format'

const history = useHistoryStore()
const printers = usePrintersStore()
const app = useAppStore()

const search = ref('')
const printerFilter = ref('')
const selected = ref<HistoryEntry | null>(null)
const tab = ref<'receipt' | 'parser'>('receipt')

onMounted(() => history.load())

const sourceLabels: Record<string, string> = { qz: 'QZ Tray', api: 'API', manual: 'Manuale', simulation: 'Simulazione' }

async function applyFilter(): Promise<void> {
  await history.load({ search: search.value || undefined, printerId: printerFilter.value || undefined })
}
async function doExport(format: 'json' | 'csv' | 'pdf'): Promise<void> {
  const path = await history.exportData(format)
  if (path) app.toast('success', `Esportato in ${path}`)
}

const empty = computed(() => !history.loading && history.entries.length === 0)
</script>

<template>
  <div class="space-y-5">
    <div class="glass p-4 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[220px]">
        <Icon name="search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          v-model="search"
          class="input pl-9"
          placeholder="Cerca nel contenuto…"
          data-testid="history-search"
          @keyup.enter="applyFilter"
        />
      </div>
      <select v-model="printerFilter" class="input w-48" @change="applyFilter">
        <option value="">Tutte le stampanti</option>
        <option v-for="p in printers.printers" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <button class="btn-ghost" @click="applyFilter"><Icon name="filter" :size="16" /> Filtra</button>
      <div class="flex gap-2 ml-auto">
        <button class="btn-ghost" @click="doExport('json')"><Icon name="download" :size="16" /> JSON</button>
        <button class="btn-ghost" @click="doExport('csv')"><Icon name="download" :size="16" /> CSV</button>
        <button class="btn-ghost" @click="doExport('pdf')"><Icon name="download" :size="16" /> PDF</button>
      </div>
    </div>

    <div class="glass overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-white/[0.06]">
          <tr>
            <th class="px-5 py-3 font-medium">Stampante</th>
            <th class="px-5 py-3 font-medium">Data e ora</th>
            <th class="px-5 py-3 font-medium">Origine</th>
            <th class="px-5 py-3 font-medium text-right">Durata</th>
            <th class="px-5 py-3 font-medium text-right">Dimensione</th>
            <th class="px-5 py-3 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="e in history.entries"
            :key="e.id"
            class="border-b border-white/[0.03] hover:bg-white/[0.03] transition cursor-pointer"
            data-testid="history-row"
            @click="selected = e; tab = 'receipt'"
          >
            <td class="px-5 py-3 font-medium text-slate-200">{{ e.printerName }}</td>
            <td class="px-5 py-3 text-slate-400 tabular-nums">{{ formatDateTime(e.createdAt) }}</td>
            <td class="px-5 py-3"><span class="chip bg-white/[0.05] text-slate-300">{{ sourceLabels[e.source] }}</span></td>
            <td class="px-5 py-3 text-right text-slate-400 tabular-nums">{{ formatDuration(e.durationMs) }}</td>
            <td class="px-5 py-3 text-right text-slate-400 tabular-nums">{{ formatBytes(e.bytes) }}</td>
            <td class="px-5 py-3 text-right text-slate-500"><Icon name="search" :size="15" class="inline" /></td>
          </tr>
        </tbody>
      </table>
      <div v-if="empty" class="py-16 text-center text-slate-500">
        <Icon name="history" :size="32" class="mx-auto mb-3 opacity-40" />
        Nessuna stampa registrata
      </div>
      <div v-else class="px-5 py-3 text-xs text-slate-500 border-t border-white/[0.04]">
        {{ history.entries.length }} di {{ history.total }} stampe
      </div>
    </div>

    <Modal :open="!!selected" :title="`Scontrino · ${selected?.printerName}`" wide @close="selected = null">
      <div class="flex gap-2 mb-4">
        <button class="btn" :class="tab === 'receipt' ? 'btn-primary' : 'btn-ghost'" @click="tab = 'receipt'">
          <Icon name="receipt" :size="16" /> Anteprima
        </button>
        <button class="btn" :class="tab === 'parser' ? 'btn-primary' : 'btn-ghost'" @click="tab = 'parser'">
          <Icon name="terminal" :size="16" /> Parser ESC/POS
        </button>
      </div>
      <div v-if="selected">
        <ReceiptViewer v-if="tab === 'receipt'" :rendered="selected.rendered" :animate="false" />
        <ESCPosParserViewer v-else :raw-base64="selected.rawBase64" :rendered="selected.rendered" />
      </div>
    </Modal>
  </div>
</template>
