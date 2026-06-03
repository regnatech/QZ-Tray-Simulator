import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@shared/types'
import { api } from '../lib/api'

const FALLBACK: AppSettings = {
  apiPort: 9100,
  qzPort: 8182,
  apiEnabled: true,
  qzEnabled: true,
  soundEnabled: true,
  theme: 'dark',
  paperAnimation: true,
  drawerSound: true,
  beepSound: true,
  autoStartServers: true,
  defaultPaperWidth: 80,
  logLevel: 'info'
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...FALLBACK })
  const loaded = ref(false)

  async function load(): Promise<void> {
    settings.value = await api.settings.get()
    loaded.value = true
  }

  async function save(next: AppSettings): Promise<void> {
    settings.value = await api.settings.save(next)
  }

  return { settings, loaded, load, save }
})
