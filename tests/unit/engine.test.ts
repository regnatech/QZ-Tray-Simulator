import { describe, expect, it } from 'vitest'
import { makeHarness } from './helpers'
import { sampleReceipt } from '../../src/main/escpos/builder'

describe('PrinterManager', () => {
  it('seeds the three default printers', () => {
    const { manager } = makeHarness()
    const names = manager.listPrinters().map((p) => p.name)
    expect(names).toEqual(['Cucina', 'Bar', 'Cassa'])
  })

  it('creates printers with unique identifiers', () => {
    const { manager } = makeHarness(false)
    const a = manager.createPrinter({
      name: 'Cucina', description: '', driver: 'X', language: 'ESC/POS',
      port: 'USB001', paperWidth: 80, identifier: 'Cucina', enabled: true, color: '#fff', icon: 'printer'
    })
    const b = manager.createPrinter({
      name: 'Cucina', description: '', driver: 'X', language: 'ESC/POS',
      port: 'USB001', paperWidth: 80, identifier: 'Cucina', enabled: true, color: '#fff', icon: 'printer'
    })
    expect(a.identifier).toBe('Cucina')
    expect(b.identifier).toBe('Cucina-2')
  })

  it('updates, duplicates and removes printers', () => {
    const { manager } = makeHarness()
    const target = manager.listPrinters()[0]
    manager.updatePrinter(target.id, { name: 'Cucina 2.0' })
    expect(manager.listPrinters().find((p) => p.id === target.id)?.name).toBe('Cucina 2.0')

    const dup = manager.duplicatePrinter(target.id)
    expect(dup?.name).toContain('copia')

    manager.removePrinter(target.id)
    expect(manager.listPrinters().find((p) => p.id === target.id)).toBeUndefined()
  })

  it('prints successfully and records history + runtime', async () => {
    const { manager, store, events } = makeHarness()
    const res = await manager.submitPrint('Cucina', sampleReceipt(1), { source: 'manual' })
    expect(res.ok).toBe(true)
    expect(res.jobId).toBeDefined()

    const history = store.listHistory({ limit: 10 })
    expect(history).toHaveLength(1)
    expect(history[0].printerName).toBe('Cucina')

    const printer = manager.listPrinters().find((p) => p.name === 'Cucina')!
    expect(manager.getRuntime(printer.id).jobsReceived).toBe(1)
    expect(events.some((e) => e.type === 'history:new')).toBe(true)
    expect(events.some((e) => e.type === 'effect')).toBe(true)
  })

  it('decrements simulated paper after printing', async () => {
    const { manager } = makeHarness()
    const before = manager.listPrinters()[0].paperLevel
    await manager.submitPrint('Cucina', sampleReceipt(2))
    const after = manager.listPrinters().find((p) => p.name === 'Cucina')!.paperLevel
    expect(after).toBeLessThan(before)
  })

  it('rejects prints to unknown printers', async () => {
    const { manager } = makeHarness()
    const res = await manager.submitPrint('Nonexistent', sampleReceipt(3))
    expect(res.ok).toBe(false)
    expect(res.error).toContain('not found')
  })

  it('rejects prints when a blocking error is active', async () => {
    const { manager } = makeHarness()
    const printer = manager.listPrinters()[0]
    manager.setError(printer.id, 'paper_empty', true)
    const res = await manager.submitPrint(printer.identifier, sampleReceipt(4))
    expect(res.ok).toBe(false)
    expect(manager.listPrinters().find((p) => p.id === printer.id)?.status).toBe('error')
  })

  it('allows prints with a non-blocking paper_low warning', async () => {
    const { manager } = makeHarness()
    const printer = manager.listPrinters()[0]
    manager.setError(printer.id, 'paper_low', true)
    const res = await manager.submitPrint(printer.identifier, sampleReceipt(5))
    expect(res.ok).toBe(true)
  })

  it('rejects prints to disabled printers', async () => {
    const { manager } = makeHarness()
    const printer = manager.listPrinters()[0]
    manager.setEnabled(printer.id, false)
    const res = await manager.submitPrint(printer.identifier, sampleReceipt(6))
    expect(res.ok).toBe(false)
    expect(res.error).toContain('disabled')
  })

  it('serialises concurrent jobs to the same printer', async () => {
    const { manager, store } = makeHarness()
    await Promise.all([
      manager.submitPrint('Bar', sampleReceipt(10)),
      manager.submitPrint('Bar', sampleReceipt(11)),
      manager.submitPrint('Bar', sampleReceipt(12))
    ])
    const bar = manager.listPrinters().find((p) => p.name === 'Bar')!
    expect(store.listHistory({ printerId: bar.id, limit: 10 })).toHaveLength(3)
    expect(manager.getRuntime(bar.id).queue).toBe(0)
  })
})
