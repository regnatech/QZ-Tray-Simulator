import type {
  AppSettings,
  ErrorKind,
  HistoryEntry,
  LogEntry,
  Printer,
  PrintJob,
  SimulatedError
} from '@shared/types'
import { ERROR_LABELS } from '@shared/types'
import { computeStats, DEFAULT_SETTINGS, type HistoryQuery, type Store } from './store'

/** In-memory Store used by unit tests and as a fallback if SQLite is unavailable. */
export class MemoryStore implements Store {
  private printers = new Map<string, Printer>()
  private jobs = new Map<string, PrintJob>()
  private history: HistoryEntry[] = []
  private errors = new Map<string, SimulatedError>()
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private logs: LogEntry[] = []

  listPrinters(): Printer[] {
    return [...this.printers.values()].sort((a, b) => a.createdAt - b.createdAt)
  }
  getPrinter(id: string): Printer | null {
    return this.printers.get(id) ?? null
  }
  getPrinterByIdentifier(identifier: string): Printer | null {
    const id = identifier.toLowerCase()
    for (const p of this.printers.values()) {
      if (p.identifier.toLowerCase() === id || p.name.toLowerCase() === id) return p
    }
    return null
  }
  upsertPrinter(printer: Printer): Printer {
    this.printers.set(printer.id, printer)
    return printer
  }
  removePrinter(id: string): void {
    this.printers.delete(id)
  }

  createJob(job: PrintJob): PrintJob {
    this.jobs.set(job.id, job)
    return job
  }
  updateJob(job: PrintJob): PrintJob {
    this.jobs.set(job.id, job)
    return job
  }
  listJobs(printerId: string): PrintJob[] {
    return [...this.jobs.values()].filter((j) => j.printerId === printerId)
  }

  addHistory(entry: HistoryEntry): HistoryEntry {
    this.history.unshift(entry)
    return entry
  }
  listHistory(query: HistoryQuery): HistoryEntry[] {
    let rows = [...this.history]
    if (query.printerId) rows = rows.filter((h) => h.printerId === query.printerId)
    if (query.from) rows = rows.filter((h) => h.createdAt >= query.from!)
    if (query.to) rows = rows.filter((h) => h.createdAt <= query.to!)
    if (query.search) {
      const q = query.search.toLowerCase()
      rows = rows.filter(
        (h) => h.printerName.toLowerCase().includes(q) || h.rendered.toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => b.createdAt - a.createdAt)
    const offset = query.offset ?? 0
    const limit = query.limit ?? 100
    return rows.slice(offset, offset + limit)
  }
  getHistory(id: string): HistoryEntry | null {
    return this.history.find((h) => h.id === id) ?? null
  }
  countHistory(): number {
    return this.history.length
  }

  listErrors(): SimulatedError[] {
    return [...this.errors.values()]
  }
  listActiveErrors(printerId: string): SimulatedError[] {
    return [...this.errors.values()].filter((e) => e.printerId === printerId && e.active)
  }
  setError(printerId: string, kind: ErrorKind, active: boolean, message: string): SimulatedError {
    const key = `${printerId}:${kind}`
    const err: SimulatedError = {
      id: key,
      printerId,
      kind,
      active,
      message: message || ERROR_LABELS[kind],
      createdAt: Date.now()
    }
    this.errors.set(key, err)
    return err
  }
  clearErrors(printerId: string): void {
    for (const [k, e] of this.errors) if (e.printerId === printerId) this.errors.delete(k)
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }
  saveSettings(settings: AppSettings): AppSettings {
    this.settings = { ...settings }
    return this.settings
  }

  statsSummary() {
    return computeStats(this.history, this.listPrinters(), this.listErrors().filter((e) => e.active).length)
  }

  addLog(entry: LogEntry): void {
    this.logs.unshift(entry)
    if (this.logs.length > 5000) this.logs.length = 5000
  }
  listLogs(limit = 500): LogEntry[] {
    return this.logs.slice(0, limit)
  }
  clearLogs(): void {
    this.logs = []
  }

  close(): void {
    /* no-op */
  }
}
