/** ESC/POS control byte constants. */
export const ESC = 0x1b
export const GS = 0x1d
export const FS = 0x1c
export const LF = 0x0a
export const CR = 0x0d
export const HT = 0x09
export const NUL = 0x00
export const BEL = 0x07

/** Number of characters per line for Font A at a given paper width. */
export const COLUMNS_FONT_A: Record<number, number> = {
  58: 32,
  80: 48
}

/** Font B is condensed (~1.33x more columns). */
export const COLUMNS_FONT_B: Record<number, number> = {
  58: 42,
  80: 64
}

/**
 * Minimal CP437 upper-range (0x80-0xFF) mapping for the glyphs that actually
 * show up on thermal receipts (box drawing, currency, accents). Everything
 * else falls back to the raw code point.
 */
export const CP437_HIGH: Record<number, string> = {
  0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à',
  0x86: 'å', 0x87: 'ç', 0x88: 'ê', 0x89: 'ë', 0x8a: 'è', 0x8b: 'ï',
  0x8c: 'î', 0x8d: 'ì', 0x8e: 'Ä', 0x8f: 'Å', 0x90: 'É', 0x91: 'æ',
  0x92: 'Æ', 0x93: 'ô', 0x94: 'ö', 0x95: 'ò', 0x96: 'û', 0x97: 'ù',
  0x98: 'ÿ', 0x99: 'Ö', 0x9a: 'Ü', 0x9b: '¢', 0x9c: '£', 0x9d: '¥',
  0xa0: 'á', 0xa1: 'í', 0xa2: 'ó', 0xa3: 'ú', 0xa4: 'ñ', 0xa5: 'Ñ',
  0xb0: '░', 0xb1: '▒', 0xb2: '▓', 0xb3: '│', 0xb4: '┤', 0xbf: '┐',
  0xc0: '└', 0xc1: '┴', 0xc2: '┬', 0xc3: '├', 0xc4: '─', 0xc5: '┼',
  0xd9: '┘', 0xda: '┌', 0xdb: '█', 0xe1: 'ß', 0xf8: '°', 0xfd: '²'
}

/** GS k barcode symbology codes (m value) -> JsBarcode/format name. */
export const BARCODE_SYMBOLOGY: Record<number, string> = {
  0: 'UPC-A',
  1: 'UPC-E',
  2: 'EAN13',
  3: 'EAN8',
  4: 'CODE39',
  5: 'ITF',
  6: 'CODABAR',
  65: 'UPC-A',
  66: 'UPC-E',
  67: 'EAN13',
  68: 'EAN8',
  69: 'CODE39',
  70: 'ITF',
  71: 'CODABAR',
  72: 'CODE93',
  73: 'CODE128'
}
