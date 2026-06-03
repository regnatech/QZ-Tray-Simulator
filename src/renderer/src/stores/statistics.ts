import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StatsSummary } from '@shared/types'
import { api } from '../lib/api'

const EMPTY: StatsSummary = {
  totalJobs: 0,
  totalToday: 0,
  totalWeek: 0,
  totalMonth: 0,
  avgDurationMs: 0,
  totalErrors: 0,
  perPrinter: [],
  daily: []
}

export const useStatisticsStore = defineStore('statistics', () => {
  const summary = ref<StatsSummary>({ ...EMPTY })
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      summary.value = await api.stats.summary()
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, load }
})
