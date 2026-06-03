import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../src/main/db/memory'
import { computeStats } from '../../src/main/db/store'
import type { HistoryEntry, Printer } from '../../src/shared/types'

function printer(id: string, name: string): Printer {
  return {
    id, name, description: '', driver: 'X', language: 'ESC/POS', port: 'USB001',
    paperWidth: 80, identifier: name, enabled: true, status: 'online', color: '#fff',
    icon: 'printer', paperLevel: 100, createdAt: Date.now(), updatedAt: Date.now()
  }
}
function hist(id: string, printerId: string, at: number, duration = 100): HistoryEntry {
  return {
    id, printerId, printerName: printerId, createdAt: at, durationMs: duration,
    bytes: 10, rawBase64: '', rendered: '{}', source: 'qz'
  }
}

describe('MemoryStore', () => {
  it('round-trips printers and resolves by identifier (case-insensitive)', () => {
    const s = new MemoryStore()
    s.upsertPrinter(printer('p1', 'Cucina'))
    expect(s.getPrinterByIdentifier('cucina')?.id).toBe('p1')
    expect(s.listPrinters()).toHaveLength(1)
    s.removePrinter('p1')
    expect(s.listPrinters()).toHaveLength(0)
  })

  it('filters history by printer and search', () => {
    const s = new MemoryStore()
    s.addHistory(hist('h1', 'Cucina', Date.now()))
    s.addHistory(hist('h2', 'Bar', Date.now()))
    expect(s.listHistory({ printerId: 'Cucina' })).toHaveLength(1)
    expect(s.listHistory({ search: 'bar' })).toHaveLength(1)
    expect(s.countHistory()).toBe(2)
  })

  it('persists and reads settings', () => {
    const s = new MemoryStore()
    const next = { ...s.getSettings(), apiPort: 12345 }
    s.saveSettings(next)
    expect(s.getSettings().apiPort).toBe(12345)
  })

  it('toggles simulated errors', () => {
    const s = new MemoryStore()
    s.setError('p1', 'paper_empty', true, '')
    expect(s.listActiveErrors('p1')).toHaveLength(1)
    s.setError('p1', 'paper_empty', false, '')
    expect(s.listActiveErrors('p1')).toHaveLength(0)
  })
})

describe('computeStats', () => {
  it('aggregates totals, per-printer counts and a 14-day window', () => {
    const now = Date.now()
    const printers = [printer('p1', 'Cucina'), printer('p2', 'Bar')]
    const history = [
      hist('h1', 'p1', now, 100),
      hist('h2', 'p1', now - 2 * 86400000, 200),
      hist('h3', 'p2', now, 300)
    ]
    const stats = computeStats(history, printers, 1)
    expect(stats.totalJobs).toBe(3)
    expect(stats.avgDurationMs).toBe(200)
    expect(stats.totalErrors).toBe(1)
    expect(stats.perPrinter.find((p) => p.printerId === 'p1')?.count).toBe(2)
    expect(stats.daily).toHaveLength(14)
  })
})
