import { describe, expect, it } from 'vitest'
import { parseEscPos } from '../../src/main/escpos/parser'
import { EscPosBuilder } from '../../src/main/escpos/builder'
import type { BarcodeNode, QRCodeNode, TextNode } from '../../src/shared/types'

function bytes(...b: number[]): Uint8Array {
  return Uint8Array.from(b)
}
const ESC = 0x1b
const GS = 0x1d

describe('parseEscPos', () => {
  it('decodes plain text split into lines', () => {
    const doc = parseEscPos(new TextEncoder().encode('Hello\nWorld\n'))
    const text = doc.nodes.filter((n) => n.type === 'text') as TextNode[]
    const joined = text.map((t) => t.text).join('')
    expect(joined).toContain('Hello')
    expect(joined).toContain('World')
  })

  it('handles ESC @ initialise and resets style', () => {
    const doc = parseEscPos(bytes(ESC, 0x45, 1, 0x41, ESC, 0x40, 0x42))
    const nodes = doc.nodes.filter((n) => n.type === 'text') as TextNode[]
    // 'A' was bold, 'B' after init is not.
    const a = nodes.find((n) => n.text === 'A')
    const b = nodes.find((n) => n.text === 'B')
    expect(a?.style.bold).toBe(true)
    expect(b?.style.bold).toBe(false)
  })

  it('applies bold (ESC E) and alignment (ESC a)', () => {
    const doc = parseEscPos(bytes(ESC, 0x61, 1, ESC, 0x45, 1, 0x58))
    const node = doc.nodes.find((n) => n.type === 'text') as TextNode
    expect(node.style.align).toBe('center')
    expect(node.style.bold).toBe(true)
  })

  it('parses character size via GS ! and ESC !', () => {
    const doc = parseEscPos(bytes(GS, 0x21, 0x11, 0x58))
    const node = doc.nodes.find((n) => n.type === 'text') as TextNode
    expect(node.style.doubleWidth).toBe(true)
    expect(node.style.doubleHeight).toBe(true)
  })

  it('detects paper cut (GS V) and records the effect', () => {
    const doc = parseEscPos(bytes(GS, 0x56, 0x01))
    expect(doc.effects.cut).toBe(true)
    const cut = doc.nodes.find((n) => n.type === 'cut')
    expect(cut).toMatchObject({ type: 'cut', partial: true })
  })

  it('detects drawer kick (ESC p) and beep (ESC B)', () => {
    const doc = parseEscPos(bytes(ESC, 0x70, 0x00, 0x19, 0xfa, ESC, 0x42, 0x03, 0x02))
    expect(doc.effects.drawerOpen).toBe(true)
    expect(doc.effects.beeps).toBe(3)
  })

  it('feeds n lines with ESC d', () => {
    const doc = parseEscPos(bytes(ESC, 0x64, 0x04))
    expect(doc.nodes.find((n) => n.type === 'feed')).toMatchObject({ type: 'feed', lines: 4 })
  })

  it('parses a length-prefixed barcode (GS k)', () => {
    const data = '12345678'
    const payload = [GS, 0x6b, 73, data.length, ...[...data].map((c) => c.charCodeAt(0))]
    const doc = parseEscPos(bytes(...payload))
    const bc = doc.nodes.find((n) => n.type === 'barcode') as BarcodeNode
    expect(bc.data).toBe(data)
    expect(bc.symbology).toBe('CODE128')
  })

  it('parses a QR code built via GS ( k', () => {
    const payload = new EscPosBuilder().qrcode('https://clicketta.dev', 6).toUint8Array()
    const doc = parseEscPos(payload)
    const qr = doc.nodes.find((n) => n.type === 'qrcode') as QRCodeNode
    expect(qr.data).toBe('https://clicketta.dev')
    expect(qr.size).toBe(6)
  })

  it('respects paper width column counts', () => {
    expect(parseEscPos(new Uint8Array(), { paperWidth: 58 }).columns).toBe(32)
    expect(parseEscPos(new Uint8Array(), { paperWidth: 80 }).columns).toBe(48)
  })

  it('skips unknown commands without corrupting following text', () => {
    const doc = parseEscPos(bytes(ESC, 0x99, 0x41, 0x42))
    const text = (doc.nodes.filter((n) => n.type === 'text') as TextNode[]).map((t) => t.text).join('')
    expect(text).toContain('B')
  })

  it('does not leak QR state between independent parses', () => {
    const withQr = new EscPosBuilder().qrcode('ONCE', 5).toUint8Array()
    parseEscPos(withQr)
    const plain = parseEscPos(new TextEncoder().encode('plain text'))
    expect(plain.nodes.some((n) => n.type === 'qrcode')).toBe(false)
  })
})
