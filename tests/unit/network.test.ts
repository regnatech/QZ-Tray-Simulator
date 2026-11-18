import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { connect, type Socket } from 'node:net'
import { NetworkPrinterServer } from '../../src/main/server/networkServer'
import { isStatusOnly, statusByte, StatusQueryScanner } from '../../src/main/escpos/status'
import { sampleReceipt } from '../../src/main/escpos/builder'
import { parseEscPos } from '../../src/main/escpos/parser'
import { makeHarness, type TestHarness } from './helpers'

let h: TestHarness
let net: NetworkPrinterServer

/** Port the given printer's listener actually bound to. */
function portOf(name: string): number {
  const p = h.manager.listPrinters().find((x) => x.name === name)!
  return net.info().find((l) => l.printerId === p.id)!.port
}

function open(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(port, '127.0.0.1', () => resolve(s))
    s.once('error', reject)
  })
}

/** Send bytes and collect the reply until the server has answered `expected` bytes. */
async function query(port: number, bytes: number[], expected: number): Promise<number[]> {
  const s = await open(port)
  const out: number[] = []
  await new Promise<void>((resolve) => {
    s.on('data', (d) => {
      out.push(...d)
      if (out.length >= expected) resolve()
    })
    s.write(Buffer.from(bytes))
  })
  s.destroy()
  return out
}

async function sendJob(port: number, bytes: Uint8Array): Promise<void> {
  const s = await open(port)
  await new Promise<void>((resolve) => {
    s.on('close', () => resolve())
    s.end(Buffer.from(bytes))
  })
}

async function waitFor(cond: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 10))
  }
}

beforeEach(async () => {
  h = makeHarness()
  // Ephemeral ports so tests never clash with a running simulator.
  for (const p of h.manager.listPrinters()) h.manager.updatePrinter(p.id, { networkHost: '127.0.0.1', networkPort: 0 })
  net = new NetworkPrinterServer(h.manager, h.store, h.log)
  h.bus.onEvent((e) => {
    if (e.type === 'printer:updated' || e.type === 'printer:removed') void net.sync()
  })
  await net.start()
})

afterEach(async () => {
  await net.stop()
})

describe('NetworkPrinterServer', () => {
  it('opens one listener per network-enabled printer', () => {
    const info = net.info()
    expect(info).toHaveLength(3)
    expect(info.every((l) => l.listening && l.port > 0)).toBe(true)
  })

  it('prints a raw ESC/POS job received over TCP', async () => {
    await sendJob(portOf('Cucina'), sampleReceipt(7))
    await waitFor(() => h.store.countHistory() === 1)
    const [entry] = h.store.listHistory({})
    expect(entry.source).toBe('network')
    expect(entry.printerName).toBe('Cucina')
    expect(entry.rendered).toContain('7')
  })

  it('answers DLE EOT status requests without creating a job', async () => {
    const port = portOf('Bar')
    expect(await query(port, [0x10, 0x04, 0x01], 1)).toEqual([0x12])

    const bar = h.manager.listPrinters().find((p) => p.name === 'Bar')!
    h.manager.setError(bar.id, 'paper_empty', true)
    expect(await query(port, [0x10, 0x04, 0x04, 0x10, 0x04, 0x01], 2)).toEqual([0x72, 0x1a])

    await new Promise((r) => setTimeout(r, 50))
    expect(h.store.countHistory()).toBe(0)
  })

  it('drops connections when the printer is simulated as unreachable', async () => {
    const cassa = h.manager.listPrinters().find((p) => p.name === 'Cassa')!
    h.manager.setError(cassa.id, 'unreachable', true)
    const s = await open(portOf('Cassa'))
    await new Promise<void>((resolve) => s.on('close', () => resolve()))
    expect(h.store.countHistory()).toBe(0)
  })

  it('closes the listener when the printer is disabled', async () => {
    const cucina = h.manager.listPrinters().find((p) => p.name === 'Cucina')!
    h.manager.setEnabled(cucina.id, false)
    await net.sync()
    expect(net.info().some((l) => l.printerId === cucina.id)).toBe(false)
  })

  it('reports a port already in use instead of crashing', async () => {
    const [a, b] = h.manager.listPrinters()
    const taken = portOf(a.name)
    h.manager.updatePrinter(b.id, { networkPort: taken })
    await net.sync()
    const l = net.info().find((x) => x.printerId === b.id)!
    expect(l.listening).toBe(false)
    expect(l.error).toMatch(/in uso/)
  })

  it('stops every listener when the server is stopped', async () => {
    await net.stop()
    expect(net.info()).toHaveLength(0)
  })
})

describe('ESC/POS status helpers', () => {
  it('scans status requests split across TCP segments', () => {
    const scanner = new StatusQueryScanner()
    expect(scanner.feed(Uint8Array.from([0x41, 0x10]))).toEqual([])
    expect(scanner.feed(Uint8Array.from([0x04]))).toEqual([])
    expect(scanner.feed(Uint8Array.from([0x02, 0x1d, 0x72, 0x31]))).toEqual([
      { cmd: 'dle_eot', n: 2 },
      { cmd: 'gs_r', n: 1 }
    ])
  })

  it('encodes cover open and paper near end', () => {
    const errors = new Set(['cover_open', 'paper_low'] as const)
    expect(statusByte({ cmd: 'dle_eot', n: 2 }, { enabled: true, errors })).toBe(0x16)
    expect(statusByte({ cmd: 'dle_eot', n: 4 }, { enabled: true, errors })).toBe(0x1e)
    expect(statusByte({ cmd: 'gs_r', n: 1 }, { enabled: true, errors })).toBe(0x03)
  })

  it('distinguishes status polls from print jobs', () => {
    expect(isStatusOnly(Uint8Array.from([0x1b, 0x40, 0x10, 0x04, 0x01]))).toBe(true)
    expect(isStatusOnly(Uint8Array.from([0x1b, 0x40, 0x41, 0x0a]))).toBe(false)
  })

  it('does not print the parameter of GS r', () => {
    const doc = parseEscPos(Uint8Array.from([0x1d, 0x72, 0x31, 0x10, 0x04, 0x01, 0x41]))
    const text = doc.nodes.map((n) => (n.type === 'text' ? n.text : '')).join('')
    expect(text).toBe('A')
  })
})
