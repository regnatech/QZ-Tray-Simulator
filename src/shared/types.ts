/**
 * Shared domain types used across the main process, preload bridge and renderer.
 * Keep this file free of any Node/Electron/Browser specific imports so it can be
 * consumed from every layer (and from unit tests).
 */

export type PaperWidth = 58 | 80

export type PrinterStatus = 'online' | 'offline' | 'error' | 'busy'

export type ErrorKind =
  | 'paper_empty'
  | 'paper_low'
  | 'offline'
  | 'unreachable'
  | 'cover_open'
  | 'buffer_full'
  | 'generic'

export interface Printer {
  id: string
  name: string
  description: string
  /** Simulated driver, e.g. "Epson TM-T88V". */
  driver: string
  /** Emulation language. Currently only ESC/POS is simulated. */
  language: 'ESC/POS' | 'StarPRNT'
  /** Simulated connection port, e.g. "USB001". */
  port: string
  paperWidth: PaperWidth
  /** Identifier exposed via the QZ Tray compatibility layer (qz.printers.find). */
  identifier: string
  enabled: boolean
  status: PrinterStatus
  /** Accent color (hex) used to brand the printer in the UI. */
  color: string
  /** Lucide-style icon name. */
  icon: string
  /** Simulated remaining paper, 0..100 (%). */
  paperLevel: number
  /** Expose the printer as a raw TCP (JetDirect / port 9100) network printer. */
  networkEnabled: boolean
  /** Bind address of the network listener ("0.0.0.0" = every interface). */
  networkHost: string
  /** TCP port of the network listener (9100 on real hardware). */
  networkPort: number
  createdAt: number
  updatedAt: number
}

export type PrinterInput = Omit<
  Printer,
  | 'id'
  | 'status'
  | 'paperLevel'
  | 'networkEnabled'
  | 'networkHost'
  | 'networkPort'
  | 'createdAt'
  | 'updatedAt'
> &
  Partial<Pick<Printer, 'status' | 'paperLevel' | 'networkEnabled' | 'networkHost' | 'networkPort'>>

export type JobStatus = 'queued' | 'printing' | 'done' | 'error'

export interface PrintJob {
  id: string
  printerId: string
  status: JobStatus
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  /** Processing duration in milliseconds. */
  durationMs: number | null
  /** Base64 of the raw ESC/POS payload. */
  rawBase64: string
  bytes: number
  error: string | null
}

export interface HistoryEntry {
  id: string
  printerId: string
  printerName: string
  createdAt: number
  durationMs: number
  bytes: number
  rawBase64: string
  /** Serialized rendered document (RenderDocument as JSON). */
  rendered: string
  source: 'qz' | 'api' | 'network' | 'manual' | 'simulation'
}

export interface SimulatedError {
  id: string
  printerId: string
  kind: ErrorKind
  active: boolean
  message: string
  createdAt: number
}

export interface AppSettings {
  apiPort: number
  qzPort: number
  apiEnabled: boolean
  qzEnabled: boolean
  /** Master switch for the per-printer raw TCP network listeners. */
  networkEnabled: boolean
  soundEnabled: boolean
  theme: 'dark' | 'midnight'
  paperAnimation: boolean
  drawerSound: boolean
  beepSound: boolean
  autoStartServers: boolean
  defaultPaperWidth: PaperWidth
  logLevel: LogLevel
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error'

export interface LogEntry {
  id: string
  ts: number
  level: LogLevel
  scope: string
  message: string
  meta?: Record<string, unknown>
}

/* ----------------------------- ESC/POS rendering ----------------------------- */

export type Alignment = 'left' | 'center' | 'right'

export interface TextStyle {
  bold: boolean
  underline: boolean
  doubleWidth: boolean
  doubleHeight: boolean
  invert: boolean
  align: Alignment
  /** Font A (default) or Font B (condensed). */
  font: 'A' | 'B'
}

export interface TextNode {
  type: 'text'
  text: string
  style: TextStyle
}

export interface BarcodeNode {
  type: 'barcode'
  data: string
  symbology: string
  align: Alignment
  width: number
  height: number
  hri: boolean
}

export interface QRCodeNode {
  type: 'qrcode'
  data: string
  align: Alignment
  /** Module size 1..16. */
  size: number
}

export interface ImageNode {
  type: 'image'
  /** Monochrome bitmap rows packed as a 2D array of 0/1. */
  width: number
  height: number
  pixels: number[]
  align: Alignment
}

export interface RuleNode {
  type: 'rule'
}

export interface FeedNode {
  type: 'feed'
  lines: number
}

export interface CutNode {
  type: 'cut'
  partial: boolean
}

export interface DrawerNode {
  type: 'drawer'
}

export interface BeepNode {
  type: 'beep'
  count: number
}

export type RenderNode =
  | TextNode
  | BarcodeNode
  | QRCodeNode
  | ImageNode
  | RuleNode
  | FeedNode
  | CutNode
  | DrawerNode
  | BeepNode

export interface RenderDocument {
  paperWidth: PaperWidth
  /** Characters per line for the active base font (A). */
  columns: number
  nodes: RenderNode[]
  /** Side effects detected during parsing. */
  effects: {
    cut: boolean
    drawerOpen: boolean
    beeps: number
  }
}

/* ------------------------------- Statistics ------------------------------- */

export interface StatsSummary {
  totalJobs: number
  totalToday: number
  totalWeek: number
  totalMonth: number
  avgDurationMs: number
  totalErrors: number
  perPrinter: Array<{ printerId: string; printerName: string; count: number }>
  daily: Array<{ date: string; count: number }>
}

/* ------------------------------ Simulation ------------------------------ */

export type TrafficRate = 10 | 50 | 100 | 500

export interface SimulationState {
  running: boolean
  rate: TrafficRate
  printerIds: string[]
  generated: number
  startedAt: number | null
}

/* ----------------------------- IPC contracts ----------------------------- */

export interface PrintRequest {
  printerIdentifier: string
  /** Base64 ESC/POS payload OR plain text (auto-detected). */
  data: string
  encoding?: 'base64' | 'plain'
  source?: HistoryEntry['source']
}

export interface PrintResult {
  ok: boolean
  jobId?: string
  error?: string
}

export interface NetworkListenerInfo {
  printerId: string
  host: string
  /** Port actually bound (differs from the configured one only when that is 0). */
  port: number
  listening: boolean
  error: string | null
  connections: number
}

export type ServerKind = 'api' | 'qz' | 'network' | 'all'

export interface ServerInfo {
  api: { running: boolean; port: number }
  qz: { running: boolean; port: number }
  network: {
    running: boolean
    listeners: NetworkListenerInfo[]
    /** Non-internal IPv4 addresses of this machine, to configure on the POS side. */
    addresses: string[]
  }
}

/** Realtime events pushed from main -> renderer. */
export type AppEvent =
  | { type: 'printer:updated'; printer: Printer }
  | { type: 'printer:removed'; id: string }
  | { type: 'job:new'; job: PrintJob; printerId: string }
  | { type: 'job:update'; job: PrintJob }
  | { type: 'history:new'; entry: HistoryEntry }
  | { type: 'log'; entry: LogEntry }
  | { type: 'effect'; printerId: string; effect: 'cut' | 'drawer' | 'beep' }
  | { type: 'servers'; info: ServerInfo }
  | { type: 'simulation'; state: SimulationState }

export const ERROR_LABELS: Record<ErrorKind, string> = {
  paper_empty: 'Carta terminata',
  paper_low: 'Carta quasi terminata',
  offline: 'Stampante offline',
  unreachable: 'Stampante non raggiungibile',
  cover_open: 'Coperchio aperto',
  buffer_full: 'Buffer pieno',
  generic: 'Errore generico'
}
