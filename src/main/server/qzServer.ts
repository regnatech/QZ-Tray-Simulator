import { WebSocketServer, type WebSocket } from 'ws'
import type { PrinterManager } from '../engine/printerManager'
import type { Logger } from '../core/logger'
import { handleQzMessage } from './qzProtocol'

/**
 * QZ Tray compatible WebSocket server. Real QZ Tray listens on wss://localhost:8181
 * (secure) with a fallback to ws://localhost:8182 (insecure). We implement the
 * insecure endpoint, which is sufficient for development and testing.
 */
export class QzServer {
  private wss: WebSocketServer | null = null
  private clients = new Set<WebSocket>()

  constructor(
    private manager: PrinterManager,
    private log: Logger
  ) {}

  get running(): boolean {
    return this.wss !== null
  }

  start(port: number): Promise<void> {
    if (this.wss) return Promise.resolve()
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port, host: '127.0.0.1' })
      } catch (err) {
        reject(err)
        return
      }
      this.wss.on('listening', () => {
        this.log.info('qz', `QZ Tray compatibility server listening on ws://127.0.0.1:${port}`)
        resolve()
      })
      this.wss.on('error', (err) => {
        this.log.error('qz', `QZ server error: ${err.message}`)
        reject(err)
      })
      this.wss.on('connection', (socket) => this.onConnection(socket))
    })
  }

  private onConnection(socket: WebSocket): void {
    this.clients.add(socket)
    this.log.debug('qz', 'QZ client connected')
    // QZ clients expect a connection acknowledgement frame.
    socket.send(JSON.stringify({ connected: true, version: '2.2.4' }))

    socket.on('message', async (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8')
      try {
        const response = await handleQzMessage(text, this.manager)
        if (response) socket.send(JSON.stringify(response))
      } catch (err) {
        this.log.error('qz', `Message handling failed: ${(err as Error).message}`)
        socket.send(JSON.stringify({ error: (err as Error).message }))
      }
    })
    socket.on('close', () => {
      this.clients.delete(socket)
      this.log.debug('qz', 'QZ client disconnected')
    })
    socket.on('error', () => this.clients.delete(socket))
  }

  async stop(): Promise<void> {
    if (!this.wss) return
    for (const c of this.clients) c.close()
    this.clients.clear()
    await new Promise<void>((resolve) => this.wss!.close(() => resolve()))
    this.wss = null
    this.log.info('qz', 'QZ Tray compatibility server stopped')
  }
}
