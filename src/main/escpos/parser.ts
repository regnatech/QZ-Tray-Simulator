import type {
  Alignment,
  PaperWidth,
  RenderDocument,
  RenderNode,
  TextStyle
} from '@shared/types'
import {
  BARCODE_SYMBOLOGY,
  BEL,
  COLUMNS_FONT_A,
  COLUMNS_FONT_B,
  CP437_HIGH,
  CR,
  ESC,
  GS,
  HT,
  LF,
  NUL
} from './commands'

export interface ParseOptions {
  paperWidth?: PaperWidth
}

const ALIGN_BY_CODE: Record<number, Alignment> = { 0: 'left', 1: 'center', 2: 'right' }

function defaultStyle(): TextStyle {
  return {
    bold: false,
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    invert: false,
    align: 'left',
    font: 'A'
  }
}

function decodeByte(b: number): string {
  if (b >= 0x20 && b <= 0x7e) return String.fromCharCode(b)
  if (b >= 0x80) return CP437_HIGH[b] ?? String.fromCharCode(b)
  return ''
}

/**
 * Parse a raw ESC/POS byte stream into a structured, renderable document.
 *
 * The parser is intentionally tolerant: unknown commands are skipped using the
 * known length of their parameter block so that a single unrecognised escape
 * never corrupts the rest of the receipt.
 */
export function parseEscPos(input: Uint8Array, opts: ParseOptions = {}): RenderDocument {
  const paperWidth: PaperWidth = opts.paperWidth ?? 80
  const nodes: RenderNode[] = []
  const effects = { cut: false, drawerOpen: false, beeps: 0 }

  const ctx: QrContext = { data: '', size: 4 }
  let style = defaultStyle()
  let textRun = ''

  const flush = (): void => {
    if (textRun.length === 0) return
    nodes.push({ type: 'text', text: textRun, style: { ...style } })
    textRun = ''
  }

  /** Emit a control node, flushing any pending text first. */
  const push = (node: RenderNode): void => {
    flush()
    nodes.push(node)
  }

  let i = 0
  const n = input.length

  while (i < n) {
    const b = input[i]

    /* ---- Printable / whitespace text ---- */
    if (b === LF) {
      textRun += '\n'
      i += 1
      continue
    }
    if (b === CR) {
      i += 1
      continue
    }
    if (b === HT) {
      textRun += '\t'
      i += 1
      continue
    }
    if (b === BEL) {
      effects.beeps += 1
      push({ type: 'beep', count: 1 })
      i += 1
      continue
    }
    if (b !== ESC && b !== GS && b >= 0x20) {
      textRun += decodeByte(b)
      i += 1
      continue
    }

    /* ---- ESC commands ---- */
    if (b === ESC) {
      const cmd = input[i + 1]
      switch (cmd) {
        case 0x40: // ESC @  initialize
          flush()
          style = defaultStyle()
          i += 2
          break
        case 0x45: {
          // ESC E n  emphasize (bold)
          flush()
          style.bold = (input[i + 2] & 0x01) === 1
          i += 3
          break
        }
        case 0x47: {
          // ESC G n  double-strike (treat as bold)
          flush()
          style.bold = (input[i + 2] & 0x01) === 1
          i += 3
          break
        }
        case 0x2d: {
          // ESC - n  underline
          flush()
          style.underline = (input[i + 2] & 0x03) !== 0
          i += 3
          break
        }
        case 0x61: {
          // ESC a n  justification
          flush()
          style.align = ALIGN_BY_CODE[input[i + 2] & 0x03] ?? 'left'
          i += 3
          break
        }
        case 0x21: {
          // ESC ! n  select print mode
          flush()
          const m = input[i + 2]
          style.font = (m & 0x01) === 1 ? 'B' : 'A'
          style.bold = (m & 0x08) !== 0
          style.doubleHeight = (m & 0x10) !== 0
          style.doubleWidth = (m & 0x20) !== 0
          style.underline = (m & 0x80) !== 0
          i += 3
          break
        }
        case 0x4d: {
          // ESC M n  select font
          flush()
          style.font = (input[i + 2] & 0x01) === 1 ? 'B' : 'A'
          i += 3
          break
        }
        case 0x70: {
          // ESC p m t1 t2  generate pulse (open drawer)
          effects.drawerOpen = true
          push({ type: 'drawer' })
          i += 5
          break
        }
        case 0x42: {
          // ESC B n t  buzzer/beep (non-standard, common on clones)
          const count = input[i + 2] ?? 1
          effects.beeps += count
          push({ type: 'beep', count })
          i += 4
          break
        }
        case 0x64: {
          // ESC d n  print and feed n lines
          push({ type: 'feed', lines: input[i + 2] ?? 0 })
          i += 3
          break
        }
        case 0x4a: {
          // ESC J n  print and feed n dots -> approximate as a small feed
          push({ type: 'feed', lines: (input[i + 2] ?? 0) > 0 ? 1 : 0 })
          i += 3
          break
        }
        case 0x33: // ESC 3 n  set line spacing
          i += 3
          break
        case 0x32: // ESC 2  default line spacing
          i += 2
          break
        case 0x74: // ESC t n  select code page
          i += 3
          break
        case 0x52: // ESC R n  international charset
          i += 3
          break
        case 0x7b: // ESC { n  upside-down
          i += 3
          break
        case 0x2a: {
          // ESC * m nL nH ...  bit image
          const m = input[i + 2]
          const nL = input[i + 3] ?? 0
          const nH = input[i + 4] ?? 0
          const cols = nL + nH * 256
          const bytesPerCol = m === 0 || m === 1 ? 1 : 3
          i += 5 + cols * bytesPerCol
          break
        }
        default:
          // Unknown 2-byte escape; skip conservatively.
          i += 2
          break
      }
      continue
    }

    /* ---- GS commands ---- */
    if (b === GS) {
      const cmd = input[i + 1]
      switch (cmd) {
        case 0x21: {
          // GS ! n  character size
          flush()
          const m = input[i + 2]
          style.doubleWidth = ((m >> 4) & 0x0f) >= 1
          style.doubleHeight = (m & 0x0f) >= 1
          i += 3
          break
        }
        case 0x42: {
          // GS B n  reverse (white/black)
          flush()
          style.invert = (input[i + 2] & 0x01) === 1
          i += 3
          break
        }
        case 0x56: {
          // GS V  paper cut
          const m = input[i + 2]
          const partial = m === 1 || m === 66
          // Forms with feed (65/66) carry an extra parameter byte.
          const advance = m === 65 || m === 66 ? 4 : 3
          push({ type: 'cut', partial })
          effects.cut = true
          i += advance
          break
        }
        case 0x6b: {
          // GS k  barcode
          const next = i + parseBarcode(input, i, push)
          i = next
          break
        }
        case 0x28: {
          if (input[i + 2] === 0x6b) {
            // GS ( k  2D code (QR)
            i = parseGsParenK(input, i, push, ctx)
          } else {
            // Other GS ( x  function — skip using pL pH length.
            const pL = input[i + 3] ?? 0
            const pH = input[i + 4] ?? 0
            i += 5 + pL + pH * 256
          }
          break
        }
        case 0x76: {
          // GS v 0  raster bit image
          if (input[i + 2] === 0x30) {
            i = parseRaster(input, i, push)
          } else {
            i += 3
          }
          break
        }
        case 0x48: // GS H n  HRI position
        case 0x66: // GS f n  HRI font
        case 0x77: // GS w n  barcode width
        case 0x68: // GS h n  barcode height
          i += 3
          break
        case 0x4c: // GS L nL nH  left margin
        case 0x57: // GS W nL nH  print area width
          i += 4
          break
        default:
          i += 2
          break
      }
      continue
    }

    // Fallback: consume one byte.
    i += 1
  }

  flush()

  return { paperWidth, columns: columnsFor(paperWidth, 'A'), nodes, effects }
}

export function columnsFor(width: PaperWidth, font: 'A' | 'B'): number {
  const table = font === 'B' ? COLUMNS_FONT_B : COLUMNS_FONT_A
  return table[width] ?? 48
}

/** Returns the number of bytes consumed by the GS k barcode command. */
function parseBarcode(input: Uint8Array, i: number, push: (n: RenderNode) => void): number {
  const m = input[i + 2]
  const symbology = BARCODE_SYMBOLOGY[m] ?? 'CODE128'
  let data = ''
  let consumed: number

  if (m >= 65) {
    // GS k m n d1...dn  (length-prefixed form)
    const len = input[i + 3] ?? 0
    for (let k = 0; k < len; k++) data += String.fromCharCode(input[i + 4 + k] ?? 0)
    consumed = 4 + len
  } else {
    // GS k m d1...dk NUL  (null-terminated form)
    let k = i + 3
    while (k < input.length && input[k] !== NUL) {
      data += String.fromCharCode(input[k])
      k++
    }
    consumed = k - i + 1 // include NUL
  }

  // CODE128 payloads frequently start with a code-set selector ({A/{B/{C).
  const clean = data.replace(/^\{[ABC]/, '')

  push({
    type: 'barcode',
    data: clean,
    symbology,
    align: 'left',
    width: 2,
    height: 64,
    hri: true
  })

  return consumed
}

interface QrContext {
  data: string
  size: number
}

/** GS ( k — QR code (and other 2D symbologies). Returns the new cursor index. */
function parseGsParenK(
  input: Uint8Array,
  i: number,
  push: (n: RenderNode) => void,
  ctx: QrContext
): number {
  // GS ( k builds a symbol across several function calls. We track the data
  // (fn 80) and module size (fn 67), then emit on print (fn 81).
  const pL = input[i + 3] ?? 0
  const pH = input[i + 4] ?? 0
  const len = pL + pH * 256
  const cn = input[i + 5]
  const fn = input[i + 6]
  const total = 5 + len

  if (cn === 49 && fn === 80) {
    // Function 080: store the data in the symbol storage area.
    // Layout: pL pH cn fn m d1...dk  (m at offset 7, data from offset 8)
    let data = ''
    for (let k = i + 8; k < i + 5 + len; k++) data += String.fromCharCode(input[k])
    ctx.data = data
  } else if (cn === 49 && fn === 81) {
    // Function 081: print the symbol stored in the storage area.
    push({ type: 'qrcode', data: ctx.data, align: 'left', size: ctx.size })
    ctx.data = ''
  } else if (cn === 49 && fn === 67) {
    // Function 067: set module size.
    ctx.size = input[i + 7] ?? 4
  }

  return i + total
}

/** GS v 0 — raster bit image. Returns the new cursor index. */
function parseRaster(input: Uint8Array, i: number, push: (n: RenderNode) => void): number {
  const xL = input[i + 4] ?? 0
  const xH = input[i + 5] ?? 0
  const yL = input[i + 6] ?? 0
  const yH = input[i + 7] ?? 0
  const widthBytes = xL + xH * 256
  const height = yL + yH * 256
  const width = widthBytes * 8
  const dataStart = i + 8
  const dataLen = widthBytes * height

  const pixels: number[] = []
  for (let row = 0; row < height; row++) {
    for (let bytePos = 0; bytePos < widthBytes; bytePos++) {
      const byte = input[dataStart + row * widthBytes + bytePos] ?? 0
      for (let bit = 7; bit >= 0; bit--) pixels.push((byte >> bit) & 1)
    }
  }

  if (width > 0 && height > 0 && height < 2000) {
    push({ type: 'image', width, height, pixels, align: 'center' })
  }

  return dataStart + dataLen
}
