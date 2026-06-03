import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SimulationState, TrafficRate } from '@shared/types'
import { api } from '../lib/api'

export const useSimulationStore = defineStore('simulation', () => {
  const state = ref<SimulationState>({
    running: false,
    rate: 10,
    printerIds: [],
    generated: 0,
    startedAt: null
  })

  async function load(): Promise<void> {
    state.value = await api.simulation.state()
  }
  async function start(rate: TrafficRate, printerIds: string[]): Promise<void> {
    state.value = await api.simulation.start(rate, printerIds)
  }
  async function stop(): Promise<void> {
    state.value = await api.simulation.stop()
  }
  function apply(next: SimulationState): void {
    state.value = next
  }

  return { state, load, start, stop, apply }
})
