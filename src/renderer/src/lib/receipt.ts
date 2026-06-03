import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { RenderDocument } from '@shared/types'

export function parseRendered(rendered: string): RenderDocument | null {
  try {
    return JSON.parse(rendered) as RenderDocument
  } catch {
    return null
  }
}

export async function qrDataUrl(data: string, size = 4): Promise<string> {
  try {
    return await QRCode.toDataURL(data || ' ', {
      margin: 1,
      scale: Math.max(2, Math.min(8, size)),
      color: { dark: '#111111', light: '#f7f6f2' },
      errorCorrectionLevel: 'M'
    })
  } catch {
    return ''
  }
}

/** Map ESC/POS symbology names to JsBarcode format identifiers. */
const BARCODE_FORMAT: Record<string, string> = {
  'UPC-A': 'UPC',
  'UPC-E': 'UPC',
  EAN13: 'EAN13',
  EAN8: 'EAN8',
  CODE39: 'CODE39',
  CODE93: 'CODE128',
  CODE128: 'CODE128',
  ITF: 'ITF',
  CODABAR: 'codabar'
}

export function barcodeSvg(data: string, symbology: string, hri: boolean): string {
  const format = BARCODE_FORMAT[symbology] ?? 'CODE128'
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const render = (fmt: string): boolean => {
    try {
      JsBarcode(node, data || '0', {
        format: fmt,
        width: 2,
        height: 56,
        displayValue: hri,
        margin: 4,
        background: '#f7f6f2',
        lineColor: '#111111',
        fontSize: 13
      })
      return true
    } catch {
      return false
    }
  }
  if (!render(format)) render('CODE128')
  return node.outerHTML
}
