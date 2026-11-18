import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppEvent, LogEntry, NetworkListenerInfo, Printer, ServerInfo, ServerKind } from '@shared/types'
import { api } from '../lib/api'
import { playBeep, playCut, playDrawer } from '../lib/sound'
import { usePrintersStore } from './printers'
import { useHistoryStore } from './history'
import { useStatisticsStore } from './statistics'
import { useSimulationStore } from './simulation'
import { useSettingsStore } from './settings'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'warning' | 'error'
  message: string
}

let toastSeq = 0
let statsTimer: ReturnType<typeof setTimeout> | null = null

export const useAppStore = defineStore('app', () => {
  const ready = ref(false)
  const logs = ref<LogEntry[]>([])
  const toasts = ref<Toast[]>([])
  const servers = ref<ServerInfo>({
    api: { running: false, port: 8183 },
    qz: { running: false, port: 8182 },
    network: { running: false, listeners: [], addresses: [] }
  })
  const systemInfo = ref<{ version: string; platform: string; electron: string; node: string; dbPath: string }>({
    version: '',
    platform: '',
    electron: '',
    node: '',
    dbPath: ''
  })
  let unsubscribe: (() => void) | null = null

  function toast(kind: Toast['kind'], message: string): void {
    const id = ++toastSeq
    toasts.value.push({ id, kind, message })
    setTimeout(() => dismiss(id), 4200)
  }
  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  /** Debounced statistics refresh so heavy traffic doesn't hammer the backend. */
  function scheduleStats(): void {
    if (statsTimer) return
    statsTimer = setTimeout(() => {
      statsTimer = null
      void useStatisticsStore().load()
    }, 1200)
  }

  function handleEvent(event: AppEvent): void {
    const printers = usePrintersStore()
    const history = useHistoryStore()
    const simulation = useSimulationStore()
    const settings = useSettingsStore().settings

    switch (event.type) {
      case 'printer:updated':
        printers.applyPrinterUpdate(event.printer)
        break
      case 'printer:removed':
        printers.applyPrinterRemoved(event.id)
        break
      case 'job:new':
        printers.onJobNew(event.printerId)
        break
      case 'job:update':
        if (event.job.status === 'done' || event.job.status === 'error') printers.onJobDone(event.job.printerId)
        break
      case 'history:new':
        printers.onHistory(event.entry.printerId, event.entry.createdAt)
        history.prepend(event.entry)
        scheduleStats()
        break
      case 'effect':
        printers.markEffect(event.printerId, event.effect)
        if (settings.soundEnabled) {
          if (event.effect === 'beep' && settings.beepSound) playBeep()
          if (event.effect === 'drawer' && settings.drawerSound) playDrawer()
          if (event.effect === 'cut') playCut()
        }
        break
      case 'log':
        logs.value = [event.entry, ...logs.value].slice(0, 1000)
        if (event.entry.level === 'error') toast('error', event.entry.message)
        break
      case 'servers':
        servers.value = event.info
        break
      case 'simulation':
        simulation.apply(event.state)
        break
    }
  }

  async function init(): Promise<void> {
    if (ready.value) return
    const settings = useSettingsStore()
    await settings.load()
    await Promise.all([
      usePrintersStore().load(),
      useHistoryStore().load(),
      useStatisticsStore().load(),
      useSimulationStore().load()
    ])
    servers.value = await api.servers.info()
    systemInfo.value = await api.system.info()
    logs.value = await api.logs.list(300)
    unsubscribe = api.onEvent(handleEvent)
    ready.value = true
  }

  async function startServer(which: ServerKind): Promise<void> {
    servers.value = await api.servers.start(which)
  }
  async function stopServer(which: ServerKind): Promise<void> {
    servers.value = await api.servers.stop(which)
  }
  function networkListener(printerId: string): NetworkListenerInfo | undefined {
    return servers.value.network.listeners.find((l) => l.printerId === printerId)
  }
  /** Address a POS should use to reach the printer, e.g. "192.168.1.20:9100". */
  function networkAddress(printer: Pick<Printer, 'id' | 'networkHost' | 'networkPort'>): string {
    const port = networkListener(printer.id)?.port ?? printer.networkPort
    const anyHost = printer.networkHost === '0.0.0.0' || printer.networkHost === ''
    const host = anyHost ? (servers.value.network.addresses[0] ?? '127.0.0.1') : printer.networkHost
    return `${host}:${port}`
  }
  async function clearLogs(): Promise<void> {
    await api.logs.clear()
    logs.value = []
  }

  function dispose(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    ready,
    logs,
    toasts,
    servers,
    networkListener,
    networkAddress,
    systemInfo,
    toast,
    dismiss,
    init,
    startServer,
    stopServer,
    clearLogs,
    dispose
  }
})
