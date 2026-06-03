<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LogLevel } from '@shared/types'
import Icon from '../components/ui/Icon.vue'
import { useAppStore } from '../stores/app'
import { api } from '../lib/api'
import { formatTime } from '../lib/format'

const app = useAppStore()
const levelFilter = ref<LogLevel | 'all'>('all')

const levelColor: Record<string, string> = {
  debug: 'text-slate-500',
  info: 'text-sky-300',
  warning: 'text-amber-300',
  error: 'text-red-300'
}

const filteredLogs = computed(() =>
  levelFilter.value === 'all' ? app.logs : app.logs.filter((l) => l.level === levelFilter.value)
)

async function exportLogs(): Promise<void> {
  const path = await api.logs.exportData()
  if (path) app.toast('success', `Log esportati in ${path}`)
}

const info = computed(() => app.systemInfo)
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="glass p-5">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-3"><Icon name="cpu" :size="16" /> Sistema</div>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">Versione</dt><dd class="text-slate-200">{{ info.version || '1.0.0' }}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Piattaforma</dt><dd class="text-slate-200">{{ info.platform }}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Electron</dt><dd class="text-slate-200">{{ info.electron }}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Node</dt><dd class="text-slate-200">{{ info.node }}</dd></div>
        </dl>
      </div>

      <div class="glass p-5">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-3"><Icon name="wifi" :size="16" /> QZ Tray</div>
        <p class="text-2xl font-bold" :class="app.servers.qz.running ? 'text-emerald-400' : 'text-slate-500'">
          {{ app.servers.qz.running ? 'Attivo' : 'Spento' }}
        </p>
        <p class="text-xs text-slate-500 mt-1 font-mono">ws://127.0.0.1:{{ app.servers.qz.port }}</p>
        <button class="btn-ghost w-full mt-3 text-xs" @click="app.servers.qz.running ? app.stopServer('qz') : app.startServer('qz')">
          <Icon name="power" :size="14" /> {{ app.servers.qz.running ? 'Arresta' : 'Avvia' }}
        </button>
      </div>

      <div class="glass p-5">
        <div class="flex items-center gap-2 text-slate-400 text-sm mb-3"><Icon name="server" :size="16" /> API locale</div>
        <p class="text-2xl font-bold" :class="app.servers.api.running ? 'text-emerald-400' : 'text-slate-500'">
          {{ app.servers.api.running ? 'Attiva' : 'Spenta' }}
        </p>
        <p class="text-xs text-slate-500 mt-1 font-mono">http://127.0.0.1:{{ app.servers.api.port }}/api</p>
        <button class="btn-ghost w-full mt-3 text-xs" @click="app.servers.api.running ? app.stopServer('api') : app.startServer('api')">
          <Icon name="power" :size="14" /> {{ app.servers.api.running ? 'Arresta' : 'Avvia' }}
        </button>
      </div>
    </div>

    <div class="glass overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div class="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Icon name="terminal" :size="16" /> Log di sistema
        </div>
        <div class="flex items-center gap-2">
          <select v-model="levelFilter" class="input w-32 py-1.5 text-xs">
            <option value="all">Tutti</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button class="btn-ghost text-xs" @click="exportLogs"><Icon name="download" :size="14" /> Esporta</button>
          <button class="btn-ghost text-xs" @click="app.clearLogs()"><Icon name="trash" :size="14" /> Pulisci</button>
        </div>
      </div>
      <div class="max-h-[460px] overflow-y-auto p-4 font-mono text-xs space-y-1 bg-ink-950/40">
        <div v-for="log in filteredLogs" :key="log.id" class="flex gap-3">
          <span class="text-slate-600 shrink-0">{{ formatTime(log.ts) }}</span>
          <span class="shrink-0 w-16 uppercase" :class="levelColor[log.level]">{{ log.level }}</span>
          <span class="text-slate-500 shrink-0">({{ log.scope }})</span>
          <span class="text-slate-300 break-all">{{ log.message }}</span>
        </div>
        <div v-if="!filteredLogs.length" class="text-slate-600 text-center py-8">Nessun log</div>
      </div>
    </div>
  </div>
</template>
