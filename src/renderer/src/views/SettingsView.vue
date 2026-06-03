<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import type { AppSettings, LogLevel, PaperWidth } from '@shared/types'
import Icon from '../components/ui/Icon.vue'
import Toggle from '../components/ui/Toggle.vue'
import { useSettingsStore } from '../stores/settings'
import { useAppStore } from '../stores/app'

const settingsStore = useSettingsStore()
const app = useAppStore()

const form = reactive<AppSettings>({ ...settingsStore.settings })

onMounted(async () => {
  await settingsStore.load()
  Object.assign(form, settingsStore.settings)
})
watch(() => settingsStore.settings, (s) => Object.assign(form, s))

async function save(): Promise<void> {
  await settingsStore.save({ ...form })
  app.toast('success', 'Impostazioni salvate · server riavviati')
}
async function toggleServer(which: 'api' | 'qz'): Promise<void> {
  const running = which === 'api' ? app.servers.api.running : app.servers.qz.running
  if (running) await app.stopServer(which)
  else await app.startServer(which)
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warning', 'error']
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <div class="glass p-6 space-y-5">
      <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
        <Icon name="server" :size="16" /> Server
      </h2>

      <div class="flex items-center justify-between glass-soft p-4">
        <div>
          <p class="text-sm font-medium text-white">QZ Tray compatibility (WebSocket)</p>
          <p class="text-xs text-slate-500">ws://127.0.0.1:{{ form.qzPort }} — rilevabile da qz.printers.find()</p>
        </div>
        <div class="flex items-center gap-3">
          <input v-model.number="form.qzPort" type="number" class="input w-24" />
          <button class="btn-ghost" @click="toggleServer('qz')">
            <Icon name="power" :size="14" /> {{ app.servers.qz.running ? 'Stop' : 'Start' }}
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between glass-soft p-4">
        <div>
          <p class="text-sm font-medium text-white">API HTTP locale</p>
          <p class="text-xs text-slate-500">http://127.0.0.1:{{ form.apiPort }}/api</p>
        </div>
        <div class="flex items-center gap-3">
          <input v-model.number="form.apiPort" type="number" class="input w-24" />
          <button class="btn-ghost" @click="toggleServer('api')">
            <Icon name="power" :size="14" /> {{ app.servers.api.running ? 'Stop' : 'Start' }}
          </button>
        </div>
      </div>

      <label class="flex items-center justify-between glass-soft p-4">
        <span class="text-sm text-slate-200">Avvia i server all'apertura</span>
        <Toggle v-model="form.autoStartServers" />
      </label>
    </div>

    <div class="glass p-6 space-y-4">
      <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
        <Icon name="bell" :size="16" /> Effetti e suoni
      </h2>
      <label class="flex items-center justify-between glass-soft p-4">
        <span class="text-sm text-slate-200">Suoni abilitati</span><Toggle v-model="form.soundEnabled" />
      </label>
      <label class="flex items-center justify-between glass-soft p-4">
        <span class="text-sm text-slate-200">Beep (ESC B)</span><Toggle v-model="form.beepSound" />
      </label>
      <label class="flex items-center justify-between glass-soft p-4">
        <span class="text-sm text-slate-200">Suono cassetto (ESC p)</span><Toggle v-model="form.drawerSound" />
      </label>
      <label class="flex items-center justify-between glass-soft p-4">
        <span class="text-sm text-slate-200">Animazione carta / taglio</span><Toggle v-model="form.paperAnimation" />
      </label>
    </div>

    <div class="glass p-6 space-y-4">
      <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
        <Icon name="settings" :size="16" /> Generale
      </h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Larghezza carta predefinita</label>
          <select v-model.number="form.defaultPaperWidth" class="input">
            <option :value="58 as PaperWidth">58 mm</option>
            <option :value="80 as PaperWidth">80 mm</option>
          </select>
        </div>
        <div>
          <label class="label">Livello di log</label>
          <select v-model="form.logLevel" class="input">
            <option v-for="l in LEVELS" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button class="btn-primary" data-testid="save-settings" @click="save">
        <Icon name="check" :size="16" /> Salva impostazioni
      </button>
    </div>
  </div>
</template>
