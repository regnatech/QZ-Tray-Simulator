import type { PrinterManager } from '../engine/printerManager'

/** A QZ Tray websocket request envelope (subset we support). */
export interface QzMessage {
  call?: string
  params?: Record<string, unknown>
  promise?: unknown
  uid?: string
  position?: unknown
  signature?: string
  signAlgorithm?: string
}

export interface QzResponse {
  uid?: string
  result?: unknown
  error?: string
}

const QZ_VERSION = '2.2.4'

/**
 * Decode a single qz.print data entry into raw bytes. QZ entries are either a
 * bare string (plain text) or `{ type, format/flavor, data }`.
 */
export function decodeQzEntry(entry: unknown): Uint8Array {
  if (typeof entry === 'string') return new TextEncoder().encode(entry)
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>
    const data = typeof e.data === 'string' ? e.data : ''
    const format = String(e.flavor ?? e.format ?? 'plain').toLowerCase()
    switch (format) {
      case 'base64':
        return new Uint8Array(Buffer.from(data, 'base64'))
      case 'hex':
        return new Uint8Array(Buffer.from(data.replace(/[^0-9a-fA-F]/g, ''), 'hex'))
      case 'plain':
      case 'command':
      default:
        return new TextEncoder().encode(data)
    }
  }
  return new Uint8Array()
}

/** Concatenate every entry of a qz.print `data` array into one byte stream. */
export function decodeQzPrintData(data: unknown): Uint8Array {
  const entries = Array.isArray(data) ? data : [data]
  const chunks = entries.map(decodeQzEntry)
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function resolvePrinterName(params: Record<string, unknown> | undefined): string | null {
  if (!params) return null
  const p = params.printer
  if (typeof p === 'string') return p
  if (p && typeof p === 'object') {
    const obj = p as Record<string, unknown>
    if (typeof obj.name === 'string') return obj.name
  }
  if (typeof params.name === 'string') return params.name
  return null
}

/**
 * Handle one QZ Tray protocol message. Pure with respect to transport — returns
 * the response envelope to send back (or null when no reply is expected).
 */
export async function handleQzMessage(
  raw: string,
  manager: PrinterManager
): Promise<QzResponse | null> {
  let msg: QzMessage
  try {
    msg = JSON.parse(raw) as QzMessage
  } catch {
    return { error: 'Invalid JSON' }
  }

  const { call, params, uid } = msg
  const reply = (result: unknown): QzResponse => ({ uid, result })
  const fail = (error: string): QzResponse => ({ uid, error })

  switch (call) {
    case undefined:
      return null

    case 'websocket.getNetworkInfo':
      return reply({ ipAddress: '127.0.0.1', macAddress: '00:00:00:00:00:00' })

    case 'getVersion':
    case 'qz.getVersion':
      return reply(QZ_VERSION)

    case 'qz.printers.find':
    case 'printers.find': {
      const query = typeof params?.query === 'string' ? params.query : undefined
      const names = manager
        .listPrinters()
        .filter((p) => p.enabled)
        .map((p) => p.identifier)
      if (query) {
        const q = query.toLowerCase()
        const matches = names.filter((n) => n.toLowerCase().includes(q))
        if (matches.length === 0) return fail(`Unable to find printer with name: ${query}`)
        // qz.js returns a single string for an exact query match, else an array.
        const exact = matches.find((n) => n.toLowerCase() === q)
        return reply(exact ?? matches)
      }
      return reply(names)
    }

    case 'qz.printers.getDefault':
    case 'printers.getDefault': {
      const first = manager.listPrinters().find((p) => p.enabled)
      return reply(first ? first.identifier : null)
    }

    case 'qz.printers.getStatus':
    case 'printers.getStatus':
      return reply(null)

    case 'qz.print':
    case 'print': {
      const name = resolvePrinterName(params)
      if (!name) return fail('No printer specified')
      const bytes = decodeQzPrintData(params?.data)
      if (bytes.length === 0) return fail('Empty print data')
      const res = await manager.submitPrint(name, bytes, { source: 'qz' })
      return res.ok ? reply(null) : fail(res.error ?? 'Print failed')
    }

    default:
      // Acknowledge unsupported security/config calls so the client proceeds.
      return reply(null)
  }
}
