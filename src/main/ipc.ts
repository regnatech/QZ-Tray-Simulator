import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { AppSettings, PrinterInput, TrafficRate } from '@shared/types'
import { IPC_EVENT, IPC_INVOKE, type HistoryQueryDto, type IpcMethod } from '@shared/ipc'
import type { AppContext } from './context'
import {
  historyToCsv,
  historyToJson,
  historyToPdf,
  logsToText
} from './export/serializers'

type Handler = (...args: unknown[]) => unknown | Promise<unknown>

/** Register the single-channel invoke router and the event broadcaster. */
export function registerIpc(ctx: AppContext): void {
  const { manager, simulator, store, log } = ctx

  const handlers: Record<IpcMethod, Handler> = {
    'printers.list': () =>
      manager.listPrinters().map((p) => {
        const rt = manager.getRuntime(p.id)
        return { ...p, queue: rt.queue, jobsReceived: rt.jobsReceived, lastPrintAt: rt.lastPrintAt }
      }),
    'printers.get': (id) => manager.listPrinters().find((p) => p.id === id) ?? null,
    'printers.create': (input) => manager.createPrinter(input as PrinterInput),
    'printers.update': (id, patch) => manager.updatePrinter(id as string, patch as Partial<PrinterInput>),
    'printers.remove': (id) => {
      manager.removePrinter(id as string)
      return null
    },
    'printers.duplicate': (id) => manager.duplicatePrinter(id as string),
    'printers.setEnabled': (id, enabled) => manager.setEnabled(id as string, enabled as boolean),

    print: async (printer, data, encoding) => {
      const bytes =
        encoding === 'plain'
          ? new TextEncoder().encode(data as string)
          : new Uint8Array(Buffer.from(data as string, 'base64'))
      return manager.submitPrint(printer as string, bytes, { source: 'manual' })
    },

    'history.list': (query) => store.listHistory((query as HistoryQueryDto) ?? { limit: 100 }),
    'history.get': (id) => store.getHistory(id as string),
    'history.count': () => store.countHistory(),
    'history.export': (format, query) =>
      exportHistory(ctx, format as 'json' | 'csv' | 'pdf', (query as HistoryQueryDto) ?? {}),

    'errors.list': () => store.listErrors(),
    'errors.set': (printerId, kind, active, message) => {
      manager.setError(printerId as string, kind as never, active as boolean, (message as string) ?? '')
      return null
    },
    'errors.clear': (printerId) => {
      store.clearErrors(printerId as string)
      const p = store.getPrinter(printerId as string)
      if (p) manager.updatePrinter(p.id, {})
      return null
    },

    'settings.get': () => store.getSettings(),
    'settings.save': async (settings) => {
      const saved = store.saveSettings(settings as AppSettings)
      log.setLevel(saved.logLevel)
      // Apply server changes.
      await ctx.stopServers('all')
      await ctx.startServers('all', saved)
      return saved
    },

    'stats.summary': () => store.statsSummary(),

    'logs.list': (limit) => store.listLogs((limit as number) ?? 500),
    'logs.clear': () => {
      store.clearLogs()
      return null
    },
    'logs.export': () => exportLogs(ctx),

    'servers.info': () => ctx.serverInfo(),
    'servers.start': async (which) => {
      await ctx.startServers(which as 'api' | 'qz' | 'all')
      return ctx.serverInfo()
    },
    'servers.stop': async (which) => {
      await ctx.stopServers(which as 'api' | 'qz' | 'all')
      return ctx.serverInfo()
    },

    'simulation.state': () => simulator.getState(),
    'simulation.start': (rate, printerIds) =>
      simulator.start(rate as TrafficRate, (printerIds as string[]) ?? []),
    'simulation.stop': () => simulator.stop(),

    'system.info': () => ({
      version: app.getVersion(),
      platform: process.platform,
      electron: process.versions.electron ?? '',
      node: process.versions.node ?? '',
      dbPath: ctx.dbPath
    })
  }

  ipcMain.handle(IPC_INVOKE, async (_evt, method: IpcMethod, ...args: unknown[]) => {
    const handler = handlers[method]
    if (!handler) throw new Error(`Unknown IPC method: ${method}`)
    return handler(...args)
  })

  // Broadcast every domain event to all renderer windows.
  ctx.bus.onEvent((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC_EVENT, event)
    }
  })
}

async function exportHistory(
  ctx: AppContext,
  format: 'json' | 'csv' | 'pdf',
  query: HistoryQueryDto
): Promise<string> {
  const entries = ctx.store.listHistory({ ...query, limit: query.limit ?? 100000 })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const defaultName = `clicketta-storico-${stamp}.${format}`
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    defaultPath: join(app.getPath('downloads'), defaultName)
  })
  if (canceled || !filePath) return ''

  if (format === 'json') await writeFile(filePath, historyToJson(entries), 'utf8')
  else if (format === 'csv') await writeFile(filePath, historyToCsv(entries), 'utf8')
  else await writeFile(filePath, historyToPdf(entries))

  ctx.log.info('export', `Exported ${entries.length} entries to ${filePath}`)
  return filePath
}

async function exportLogs(ctx: AppContext): Promise<string> {
  const logs = ctx.store.listLogs(100000)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    defaultPath: join(app.getPath('downloads'), `clicketta-logs-${stamp}.log`)
  })
  if (canceled || !filePath) return ''
  await writeFile(filePath, logsToText(logs), 'utf8')
  return filePath
}
