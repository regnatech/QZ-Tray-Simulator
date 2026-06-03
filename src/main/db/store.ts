import type {
  AppSettings,
  ErrorKind,
  HistoryEntry,
  LogEntry,
  Printer,
  PrintJob,
  SimulatedError,
  StatsSummary
} from '@shared/types'

export interface HistoryQuery {
  printerId?: string
  search?: string
  from?: number
  to?: number
  limit?: number
  offset?: number
}

/**
 * Persistence abstraction. The app uses {@link SqliteStore}; unit tests use the
 * in-memory implementation so business logic can be verified without the native
 * better-sqlite3 binary (which is compiled against Electron's ABI at runtime).
 */
export interface Store {
  // printers
  listPrinters(): Printer[]
  getPrinter(id: string): Printer | null
  getPrinterByIdentifier(identifier: string): Printer | null
  upsertPrinter(printer: Printer): Printer
  removePrinter(id: string): void

  // jobs
  createJob(job: PrintJob): PrintJob
  updateJob(job: PrintJob): PrintJob
  listJobs(printerId: string): PrintJob[]

  // history
  addHistory(entry: HistoryEntry): HistoryEntry
  listHistory(query: HistoryQuery): HistoryEntry[]
  getHistory(id: string): HistoryEntry | null
  countHistory(): number

  // errors
  listErrors(): SimulatedError[]
  listActiveErrors(printerId: string): SimulatedError[]
  setError(printerId: string, kind: ErrorKind, active: boolean, message: string): SimulatedError
  clearErrors(printerId: string): void

  // settings
  getSettings(): AppSettings
  saveSettings(settings: AppSettings): AppSettings

  // statistics
  statsSummary(): StatsSummary

  // logs
  addLog(entry: LogEntry): void
  listLogs(limit?: number): LogEntry[]
  clearLogs(): void

  close(): void
}

export const DEFAULT_SETTINGS: AppSettings = {
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

const DAY = 24 * 60 * 60 * 1000

/** Shared statistics computation used by every Store implementation. */
export function computeStats(history: HistoryEntry[], printers: Printer[], errorCount: number): StatsSummary {
  const now = Date.now()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()

  let totalDuration = 0
  const perPrinterMap = new Map<string, number>()
  const dailyMap = new Map<string, number>()

  for (const h of history) {
    totalDuration += h.durationMs
    perPrinterMap.set(h.printerId, (perPrinterMap.get(h.printerId) ?? 0) + 1)
    const day = new Date(h.createdAt).toISOString().slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
  }

  const perPrinter = printers.map((p) => ({
    printerId: p.id,
    printerName: p.name,
    count: perPrinterMap.get(p.id) ?? 0
  }))

  const daily: Array<{ date: string; count: number }> = []
  for (let d = 13; d >= 0; d--) {
    const day = new Date(now - d * DAY).toISOString().slice(0, 10)
    daily.push({ date: day, count: dailyMap.get(day) ?? 0 })
  }

  return {
    totalJobs: history.length,
    totalToday: history.filter((h) => h.createdAt >= todayMs).length,
    totalWeek: history.filter((h) => h.createdAt >= now - 7 * DAY).length,
    totalMonth: history.filter((h) => h.createdAt >= now - 30 * DAY).length,
    avgDurationMs: history.length ? Math.round(totalDuration / history.length) : 0,
    totalErrors: errorCount,
    perPrinter,
    daily
  }
}
