import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '@shared/types'
import type { HistoryQueryDto } from '@shared/ipc'
import { api } from '../lib/api'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const filter = ref<HistoryQueryDto>({ limit: 100 })
  /** Most recent entry, surfaced for the live receipt viewer. */
  const latest = ref<HistoryEntry | null>(null)

  async function load(query?: HistoryQueryDto): Promise<void> {
    loading.value = true
    try {
      if (query) filter.value = { ...filter.value, ...query }
      entries.value = await api.history.list(filter.value)
      total.value = await api.history.count()
      if (!latest.value && entries.value.length) latest.value = entries.value[0]
    } finally {
      loading.value = false
    }
  }

  function prepend(entry: HistoryEntry): void {
    entries.value = [entry, ...entries.value].slice(0, Math.max(200, filter.value.limit ?? 100))
    total.value += 1
    latest.value = entry
  }

  async function exportData(format: 'json' | 'csv' | 'pdf'): Promise<string> {
    return api.history.exportData(format, filter.value)
  }

  return { entries, total, loading, filter, latest, load, prepend, exportData }
})
