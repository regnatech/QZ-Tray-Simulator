import type { HistoryEntry, LogEntry, RenderDocument, RenderNode } from '@shared/types'

/** Plain-text reduction of a rendered document (used in CSV / PDF exports). */
export function renderedToText(rendered: string): string {
  let doc: RenderDocument
  try {
    doc = JSON.parse(rendered) as RenderDocument
  } catch {
    return ''
  }
  const out: string[] = []
  for (const node of doc.nodes as RenderNode[]) {
    switch (node.type) {
      case 'text':
        out.push(node.text)
        break
      case 'rule':
        out.push('-'.repeat(doc.columns))
        break
      case 'barcode':
        out.push(`[BARCODE ${node.symbology}: ${node.data}]`)
        break
      case 'qrcode':
        out.push(`[QRCODE: ${node.data}]`)
        break
      case 'image':
        out.push(`[IMAGE ${node.width}x${node.height}]`)
        break
      case 'feed':
        out.push('\n'.repeat(Math.max(0, node.lines - 1)))
        break
      case 'cut':
        out.push('-- ✂ --')
        break
      default:
        break
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function historyToJson(entries: HistoryEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      id: e.id,
      printer: e.printerName,
      date: new Date(e.createdAt).toISOString(),
      durationMs: e.durationMs,
      bytes: e.bytes,
      source: e.source,
      text: renderedToText(e.rendered)
    })),
    null,
    2
  )
}

function csvCell(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function historyToCsv(entries: HistoryEntry[]): string {
  const header = ['id', 'printer', 'date', 'time', 'durationMs', 'bytes', 'source', 'text']
  const rows = entries.map((e) => {
    const d = new Date(e.createdAt)
    return [
      e.id,
      e.printerName,
      d.toISOString().slice(0, 10),
      d.toTimeString().slice(0, 8),
      e.durationMs,
      e.bytes,
      e.source,
      renderedToText(e.rendered).replace(/\n/g, ' ⏎ ')
    ].map(csvCell).join(',')
  })
  return [header.join(','), ...rows].join('\n')
}

export function logsToText(logs: LogEntry[]): string {
  return logs
    .map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase().padEnd(7)} (${l.scope}) ${l.message}`)
    .join('\n')
}

/* ------------------------------- PDF export ------------------------------- */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/**
 * Build a minimal, valid multi-page PDF from monospaced text lines. Avoids a
 * heavyweight dependency while producing a file that opens in any viewer.
 */
export function buildTextPdf(title: string, lines: string[]): Uint8Array {
  const fontSize = 9
  const leading = 12
  const marginX = 40
  const marginTop = 800
  const linesPerPage = 60
  const pageWidth = 595
  const pageHeight = 842

  const allLines = [title, '='.repeat(title.length), '', ...lines]
  const pages: string[][] = []
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pages.push(allLines.slice(i, i + linesPerPage))
  }
  if (pages.length === 0) pages.push([title])

  const objects: string[] = []
  const fontObjNum = 3
  const pageObjStart = 4
  const contentObjStart = pageObjStart + pages.length

  const kids = pages.map((_, idx) => `${pageObjStart + idx} 0 R`).join(' ')
  // 1: Catalog, 2: Pages, 3: Font
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'

  pages.forEach((pageLines, idx) => {
    const contentNum = contentObjStart + idx
    objects[pageObjStart + idx] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>`

    let stream = `BT /F1 ${fontSize} Tf ${leading} TL ${marginX} ${marginTop} Td\n`
    pageLines.forEach((line, li) => {
      const safe = pdfEscape(line.replace(/[^\x20-\x7e]/g, '?'))
      stream += li === 0 ? `(${safe}) Tj\n` : `T* (${safe}) Tj\n`
    })
    stream += 'ET'
    objects[contentNum] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  // Assemble with a cross-reference table.
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  const totalObjects = contentObjStart + pages.length - 1
  for (let num = 1; num <= totalObjects; num++) {
    offsets[num] = pdf.length
    pdf += `${num} 0 obj\n${objects[num]}\nendobj\n`
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let num = 1; num <= totalObjects; num++) {
    pdf += `${String(offsets[num]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new TextEncoder().encode(pdf)
}

export function historyToPdf(entries: HistoryEntry[]): Uint8Array {
  const lines: string[] = []
  for (const e of entries) {
    lines.push(`# ${e.printerName}  -  ${new Date(e.createdAt).toLocaleString()}`)
    lines.push(`  ${e.durationMs}ms | ${e.bytes}B | ${e.source}`)
    lines.push('-'.repeat(60))
    for (const l of renderedToText(e.rendered).split('\n')) lines.push(`  ${l}`)
    lines.push('')
  }
  return buildTextPdf('Clicketta Thermal Simulator — Storico stampe', lines)
}
