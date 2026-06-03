import { describe, expect, it } from 'vitest'
import { EscPosBuilder, sampleReceipt } from '../../src/main/escpos/builder'
import { parseEscPos } from '../../src/main/escpos/parser'
import type { TextNode } from '../../src/shared/types'

describe('EscPosBuilder', () => {
  it('produces a base64 payload that round-trips through the parser', () => {
    const b64 = new EscPosBuilder().init().bold(true).line('CIAO').cut().toBase64()
    const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
    const doc = parseEscPos(bytes)
    const node = doc.nodes.find((n) => n.type === 'text') as TextNode
    expect(node.text).toContain('CIAO')
    expect(node.style.bold).toBe(true)
    expect(doc.effects.cut).toBe(true)
  })

  it('sampleReceipt is deterministic for a given seed', () => {
    const a = sampleReceipt(42)
    const b = sampleReceipt(42)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('sampleReceipt contains a total, a QR code and a barcode', () => {
    const doc = parseEscPos(sampleReceipt(7))
    const text = (doc.nodes.filter((n) => n.type === 'text') as TextNode[]).map((t) => t.text).join('\n')
    expect(text).toContain('TOTALE')
    expect(doc.nodes.some((n) => n.type === 'qrcode')).toBe(true)
    expect(doc.nodes.some((n) => n.type === 'barcode')).toBe(true)
    expect(doc.effects.cut).toBe(true)
  })
})
