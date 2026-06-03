import { ESC, GS, LF } from './commands'

/**
 * Tiny fluent ESC/POS builder. Used by the traffic simulator (and tests) to
 * synthesise realistic receipts. Not exhaustive — just the commands we render.
 */
export class EscPosBuilder {
  private bytes: number[] = []

  raw(...b: number[]): this {
    this.bytes.push(...b)
    return this
  }

  init(): this {
    return this.raw(ESC, 0x40)
  }

  text(s: string): this {
    for (const ch of s) this.bytes.push(ch.charCodeAt(0) & 0xff)
    return this
  }

  line(s = ''): this {
    return this.text(s).raw(LF)
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }

  align(a: 'left' | 'center' | 'right'): this {
    return this.raw(ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0)
  }

  size(doubleW: boolean, doubleH: boolean): this {
    const n = (doubleW ? 0x10 : 0) | (doubleH ? 0x01 : 0)
    return this.raw(GS, 0x21, n)
  }

  feed(lines = 1): this {
    return this.raw(ESC, 0x64, lines)
  }

  rule(width = 48, ch = '-'): this {
    return this.line(ch.repeat(width))
  }

  qrcode(data: string, size = 6): this {
    const store = data.split('').map((c) => c.charCodeAt(0) & 0xff)
    const len = store.length + 3
    const pL = len & 0xff
    const pH = (len >> 8) & 0xff
    // model
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
    // size
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size)
    // error correction
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30)
    // store
    this.raw(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...store)
    // print
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
    return this
  }

  barcode(data: string, symbology = 73): this {
    const store = data.split('').map((c) => c.charCodeAt(0) & 0xff)
    // HRI below barcode
    this.raw(GS, 0x48, 0x02)
    this.raw(GS, 0x6b, symbology, store.length, ...store)
    return this
  }

  drawer(): this {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa)
  }

  beep(count = 1): this {
    return this.raw(ESC, 0x42, count, 0x02)
  }

  cut(partial = false): this {
    return this.raw(GS, 0x56, partial ? 1 : 0)
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }

  toBase64(): string {
    return Buffer.from(this.toUint8Array()).toString('base64')
  }
}

/** Build a believable restaurant receipt for the traffic simulator. */
export function sampleReceipt(seed = Date.now()): Uint8Array {
  const items = [
    ['Pizza Margherita', 8.0],
    ['Pizza Diavola', 9.5],
    ['Coca Cola', 2.5],
    ['Acqua Naturale', 1.5],
    ['Tiramisù', 4.5],
    ['Caffè', 1.2],
    ['Birra Media', 4.0],
    ['Bruschette', 5.0]
  ] as const

  const rng = mulberry32(seed)
  const chosen = items.filter(() => rng() > 0.45)
  if (chosen.length === 0) chosen.push(items[0])

  const b = new EscPosBuilder().init()
  b.align('center').bold(true).size(true, true).line('BELLA ITALIA')
  b.size(false, false).bold(false).line('Via Roma 42 - Milano').line('Tel. 02 1234567')
  b.align('left').rule(48)

  let total = 0
  for (const [name, price] of chosen) {
    const qty = 1 + Math.floor(rng() * 3)
    const lineTotal = qty * price
    total += lineTotal
    const left = `${qty} ${name}`
    const right = lineTotal.toFixed(2)
    const pad = Math.max(1, 48 - left.length - right.length)
    b.line(left + ' '.repeat(pad) + right)
  }

  b.rule(48)
  const totalStr = total.toFixed(2)
  b.bold(true).size(false, true)
  b.line('TOTALE' + ' '.repeat(Math.max(1, 24 - 6 - totalStr.length)) + totalStr)
  b.size(false, false).bold(false).feed(1)
  b.align('center').line('Grazie e arrivederci!')
  b.qrcode(`https://bellaitalia.example/r/${Math.floor(rng() * 1e6)}`, 6)
  b.feed(1).barcode(`${100000000000 + Math.floor(rng() * 8e11)}`, 73)
  b.feed(2).cut(false)
  return b.toUint8Array()
}

/** Deterministic PRNG so simulated receipts are reproducible in tests. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
