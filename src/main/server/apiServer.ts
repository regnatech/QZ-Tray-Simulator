import express, { type Express, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import type { PrinterManager } from '../engine/printerManager'
import type { Store } from '../db/store'
import type { Logger } from '../core/logger'

export interface ApiDeps {
  manager: PrinterManager
  store: Store
  log: Logger
}

/** Build the Express application exposing the local REST API. */
export function createApiApp({ manager, store, log }: ApiDeps): Express {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use(express.text({ type: 'text/plain', limit: '8mb' }))

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
  })
  app.options(/.*/, (_req, res) => res.sendStatus(204))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'clicketta-thermal-simulator', ts: Date.now() })
  })

  app.get('/api/printers', (_req, res) => {
    res.json(
      manager.listPrinters().map((p) => {
        const rt = manager.getRuntime(p.id)
        return { ...p, queue: rt.queue, jobsReceived: rt.jobsReceived, lastPrintAt: rt.lastPrintAt }
      })
    )
  })

  app.post('/api/print', async (req: Request, res: Response) => {
    try {
      const body = (typeof req.body === 'string' ? { data: req.body } : req.body) ?? {}
      const printer: string | undefined = body.printer ?? body.printerIdentifier ?? body.name
      const data: string | undefined = body.data
      const encoding: string = body.encoding ?? 'base64'
      if (!printer || typeof printer !== 'string') {
        return res.status(400).json({ ok: false, error: 'Missing "printer"' })
      }
      if (!data || typeof data !== 'string') {
        return res.status(400).json({ ok: false, error: 'Missing "data"' })
      }
      const bytes =
        encoding === 'plain'
          ? new TextEncoder().encode(data)
          : new Uint8Array(Buffer.from(data, 'base64'))
      const result = await manager.submitPrint(printer, bytes, { source: 'api' })
      return res.status(result.ok ? 200 : 422).json(result)
    } catch (err) {
      log.error('api', `POST /api/print failed: ${(err as Error).message}`)
      return res.status(500).json({ ok: false, error: (err as Error).message })
    }
  })

  app.get('/api/history', (req, res) => {
    const limit = Math.min(500, Number(req.query.limit) || 100)
    const printerId = typeof req.query.printer === 'string' ? req.query.printer : undefined
    const search = typeof req.query.q === 'string' ? req.query.q : undefined
    res.json(store.listHistory({ limit, printerId, search }))
  })

  app.get('/api/stats', (_req, res) => {
    res.json(store.statsSummary())
  })

  return app
}

/** HTTP server lifecycle wrapper around the API app. */
export class ApiServer {
  private server: Server | null = null
  private app: Express

  constructor(deps: ApiDeps, private log: Logger) {
    this.app = createApiApp(deps)
  }

  get running(): boolean {
    return this.server !== null
  }

  start(port: number): Promise<void> {
    if (this.server) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, '127.0.0.1', () => {
        this.server = server
        this.log.info('api', `Local API listening on http://127.0.0.1:${port}`)
        resolve()
      })
      server.on('error', (err) => {
        this.log.error('api', `API server error: ${err.message}`)
        reject(err)
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolve) => this.server!.close(() => resolve()))
    this.server = null
    this.log.info('api', 'Local API stopped')
  }
}
