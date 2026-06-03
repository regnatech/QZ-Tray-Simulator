import type {
  AppEvent,
  AppSettings,
  ErrorKind,
  HistoryEntry,
  LogEntry,
  Printer,
  PrinterInput,
  PrintResult,
  ServerInfo,
  SimulatedError,
  SimulationState,
  StatsSummary,
  TrafficRate
} from './types'

export const IPC_INVOKE = 'clicketta:invoke'
export const IPC_EVENT = 'clicketta:event'

export interface PrinterWithRuntime extends Printer {
  queue: number
  jobsReceived: number
  lastPrintAt: number | null
}

export interface HistoryQueryDto {
  printerId?: string
  search?: string
  from?: number
  to?: number
  limit?: number
  offset?: number
}

/** The surface exposed to the renderer through the preload context bridge. */
export interface ClickettaApi {
  printers: {
    list(): Promise<PrinterWithRuntime[]>
    get(id: string): Promise<Printer | null>
    create(input: PrinterInput): Promise<Printer>
    update(id: string, patch: Partial<PrinterInput>): Promise<Printer | null>
    remove(id: string): Promise<void>
    duplicate(id: string): Promise<Printer | null>
    setEnabled(id: string, enabled: boolean): Promise<Printer | null>
  }
  print(printer: string, data: string, encoding?: 'base64' | 'plain'): Promise<PrintResult>
  history: {
    list(query?: HistoryQueryDto): Promise<HistoryEntry[]>
    get(id: string): Promise<HistoryEntry | null>
    count(): Promise<number>
    exportData(format: 'json' | 'csv' | 'pdf', query?: HistoryQueryDto): Promise<string>
  }
  errors: {
    list(): Promise<SimulatedError[]>
    set(printerId: string, kind: ErrorKind, active: boolean, message?: string): Promise<void>
    clear(printerId: string): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    save(settings: AppSettings): Promise<AppSettings>
  }
  stats: {
    summary(): Promise<StatsSummary>
  }
  logs: {
    list(limit?: number): Promise<LogEntry[]>
    clear(): Promise<void>
    exportData(): Promise<string>
  }
  servers: {
    info(): Promise<ServerInfo>
    start(which: 'api' | 'qz' | 'all'): Promise<ServerInfo>
    stop(which: 'api' | 'qz' | 'all'): Promise<ServerInfo>
  }
  simulation: {
    state(): Promise<SimulationState>
    start(rate: TrafficRate, printerIds: string[]): Promise<SimulationState>
    stop(): Promise<SimulationState>
  }
  system: {
    info(): Promise<{
      version: string
      platform: string
      electron: string
      node: string
      dbPath: string
    }>
  }
  onEvent(cb: (event: AppEvent) => void): () => void
}

/** Method routing keys used by the single-channel invoke bridge. */
export type IpcMethod =
  | 'printers.list'
  | 'printers.get'
  | 'printers.create'
  | 'printers.update'
  | 'printers.remove'
  | 'printers.duplicate'
  | 'printers.setEnabled'
  | 'print'
  | 'history.list'
  | 'history.get'
  | 'history.count'
  | 'history.export'
  | 'errors.list'
  | 'errors.set'
  | 'errors.clear'
  | 'settings.get'
  | 'settings.save'
  | 'stats.summary'
  | 'logs.list'
  | 'logs.clear'
  | 'logs.export'
  | 'servers.info'
  | 'servers.start'
  | 'servers.stop'
  | 'simulation.state'
  | 'simulation.start'
  | 'simulation.stop'
  | 'system.info'
