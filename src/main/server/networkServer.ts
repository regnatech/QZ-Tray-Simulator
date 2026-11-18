import { createServer, type AddressInfo, type Server, type Socket } from 'node:net'
import { networkInterfaces } from 'node:os'
import type { NetworkListenerInfo, Printer } from '@shared/types'
import type { PrinterManager } from '../engine/printerManager'
import type { Store } from '../db/store'
import type { Logger } from '../core/logger'
import { isStatusOnly, statusByte, StatusQueryScanner } from '../escpos/status'

/**
 * A connection that stays silent this long after sending data is considered to
 * have finished its job. Most hosts close the socket after each job (which
 * flushes immediately); this covers the ones that keep it open.
 */
const JOB_IDLE_MS = 1000

interface Listener {
  printerId: string
  host: string
  /** Configured port. */
  port: number
  server: Server | null
  sockets: Set<Socket>
  error: string | null
}

/**
 * Raw TCP printing server (a.k.a. JetDirect / AppSocket, port 9100). Every
 * enabled printer with networking turned on gets its own listener, so a POS can
 * address it exactly as it would a real Ethernet thermal printer. Bytes received
 * on a connection form one print job; DLE EOT / GS r status requests are
 * answered in real time from the printer's simulated error state.
 */
export class NetworkPrinterServer {
  private listeners = new Map<string, Listener>()
  private enabled = false
  private syncing: Promise<void> = Promise.resolve()

  constructor(
    private manager: PrinterManager,
    private store: Store,
    private log: Logger,
    /** Invoked whenever the set or state of listeners changes. */
    private onChange: () => void = () => {}
  ) {}

  get running(): boolean {
    return this.enabled
  }

  async start(): Promise<void> {
    this.enabled = true
    await this.sync()
  }

  async stop(): Promise<void> {
    this.enabled = false
    await this.sync()
  }

  /** Reconcile the open listeners with the current printer configuration. */
  sync(): Promise<void> {
    this.syncing = this.syncing.then(() => this.reconcile()).catch((err) => {
      this.log.error('network', `Listener sync failed: ${(err as Error).message}`)
    })
    return this.syncing
  }

  info(): NetworkListenerInfo[] {
    return [...this.listeners.values()].map((l) => {
      const address = l.server?.address() as AddressInfo | null | undefined
      return {
        printerId: l.printerId,
        host: l.host,
        port: address?.port ?? l.port,
        listening: !!l.server?.listening,
        error: l.error,
        connections: l.sockets.size
      }
    })
  }

  private async reconcile(): Promise<void> {
    const wanted = new Map<string, Printer>()
    if (this.enabled) {
      for (const p of this.manager.listPrinters()) {
        if (p.enabled && p.networkEnabled) wanted.set(p.id, p)
      }
    }

    let changed = false
    for (const l of [...this.listeners.values()]) {
      const p = wanted.get(l.printerId)
      if (!p || p.networkHost !== l.host || p.networkPort !== l.port) {
        await this.close(l)
        this.listeners.delete(l.printerId)
        changed = true
      }
    }
    for (const p of wanted.values()) {
      if (this.listeners.has(p.id)) continue
      const l: Listener = {
        printerId: p.id,
        host: p.networkHost,
        port: p.networkPort,
        server: null,
        sockets: new Set(),
        error: null
      }
      this.listeners.set(p.id, l)
      await this.open(l, p.name)
      changed = true
    }
    if (changed) this.onChange()
  }

  private open(l: Listener, name: string): Promise<void> {
    return new Promise((resolve) => {
      const server = createServer((socket) => this.onConnection(l, socket))
      server.once('error', (err: NodeJS.ErrnoException) => {
        l.error = err.code === 'EADDRINUSE' ? `Porta ${l.port} già in uso` : err.message
        l.server = null
        this.log.error('network', `"${name}" cannot listen on ${l.host}:${l.port}: ${l.error}`)
        resolve()
      })
      server.listen(l.port, l.host, () => {
        l.server = server
        const port = (server.address() as AddressInfo).port
        this.log.info('network', `"${name}" listening on tcp://${l.host}:${port} (raw / JetDirect)`)
        resolve()
      })
    })
  }

  private close(l: Listener): Promise<void> {
    for (const s of l.sockets) s.destroy()
    l.sockets.clear()
    const server = l.server
    l.server = null
    if (!server) return Promise.resolve()
    return new Promise((resolve) => server.close(() => resolve()))
  }

  private onConnection(l: Listener, socket: Socket): void {
    const printer = this.store.getPrinter(l.printerId)
    const remote = `${socket.remoteAddress}:${socket.remotePort}`
    // A simulated "unreachable" printer drops the connection like a dead host.
    if (!printer || this.store.listActiveErrors(printer.id).some((e) => e.kind === 'unreachable')) {
      this.log.warning('network', `Dropped connection from ${remote}: printer unreachable`)
      socket.destroy()
      return
    }

    l.sockets.add(socket)
    this.onChange()
    this.log.debug('network', `"${printer.name}": connection from ${remote}`)

    const scanner = new StatusQueryScanner()
    let chunks: Buffer[] = []
    let idle: ReturnType<typeof setTimeout> | null = null

    const flush = (): void => {
      if (idle) clearTimeout(idle)
      idle = null
      if (chunks.length === 0) return
      const bytes = new Uint8Array(Buffer.concat(chunks))
      chunks = []
      if (isStatusOnly(bytes)) return
      const current = this.store.getPrinter(l.printerId)
      if (!current) return
      void this.manager.submitPrint(current.identifier, bytes, { source: 'network' })
    }

    socket.on('data', (data: Buffer) => {
      const queries = scanner.feed(data)
      if (queries.length) {
        const current = this.store.getPrinter(l.printerId)
        const ctx = {
          enabled: current?.enabled ?? false,
          errors: new Set(this.store.listActiveErrors(l.printerId).map((e) => e.kind))
        }
        socket.write(Buffer.from(queries.map((q) => statusByte(q, ctx))))
      }
      chunks.push(data)
      if (idle) clearTimeout(idle)
      idle = setTimeout(flush, JOB_IDLE_MS)
    })
    socket.on('end', () => {
      flush()
      socket.end()
    })
    socket.on('close', () => {
      flush()
      l.sockets.delete(socket)
      this.onChange()
    })
    socket.on('error', (err) => {
      this.log.debug('network', `Socket error from ${remote}: ${err.message}`)
    })
  }
}

/** Non-internal IPv4 addresses of this machine. */
export function localAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}
