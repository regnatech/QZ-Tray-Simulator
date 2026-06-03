import { describe, expect, it } from 'vitest'
import {
  buildTextPdf,
  historyToCsv,
  historyToJson,
  historyToPdf,
  renderedToText
} from '../../src/main/export/serializers'
import { parseEscPos } from '../../src/main/escpos/parser'
import { sampleReceipt } from '../../src/main/escpos/builder'
import type { HistoryEntry } from '../../src/shared/types'

function entry(): HistoryEntry {
  const rendered = JSON.stringify(parseEscPos(sampleReceipt(1)))
  return {
    id: 'h1',
    printerId: 'p1',
    printerName: 'Cucina',
    createdAt: Date.UTC(2026, 0, 15, 10, 30, 0),
    durationMs: 240,
    bytes: 512,
    rawBase64: Buffer.from(sampleReceipt(1)).toString('base64'),
    rendered,
    source: 'qz'
  }
}

describe('serializers', () => {
  it('renderedToText extracts readable lines', () => {
    const text = renderedToText(entry().rendered)
    expect(text).toContain('TOTALE')
    expect(text).toContain('[QRCODE')
  })

  it('historyToJson produces valid parseable JSON', () => {
    const json = historyToJson([entry()])
    const parsed = JSON.parse(json)
    expect(parsed[0].printer).toBe('Cucina')
    expect(parsed[0]).toHaveProperty('text')
  })

  it('historyToCsv has a header and one data row', () => {
    const csv = historyToCsv([entry()])
    const lines = csv.split('\n')
    expect(lines[0]).toContain('printer')
    expect(lines).toHaveLength(2)
  })

  it('buildTextPdf emits a valid PDF header and EOF', () => {
    const pdf = buildTextPdf('Title', ['line one', 'line two'])
    const text = Buffer.from(pdf).toString('latin1')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('%%EOF')
    expect(text).toContain('/Type /Catalog')
  })

  it('historyToPdf returns bytes', () => {
    const pdf = historyToPdf([entry()])
    expect(pdf.length).toBeGreaterThan(100)
  })
})
