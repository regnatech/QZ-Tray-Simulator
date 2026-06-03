import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent } from '@shared/types'
import { IPC_EVENT, IPC_INVOKE, type ClickettaApi, type IpcMethod } from '@shared/ipc'

/**
 * Strip Vue reactivity (and any other non-cloneable wrapper) from arguments so
 * they survive Electron's structured-clone IPC boundary. Every argument we send
 * is a plain JSON-serialisable DTO, so a JSON round-trip is both safe and cheap.
 */
function sanitize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

const invoke = <T>(method: IpcMethod, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(IPC_INVOKE, method, ...args.map(sanitize)) as Promise<T>

const api: ClickettaApi = {
  printers: {
    list: () => invoke('printers.list'),
    get: (id) => invoke('printers.get', id),
    create: (input) => invoke('printers.create', input),
    update: (id, patch) => invoke('printers.update', id, patch),
    remove: (id) => invoke('printers.remove', id),
    duplicate: (id) => invoke('printers.duplicate', id),
    setEnabled: (id, enabled) => invoke('printers.setEnabled', id, enabled)
  },
  print: (printer, data, encoding = 'base64') => invoke('print', printer, data, encoding),
  history: {
    list: (query) => invoke('history.list', query),
    get: (id) => invoke('history.get', id),
    count: () => invoke('history.count'),
    exportData: (format, query) => invoke('history.export', format, query)
  },
  errors: {
    list: () => invoke('errors.list'),
    set: (printerId, kind, active, message) => invoke('errors.set', printerId, kind, active, message),
    clear: (printerId) => invoke('errors.clear', printerId)
  },
  settings: {
    get: () => invoke('settings.get'),
    save: (settings) => invoke('settings.save', settings)
  },
  stats: {
    summary: () => invoke('stats.summary')
  },
  logs: {
    list: (limit) => invoke('logs.list', limit),
    clear: () => invoke('logs.clear'),
    exportData: () => invoke('logs.export')
  },
  servers: {
    info: () => invoke('servers.info'),
    start: (which) => invoke('servers.start', which),
    stop: (which) => invoke('servers.stop', which)
  },
  simulation: {
    state: () => invoke('simulation.state'),
    start: (rate, printerIds) => invoke('simulation.start', rate, printerIds),
    stop: () => invoke('simulation.stop')
  },
  system: {
    info: () => invoke('system.info')
  },
  onEvent: (cb: (event: AppEvent) => void) => {
    const listener = (_e: unknown, event: AppEvent): void => cb(event)
    ipcRenderer.on(IPC_EVENT, listener)
    return () => ipcRenderer.off(IPC_EVENT, listener)
  }
}

contextBridge.exposeInMainWorld('clicketta', api)
