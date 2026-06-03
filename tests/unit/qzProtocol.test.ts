import { describe, expect, it } from 'vitest'
import { makeHarness } from './helpers'
import { decodeQzPrintData, handleQzMessage } from '../../src/main/server/qzProtocol'
import { sampleReceipt } from '../../src/main/escpos/builder'

function call(method: string, params?: Record<string, unknown>, uid = 'u1'): string {
  return JSON.stringify({ call: method, params, uid })
}

describe('decodeQzPrintData', () => {
  it('decodes base64 entries', () => {
    const b64 = Buffer.from('AB').toString('base64')
    const bytes = decodeQzPrintData([{ type: 'raw', format: 'base64', data: b64 }])
    expect([...bytes]).toEqual([0x41, 0x42])
  })
  it('decodes plain string and hex entries and concatenates them', () => {
    const bytes = decodeQzPrintData(['Hi', { type: 'raw', format: 'hex', data: '0a' }])
    expect([...bytes]).toEqual([0x48, 0x69, 0x0a])
  })
})

describe('handleQzMessage', () => {
  it('returns the QZ version', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage(call('qz.getVersion'), manager)
    expect(res?.result).toBe('2.2.4')
  })

  it('lists every enabled printer identifier on find()', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage(call('qz.printers.find'), manager)
    expect(res?.result).toEqual(['Cucina', 'Bar', 'Cassa'])
  })

  it('returns a single name for an exact find() query', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage(call('qz.printers.find', { query: 'Bar' }), manager)
    expect(res?.result).toBe('Bar')
  })

  it('errors when find() matches nothing', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage(call('qz.printers.find', { query: 'zzz' }), manager)
    expect(res?.error).toBeDefined()
  })

  it('returns a default printer', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage(call('qz.printers.getDefault'), manager)
    expect(res?.result).toBe('Cucina')
  })

  it('processes a qz.print job and records history', async () => {
    const { manager, store } = makeHarness()
    const data = Buffer.from(sampleReceipt(99)).toString('base64')
    const res = await handleQzMessage(
      call('qz.print', { printer: 'Cucina', data: [{ type: 'raw', format: 'base64', data }] }),
      manager
    )
    expect(res?.error).toBeUndefined()
    expect(store.countHistory()).toBe(1)
  })

  it('accepts a printer object with a name field', async () => {
    const { manager, store } = makeHarness()
    const data = Buffer.from(sampleReceipt(1)).toString('base64')
    const res = await handleQzMessage(
      call('qz.print', { printer: { name: 'Bar' }, data: [{ type: 'raw', format: 'base64', data }] }),
      manager
    )
    expect(res?.error).toBeUndefined()
    expect(store.listHistory({ limit: 5 })[0].printerName).toBe('Bar')
  })

  it('fails gracefully on invalid JSON', async () => {
    const { manager } = makeHarness()
    const res = await handleQzMessage('{not json', manager)
    expect(res?.error).toBe('Invalid JSON')
  })
})
