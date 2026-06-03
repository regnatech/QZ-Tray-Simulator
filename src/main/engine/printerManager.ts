import type {
  ErrorKind,
  HistoryEntry,
  Printer,
  PrinterInput,
  PrintJob,
  PrintResult,
  RenderDocument
} from '@shared/types'
import { ERROR_LABELS } from '@shared/types'
import type { Store } from '../db/store'
import { parseEscPos } from '../escpos/parser'
import { AppBus, genId } from '../core/bus'
import type { Logger } from '../core/logger'

/** Error kinds that block a print job entirely. */
const BLOCKING: Record<ErrorKind, boolean> = {
  paper_empty: true,
  offline: true,
  unreachable: true,
  cover_open: true,
  buffer_full: true,
  generic: true,
  paper_low: false
}

export interface PrinterRuntime {
  printerId: string
  queue: number
  jobsReceived: number
  lastPrintAt: number | null
}

export interface SubmitOptions {
  source?: HistoryEntry['source']
}

const PALETTE = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export class PrinterManager {
  private runtime = new Map<string, PrinterRuntime>()
  private chains = new Map<string, Promise<void>>()
  private fastMode = false

  constructor(
    private store: Store,
    private bus: AppBus,
    private log: Logger
  ) {}

  /** Disable artificial processing delays (used by the test-suite). */
  setFastMode(on: boolean): void {
    this.fastMode = on
  }

  seedIfEmpty(): void {
    if (this.store.listPrinters().length > 0) return
    const presets: Array<Partial<PrinterInput> & { name: string }> = [
      { name: 'Cucina', driver: 'Epson TM-T88V', port: 'USB001', icon: 'chef-hat', color: '#f59e0b' },
      { name: 'Bar', driver: 'Epson TM-T20III', port: 'USB002', icon: 'coffee', color: '#06b6d4' },
      { name: 'Cassa', driver: 'Star TSP143', port: 'USB003', icon: 'receipt', color: '#22c55e', paperWidth: 80 }
    ]
    for (const p of presets) {
      this.createPrinter({
        name: p.name,
        description: p.description ?? `Stampante ${p.name}`,
        driver: p.driver ?? 'Epson TM-T88V',
        language: 'ESC/POS',
        port: p.port ?? 'USB001',
        paperWidth: p.paperWidth ?? 80,
        identifier: p.name,
        enabled: true,
        color: p.color ?? '#6366f1',
        icon: p.icon ?? 'printer'
      })
    }
    this.log.info('engine', 'Seeded default virtual printers')
  }

  /* --------------------------- printer CRUD --------------------------- */

  listPrinters(): Printer[] {
    return this.store.listPrinters()
  }

  getRuntime(printerId: string): PrinterRuntime {
    let rt = this.runtime.get(printerId)
    if (!rt) {
      rt = { printerId, queue: 0, jobsReceived: 0, lastPrintAt: null }
      this.runtime.set(printerId, rt)
    }
    return rt
  }

  createPrinter(input: PrinterInput): Printer {
    const now = Date.now()
    const identifier = (input.identifier || input.name).trim()
    const printer: Printer = {
      id: genId('prn_'),
      name: input.name.trim(),
      description: input.description ?? '',
      driver: input.driver ?? 'Epson TM-T88V',
      language: input.language ?? 'ESC/POS',
      port: input.port ?? 'USB001',
      paperWidth: input.paperWidth ?? 80,
      identifier: this.uniqueIdentifier(identifier),
      enabled: input.enabled ?? true,
      status: input.enabled === false ? 'offline' : 'online',
      color: input.color || PALETTE[this.store.listPrinters().length % PALETTE.length],
      icon: input.icon || 'printer',
      paperLevel: input.paperLevel ?? 100,
      createdAt: now,
      updatedAt: now
    }
    this.store.upsertPrinter(printer)
    this.log.info('engine', `Created printer "${printer.name}" (${printer.identifier})`)
    this.bus.emitEvent({ type: 'printer:updated', printer })
    return printer
  }

  private uniqueIdentifier(base: string): string {
    let candidate = base
    let n = 2
    while (this.store.getPrinterByIdentifier(candidate)) {
      candidate = `${base}-${n++}`
    }
    return candidate
  }

  updatePrinter(id: string, patch: Partial<PrinterInput>): Printer | null {
    const existing = this.store.getPrinter(id)
    if (!existing) return null
    const updated: Printer = {
      ...existing,
      ...patch,
      identifier:
        patch.identifier && patch.identifier !== existing.identifier
          ? this.uniqueIdentifier(patch.identifier)
          : existing.identifier,
      status:
        patch.enabled === false
          ? 'offline'
          : patch.enabled === true && existing.status === 'offline'
            ? 'online'
            : existing.status,
      updatedAt: Date.now()
    }
    this.store.upsertPrinter(updated)
    this.bus.emitEvent({ type: 'printer:updated', printer: updated })
    this.log.info('engine', `Updated printer "${updated.name}"`)
    return updated
  }

  duplicatePrinter(id: string): Printer | null {
    const src = this.store.getPrinter(id)
    if (!src) return null
    return this.createPrinter({
      name: `${src.name} (copia)`,
      description: src.description,
      driver: src.driver,
      language: src.language,
      port: src.port,
      paperWidth: src.paperWidth,
      identifier: `${src.identifier}-copy`,
      enabled: src.enabled,
      color: src.color,
      icon: src.icon
    })
  }

  removePrinter(id: string): void {
    this.store.removePrinter(id)
    this.runtime.delete(id)
    this.bus.emitEvent({ type: 'printer:removed', id })
    this.log.info('engine', `Removed printer ${id}`)
  }

  setEnabled(id: string, enabled: boolean): Printer | null {
    return this.updatePrinter(id, { enabled })
  }

  /* ----------------------------- errors ----------------------------- */

  setError(printerId: string, kind: ErrorKind, active: boolean, message = ''): void {
    this.store.setError(printerId, kind, active, message)
    const printer = this.store.getPrinter(printerId)
    if (printer) {
      const blocking = this.store.listActiveErrors(printerId).some((e) => BLOCKING[e.kind])
      const next: Printer['status'] = blocking ? 'error' : printer.enabled ? 'online' : 'offline'
      if (next !== printer.status) {
        this.store.upsertPrinter({ ...printer, status: next, updatedAt: Date.now() })
        this.bus.emitEvent({ type: 'printer:updated', printer: { ...printer, status: next } })
      } else {
        this.bus.emitEvent({ type: 'printer:updated', printer })
      }
    }
    this.log.warning('engine', `Error "${ERROR_LABELS[kind]}" ${active ? 'enabled' : 'cleared'} on ${printerId}`)
  }

  /* ----------------------------- printing ----------------------------- */

  /**
   * Accept an ESC/POS payload for the printer identified by name or identifier.
   * Resolves once the (simulated) job has finished processing.
   */
  async submitPrint(
    identifier: string,
    bytes: Uint8Array,
    options: SubmitOptions = {}
  ): Promise<PrintResult> {
    const printer = this.store.getPrinterByIdentifier(identifier)
    if (!printer) {
      this.log.error('print', `No printer matches "${identifier}"`)
      return { ok: false, error: `Printer not found: ${identifier}` }
    }
    if (!printer.enabled) {
      return { ok: false, error: `Printer "${printer.name}" is disabled` }
    }

    const blocking = this.store.listActiveErrors(printer.id).find((e) => BLOCKING[e.kind])
    if (blocking) {
      this.log.error('print', `Rejected job for "${printer.name}": ${ERROR_LABELS[blocking.kind]}`)
      return { ok: false, error: ERROR_LABELS[blocking.kind] }
    }

    const job: PrintJob = {
      id: genId('job_'),
      printerId: printer.id,
      status: 'queued',
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      rawBase64: Buffer.from(bytes).toString('base64'),
      bytes: bytes.length,
      error: null
    }
    this.store.createJob(job)

    const rt = this.getRuntime(printer.id)
    rt.queue += 1
    this.bus.emitEvent({ type: 'job:new', job, printerId: printer.id })
    this.bus.emitEvent({ type: 'printer:updated', printer: { ...printer, status: 'busy' } })

    // Serialise jobs per-printer so the queue length is meaningful.
    const prev = this.chains.get(printer.id) ?? Promise.resolve()
    const run = prev.then(() => this.process(printer, bytes, job, options.source ?? 'qz'))
    this.chains.set(
      printer.id,
      run.then(
        () => undefined,
        () => undefined
      )
    )
    await run
    return { ok: true, jobId: job.id }
  }

  private async process(
    printer: Printer,
    bytes: Uint8Array,
    job: PrintJob,
    source: HistoryEntry['source']
  ): Promise<void> {
    const startedAt = Date.now()
    job.status = 'printing'
    job.startedAt = startedAt
    this.store.updateJob(job)
    this.bus.emitEvent({ type: 'job:update', job })

    const delay = this.fastMode ? 0 : Math.min(1500, 180 + Math.round(bytes.length / 12))
    if (delay > 0) await sleep(delay)

    let rendered: RenderDocument
    try {
      rendered = parseEscPos(bytes, { paperWidth: printer.paperWidth })
    } catch (err) {
      job.status = 'error'
      job.error = err instanceof Error ? err.message : String(err)
      job.finishedAt = Date.now()
      job.durationMs = job.finishedAt - startedAt
      this.store.updateJob(job)
      this.bus.emitEvent({ type: 'job:update', job })
      this.log.error('print', `Parse failed on "${printer.name}": ${job.error}`)
      this.afterJob(printer.id)
      return
    }

    const finishedAt = Date.now()
    job.status = 'done'
    job.finishedAt = finishedAt
    job.durationMs = finishedAt - startedAt
    this.store.updateJob(job)
    this.bus.emitEvent({ type: 'job:update', job })

    const entry: HistoryEntry = {
      id: genId('hist_'),
      printerId: printer.id,
      printerName: printer.name,
      createdAt: finishedAt,
      durationMs: job.durationMs,
      bytes: bytes.length,
      rawBase64: job.rawBase64,
      rendered: JSON.stringify(rendered),
      source
    }
    this.store.addHistory(entry)
    this.bus.emitEvent({ type: 'history:new', entry })

    // Side effects -> UI animations / sounds.
    if (rendered.effects.cut) this.bus.emitEvent({ type: 'effect', printerId: printer.id, effect: 'cut' })
    if (rendered.effects.drawerOpen)
      this.bus.emitEvent({ type: 'effect', printerId: printer.id, effect: 'drawer' })
    if (rendered.effects.beeps > 0)
      this.bus.emitEvent({ type: 'effect', printerId: printer.id, effect: 'beep' })

    // Consume simulated paper.
    const consumed = Math.min(5, 0.5 + bytes.length / 4000)
    const paperLevel = Math.max(0, +(printer.paperLevel - consumed).toFixed(1))
    const rt = this.getRuntime(printer.id)
    rt.jobsReceived += 1
    rt.lastPrintAt = finishedAt

    const updated: Printer = {
      ...printer,
      paperLevel,
      status: printer.enabled ? 'online' : 'offline',
      updatedAt: finishedAt
    }
    this.store.upsertPrinter(updated)
    this.bus.emitEvent({ type: 'printer:updated', printer: updated })
    this.log.info('print', `Printed ${bytes.length}B on "${printer.name}" in ${job.durationMs}ms`)
    this.afterJob(printer.id)
  }

  private afterJob(printerId: string): void {
    const rt = this.getRuntime(printerId)
    rt.queue = Math.max(0, rt.queue - 1)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
