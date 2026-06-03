/** Browser-side ESC/POS builder used to emit demo receipts from the UI. */
class Builder {
  private bytes: number[] = []
  raw(...b: number[]): this {
    this.bytes.push(...b)
    return this
  }
  text(s: string): this {
    for (const c of s) this.bytes.push(c.charCodeAt(0) & 0xff)
    return this
  }
  line(s = ''): this {
    return this.text(s).raw(0x0a)
  }
  init(): this {
    return this.raw(0x1b, 0x40)
  }
  bold(on: boolean): this {
    return this.raw(0x1b, 0x45, on ? 1 : 0)
  }
  align(a: 'left' | 'center' | 'right'): this {
    return this.raw(0x1b, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0)
  }
  size(w: boolean, h: boolean): this {
    return this.raw(0x1d, 0x21, (w ? 0x10 : 0) | (h ? 0x01 : 0))
  }
  feed(n = 1): this {
    return this.raw(0x1b, 0x64, n)
  }
  rule(width = 48): this {
    return this.line('-'.repeat(width))
  }
  qrcode(data: string, size = 6): this {
    const store = [...data].map((c) => c.charCodeAt(0) & 0xff)
    const len = store.length + 3
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size)
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30)
    this.raw(0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...store)
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
    return this
  }
  barcode(data: string, sym = 73): this {
    const store = [...data].map((c) => c.charCodeAt(0) & 0xff)
    this.raw(0x1d, 0x48, 0x02)
    this.raw(0x1d, 0x6b, sym, store.length, ...store)
    return this
  }
  drawer(): this {
    return this.raw(0x1b, 0x70, 0x00, 0x19, 0xfa)
  }
  beep(n = 2): this {
    return this.raw(0x1b, 0x42, n, 0x02)
  }
  cut(): this {
    return this.raw(0x1d, 0x56, 0x00)
  }
  base64(): string {
    let bin = ''
    for (const b of this.bytes) bin += String.fromCharCode(b)
    return btoa(bin)
  }
}

const COLS = (w: number): number => (w === 58 ? 32 : 48)

function row(left: string, right: string, width: number): string {
  const pad = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(pad) + right
}

export function sampleRestaurant(paperWidth: 58 | 80 = 80): string {
  const w = COLS(paperWidth)
  const b = new Builder().init()
  b.align('center').bold(true).size(true, true).line('BELLA ITALIA')
  b.size(false, false).bold(false).line('Ristorante & Pizzeria').line('Via Roma 42, Milano').feed(1)
  b.align('left').rule(w)
  b.line(row('1 Pizza Margherita', '8.00', w))
  b.line(row('1 Pizza Diavola', '9.50', w))
  b.line(row('2 Coca Cola', '5.00', w))
  b.line(row('1 Tiramisù', '4.50', w))
  b.rule(w)
  b.bold(true).size(false, true).line(row('TOTALE', '27.00', Math.floor(w / 1.5))).size(false, false).bold(false)
  b.feed(1).align('center').line('Grazie e arrivederci!')
  b.qrcode('https://bellaitalia.example/recensione', 6)
  b.feed(1).barcode('978020137962', 67)
  b.feed(2).cut()
  return b.base64()
}

export function sampleKitchen(paperWidth: 58 | 80 = 80): string {
  const w = COLS(paperWidth)
  const b = new Builder().init()
  b.align('center').bold(true).size(true, true).line('CUCINA').size(false, false).line('Comanda #128').feed(1)
  b.align('left').rule(w)
  b.bold(true).size(false, true).line('2x Pizza Margherita').size(false, false).line('   - senza basilico')
  b.bold(true).size(false, true).line('1x Carbonara').size(false, false)
  b.bold(true).size(false, true).line('3x Patatine').size(false, false)
  b.rule(w).line('Tavolo 7 - Cameriere: Luca').feed(1).beep(2).cut()
  return b.base64()
}

export function sampleDrawer(): string {
  const b = new Builder().init()
  b.align('center').bold(true).line('APERTURA CASSETTO').feed(1)
  b.bold(false).line('Pagamento contanti').line('Resto: 2.50 EUR').feed(1)
  b.drawer().beep(1).feed(2).cut()
  return b.base64()
}

export const SAMPLES = [
  { id: 'restaurant', label: 'Scontrino ristorante', icon: 'receipt', build: sampleRestaurant },
  { id: 'kitchen', label: 'Comanda cucina', icon: 'chef-hat', build: sampleKitchen },
  { id: 'drawer', label: 'Apertura cassetto', icon: 'box', build: () => sampleDrawer() }
] as const
