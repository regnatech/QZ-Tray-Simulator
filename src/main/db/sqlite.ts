import Database from 'better-sqlite3'
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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS printers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  driver      TEXT NOT NULL DEFAULT '',
  language    TEXT NOT NULL DEFAULT 'ESC/POS',
  port        TEXT NOT NULL DEFAULT '',
  paper_width INTEGER NOT NULL DEFAULT 80,
  identifier  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'online',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT NOT NULL DEFAULT 'printer',
  paper_level INTEGER NOT NULL DEFAULT 100,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_identifier ON printers(identifier);

CREATE TABLE IF NOT EXISTS print_jobs (
  id          TEXT PRIMARY KEY,
  printer_id  TEXT NOT NULL,
  status      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  started_at  INTEGER,
  finished_at INTEGER,
  duration_ms INTEGER,
  raw_base64  TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_printer ON print_jobs(printer_id);

CREATE TABLE IF NOT EXISTS print_history (
  id           TEXT PRIMARY KEY,
  printer_id   TEXT NOT NULL,
  printer_name TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  duration_ms  INTEGER NOT NULL,
  bytes        INTEGER NOT NULL,
  raw_base64   TEXT NOT NULL,
  rendered     TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'qz'
);
CREATE INDEX IF NOT EXISTS idx_history_printer ON print_history(printer_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON print_history(created_at);

CREATE TABLE IF NOT EXISTS simulated_errors (
  id         TEXT PRIMARY KEY,
  printer_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 0,
  message    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_errors_printer ON simulated_errors(printer_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statistics (
  day        TEXT PRIMARY KEY,
  printer_id TEXT,
  count      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS logs (
  id      TEXT PRIMARY KEY,
  ts      INTEGER NOT NULL,
  level   TEXT NOT NULL,
  scope   TEXT NOT NULL,
  message TEXT NOT NULL,
  meta    TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
`

interface PrinterRow {
  id: string
  name: string
  description: string
  driver: string
  language: string
  port: string
  paper_width: number
  identifier: string
  enabled: number
  status: string
  color: string
  icon: string
  paper_level: number
  created_at: number
  updated_at: number
}

function rowToPrinter(r: PrinterRow): Printer {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    driver: r.driver,
    language: r.language as Printer['language'],
    port: r.port,
    paperWidth: r.paper_width as Printer['paperWidth'],
    identifier: r.identifier,
    enabled: !!r.enabled,
    status: r.status as Printer['status'],
    color: r.color,
    icon: r.icon,
    paperLevel: r.paper_level,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class SqliteStore implements Store {
  private db: Database.Database

  constructor(filename: string) {
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
  }

  listPrinters(): Printer[] {
    const rows = this.db
      .prepare('SELECT * FROM printers ORDER BY created_at ASC')
      .all() as PrinterRow[]
    return rows.map(rowToPrinter)
  }
  getPrinter(id: string): Printer | null {
    const r = this.db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as
      | PrinterRow
      | undefined
    return r ? rowToPrinter(r) : null
  }
  getPrinterByIdentifier(identifier: string): Printer | null {
    const r = this.db
      .prepare(
        'SELECT * FROM printers WHERE lower(identifier) = lower(?) OR lower(name) = lower(?) LIMIT 1'
      )
      .get(identifier, identifier) as PrinterRow | undefined
    return r ? rowToPrinter(r) : null
  }
  upsertPrinter(p: Printer): Printer {
    this.db
      .prepare(
        `INSERT INTO printers
          (id,name,description,driver,language,port,paper_width,identifier,enabled,status,color,icon,paper_level,created_at,updated_at)
         VALUES
          (@id,@name,@description,@driver,@language,@port,@paper_width,@identifier,@enabled,@status,@color,@icon,@paper_level,@created_at,@updated_at)
         ON CONFLICT(id) DO UPDATE SET
          name=@name, description=@description, driver=@driver, language=@language, port=@port,
          paper_width=@paper_width, identifier=@identifier, enabled=@enabled, status=@status,
          color=@color, icon=@icon, paper_level=@paper_level, updated_at=@updated_at`
      )
      .run({
        id: p.id,
        name: p.name,
        description: p.description,
        driver: p.driver,
        language: p.language,
        port: p.port,
        paper_width: p.paperWidth,
        identifier: p.identifier,
        enabled: p.enabled ? 1 : 0,
        status: p.status,
        color: p.color,
        icon: p.icon,
        paper_level: p.paperLevel,
        created_at: p.createdAt,
        updated_at: p.updatedAt
      })
    return p
  }
  removePrinter(id: string): void {
    this.db.prepare('DELETE FROM printers WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM print_jobs WHERE printer_id = ?').run(id)
    this.db.prepare('DELETE FROM simulated_errors WHERE printer_id = ?').run(id)
  }

  createJob(j: PrintJob): PrintJob {
    this.db
      .prepare(
        `INSERT INTO print_jobs (id,printer_id,status,created_at,started_at,finished_at,duration_ms,raw_base64,bytes,error)
         VALUES (@id,@printer_id,@status,@created_at,@started_at,@finished_at,@duration_ms,@raw_base64,@bytes,@error)`
      )
      .run(this.jobParams(j))
    return j
  }
  updateJob(j: PrintJob): PrintJob {
    this.db
      .prepare(
        `UPDATE print_jobs SET status=@status, started_at=@started_at, finished_at=@finished_at,
          duration_ms=@duration_ms, error=@error WHERE id=@id`
      )
      .run(this.jobParams(j))
    return j
  }
  private jobParams(j: PrintJob) {
    return {
      id: j.id,
      printer_id: j.printerId,
      status: j.status,
      created_at: j.createdAt,
      started_at: j.startedAt,
      finished_at: j.finishedAt,
      duration_ms: j.durationMs,
      raw_base64: j.rawBase64,
      bytes: j.bytes,
      error: j.error
    }
  }
  listJobs(printerId: string): PrintJob[] {
    const rows = this.db
      .prepare('SELECT * FROM print_jobs WHERE printer_id = ? ORDER BY created_at DESC LIMIT 200')
      .all(printerId) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as string,
      printerId: r.printer_id as string,
      status: r.status as PrintJob['status'],
      createdAt: r.created_at as number,
      startedAt: (r.started_at as number) ?? null,
      finishedAt: (r.finished_at as number) ?? null,
      durationMs: (r.duration_ms as number) ?? null,
      rawBase64: r.raw_base64 as string,
      bytes: r.bytes as number,
      error: (r.error as string) ?? null
    }))
  }

  addHistory(e: HistoryEntry): HistoryEntry {
    this.db
      .prepare(
        `INSERT INTO print_history (id,printer_id,printer_name,created_at,duration_ms,bytes,raw_base64,rendered,source)
         VALUES (@id,@printer_id,@printer_name,@created_at,@duration_ms,@bytes,@raw_base64,@rendered,@source)`
      )
      .run({
        id: e.id,
        printer_id: e.printerId,
        printer_name: e.printerName,
        created_at: e.createdAt,
        duration_ms: e.durationMs,
        bytes: e.bytes,
        raw_base64: e.rawBase64,
        rendered: e.rendered,
        source: e.source
      })
    return e
  }
  listHistory(query: HistoryQuery): HistoryEntry[] {
    const clauses: string[] = []
    const params: Record<string, unknown> = {}
    if (query.printerId) {
      clauses.push('printer_id = @printerId')
      params.printerId = query.printerId
    }
    if (query.from) {
      clauses.push('created_at >= @from')
      params.from = query.from
    }
    if (query.to) {
      clauses.push('created_at <= @to')
      params.to = query.to
    }
    if (query.search) {
      clauses.push('(printer_name LIKE @search OR rendered LIKE @search)')
      params.search = `%${query.search}%`
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    params.limit = query.limit ?? 100
    params.offset = query.offset ?? 0
    const rows = this.db
      .prepare(
        `SELECT * FROM print_history ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
      )
      .all(params) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as string,
      printerId: r.printer_id as string,
      printerName: r.printer_name as string,
      createdAt: r.created_at as number,
      durationMs: r.duration_ms as number,
      bytes: r.bytes as number,
      rawBase64: r.raw_base64 as string,
      rendered: r.rendered as string,
      source: r.source as HistoryEntry['source']
    }))
  }
  getHistory(id: string): HistoryEntry | null {
    const rows = this.listHistory({ limit: 1, offset: 0 })
    const direct = this.db.prepare('SELECT * FROM print_history WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!direct) return rows.find((r) => r.id === id) ?? null
    return {
      id: direct.id as string,
      printerId: direct.printer_id as string,
      printerName: direct.printer_name as string,
      createdAt: direct.created_at as number,
      durationMs: direct.duration_ms as number,
      bytes: direct.bytes as number,
      rawBase64: direct.raw_base64 as string,
      rendered: direct.rendered as string,
      source: direct.source as HistoryEntry['source']
    }
  }
  countHistory(): number {
    const r = this.db.prepare('SELECT COUNT(*) AS c FROM print_history').get() as { c: number }
    return r.c
  }

  listErrors(): SimulatedError[] {
    const rows = this.db.prepare('SELECT * FROM simulated_errors').all() as Array<
      Record<string, unknown>
    >
    return rows.map((r) => ({
      id: r.id as string,
      printerId: r.printer_id as string,
      kind: r.kind as ErrorKind,
      active: !!r.active,
      message: r.message as string,
      createdAt: r.created_at as number
    }))
  }
  listActiveErrors(printerId: string): SimulatedError[] {
    return this.listErrors().filter((e) => e.printerId === printerId && e.active)
  }
  setError(printerId: string, kind: ErrorKind, active: boolean, message: string): SimulatedError {
    const err: SimulatedError = {
      id: `${printerId}:${kind}`,
      printerId,
      kind,
      active,
      message: message || ERROR_LABELS[kind],
      createdAt: Date.now()
    }
    this.db
      .prepare(
        `INSERT INTO simulated_errors (id,printer_id,kind,active,message,created_at)
         VALUES (@id,@printer_id,@kind,@active,@message,@created_at)
         ON CONFLICT(id) DO UPDATE SET active=@active, message=@message, created_at=@created_at`
      )
      .run({
        id: err.id,
        printer_id: printerId,
        kind: err.kind,
        active: err.active ? 1 : 0,
        message: err.message,
        created_at: err.createdAt
      })
    return err
  }
  clearErrors(printerId: string): void {
    this.db.prepare('DELETE FROM simulated_errors WHERE printer_id = ?').run(printerId)
  }

  getSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string
      value: string
    }>
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (map.has(key)) {
        try {
          out[key] = JSON.parse(map.get(key)!)
        } catch {
          /* keep default */
        }
      }
    }
    return out as unknown as AppSettings
  }
  saveSettings(settings: AppSettings): AppSettings {
    const stmt = this.db.prepare(
      'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    )
    const tx = this.db.transaction((s: AppSettings) => {
      for (const [k, v] of Object.entries(s)) stmt.run(k, JSON.stringify(v))
    })
    tx(settings)
    return settings
  }

  statsSummary() {
    const history = this.listHistory({ limit: 100000, offset: 0 })
    return computeStats(history, this.listPrinters(), this.listErrors().filter((e) => e.active).length)
  }

  addLog(e: LogEntry): void {
    this.db
      .prepare('INSERT INTO logs (id,ts,level,scope,message,meta) VALUES (?,?,?,?,?,?)')
      .run(e.id, e.ts, e.level, e.scope, e.message, e.meta ? JSON.stringify(e.meta) : null)
  }
  listLogs(limit = 500): LogEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM logs ORDER BY ts DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r.id as string,
      ts: r.ts as number,
      level: r.level as LogEntry['level'],
      scope: r.scope as string,
      message: r.message as string,
      meta: r.meta ? (JSON.parse(r.meta as string) as Record<string, unknown>) : undefined
    }))
  }
  clearLogs(): void {
    this.db.prepare('DELETE FROM logs').run()
  }

  close(): void {
    this.db.close()
  }
}
