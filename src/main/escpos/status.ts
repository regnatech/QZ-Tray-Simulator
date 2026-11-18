import type { ErrorKind } from '@shared/types'
import { DLE, GS } from './commands'

const EOT = 0x04
/** GS r n  transmit status. */
const GS_R = 0x72

export type StatusQuery = { cmd: 'dle_eot'; n: number } | { cmd: 'gs_r'; n: number }

/**
 * Incremental scanner for the status requests a host can send to a network
 * printer. Requests may be split across TCP segments, so an incomplete trailing
 * prefix is carried over to the next {@link feed} call.
 */
export class StatusQueryScanner {
  private carry: number[] = []

  feed(chunk: Uint8Array): StatusQuery[] {
    const buf = this.carry.length ? Uint8Array.from([...this.carry, ...chunk]) : chunk
    this.carry = []
    const out: StatusQuery[] = []
    let i = 0
    while (i < buf.length) {
      const b = buf[i]
      if (b !== DLE && b !== GS) {
        i++
        continue
      }
      const second = b === DLE ? EOT : GS_R
      if (i + 1 >= buf.length) {
        this.carry = [b]
        break
      }
      if (buf[i + 1] !== second) {
        i++
        continue
      }
      if (i + 2 >= buf.length) {
        this.carry = [b, second]
        break
      }
      const n = buf[i + 2]
      if (b === DLE && n >= 1 && n <= 4) out.push({ cmd: 'dle_eot', n })
      else if (b === GS && (n === 1 || n === 2 || n === 49 || n === 50)) out.push({ cmd: 'gs_r', n: n & 0x0f })
      i += 3
    }
    return out
  }
}

export interface StatusContext {
  enabled: boolean
  errors: ReadonlySet<ErrorKind>
}

/**
 * Build the single status byte an Epson-compatible printer answers with.
 * Bit layouts follow the ESC/POS reference for DLE EOT n and GS r n.
 */
export function statusByte(query: StatusQuery, { enabled, errors }: StatusContext): number {
  const has = (k: ErrorKind): boolean => errors.has(k)

  if (query.cmd === 'gs_r') {
    // n=1 paper sensor, n=2 drawer kick-out connector (always closed here).
    if (query.n !== 1) return 0x00
    return (has('paper_low') ? 0x03 : 0) | (has('paper_empty') ? 0x0c : 0)
  }

  // DLE EOT responses always carry the fixed bits 1 and 4.
  let byte = 0x12
  switch (query.n) {
    case 1: {
      const offline =
        !enabled || has('offline') || has('cover_open') || has('paper_empty') || has('generic') || has('buffer_full')
      if (offline) byte |= 0x08
      break
    }
    case 2:
      if (has('cover_open')) byte |= 0x04
      if (has('paper_empty')) byte |= 0x20
      if (has('generic') || has('buffer_full')) byte |= 0x40
      break
    case 3:
      if (has('generic')) byte |= 0x20 // unrecoverable error
      if (has('buffer_full')) byte |= 0x40 // automatically recoverable error
      break
    case 4:
      if (has('paper_low')) byte |= 0x0c
      if (has('paper_empty')) byte |= 0x60
      break
  }
  return byte
}

/**
 * True when a payload carries nothing but initialisation and status/realtime
 * commands, i.e. a host polling the printer rather than sending a print job.
 */
export function isStatusOnly(bytes: Uint8Array): boolean {
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    const next = bytes[i + 1]
    if (b === 0x00) i += 1
    else if (b === 0x1b && next === 0x40) i += 2 // ESC @
    else if (b === DLE && (next === EOT || next === 0x05)) i += 3 // DLE EOT n / DLE ENQ n
    else if (b === DLE && next === 0x14) i += 5 // DLE DC4 fn m t
    else if (b === GS && (next === GS_R || next === 0x49 || next === 0x61)) i += 3 // GS r / GS I / GS a
    else return false
  }
  return true
}
