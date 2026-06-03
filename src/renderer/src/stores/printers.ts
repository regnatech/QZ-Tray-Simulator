import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ErrorKind, Printer, PrinterInput, SimulatedError } from '@shared/types'
import type { PrinterWithRuntime } from '@shared/ipc'
import { api } from '../lib/api'

export const usePrintersStore = defineStore('printers', () => {
  const printers = ref<PrinterWithRuntime[]>([])
  const errors = ref<SimulatedError[]>([])
  const loading = ref(false)
  /** Transient last-effect markers used to trigger card animations. */
  const effects = ref<Record<string, { type: 'cut' | 'drawer' | 'beep'; at: number }>>({})

  const online = computed(() => printers.value.filter((p) => p.status === 'online'))
  const totalQueue = computed(() => printers.value.reduce((n, p) => n + p.queue, 0))

  function byId(id: string): PrinterWithRuntime | undefined {
    return printers.value.find((p) => p.id === id)
  }

  async function load(): Promise<void> {
    loading.value = true
    try {
      printers.value = await api.printers.list()
      errors.value = await api.errors.list()
    } finally {
      loading.value = false
    }
  }

  async function create(input: PrinterInput): Promise<Printer> {
    const p = await api.printers.create(input)
    await load()
    return p
  }
  async function update(id: string, patch: Partial<PrinterInput>): Promise<void> {
    await api.printers.update(id, patch)
  }
  async function remove(id: string): Promise<void> {
    await api.printers.remove(id)
  }
  async function duplicate(id: string): Promise<void> {
    await api.printers.duplicate(id)
    await load()
  }
  async function setEnabled(id: string, enabled: boolean): Promise<void> {
    await api.printers.setEnabled(id, enabled)
  }

  async function setError(printerId: string, kind: ErrorKind, active: boolean, message = ''): Promise<void> {
    await api.errors.set(printerId, kind, active, message)
    errors.value = await api.errors.list()
  }
  async function clearErrors(printerId: string): Promise<void> {
    await api.errors.clear(printerId)
    errors.value = await api.errors.list()
  }
  function activeErrors(printerId: string): SimulatedError[] {
    return errors.value.filter((e) => e.printerId === printerId && e.active)
  }

  /* ---- realtime patches (called from the app store event dispatcher) ---- */

  function applyPrinterUpdate(p: Printer): void {
    const existing = byId(p.id)
    if (existing) Object.assign(existing, p)
    else void load()
  }
  function applyPrinterRemoved(id: string): void {
    printers.value = printers.value.filter((p) => p.id !== id)
  }
  function onJobNew(printerId: string): void {
    const p = byId(printerId)
    if (p) p.queue += 1
  }
  function onJobDone(printerId: string): void {
    const p = byId(printerId)
    if (p && p.queue > 0) p.queue -= 1
  }
  function onHistory(printerId: string, at: number): void {
    const p = byId(printerId)
    if (p) {
      p.jobsReceived += 1
      p.lastPrintAt = at
      if (p.queue > 0) p.queue -= 1
    }
  }
  function markEffect(printerId: string, type: 'cut' | 'drawer' | 'beep'): void {
    effects.value = { ...effects.value, [printerId]: { type, at: Date.now() } }
  }

  return {
    printers,
    errors,
    loading,
    effects,
    online,
    totalQueue,
    byId,
    load,
    create,
    update,
    remove,
    duplicate,
    setEnabled,
    setError,
    clearErrors,
    activeErrors,
    applyPrinterUpdate,
    applyPrinterRemoved,
    onJobNew,
    onJobDone,
    onHistory,
    markEffect
  }
})
