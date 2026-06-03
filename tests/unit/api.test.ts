import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createApiApp } from '../../src/main/server/apiServer'
import { makeHarness } from './helpers'
import { sampleReceipt } from '../../src/main/escpos/builder'

let server: Server
let base: string
const harness = makeHarness()

beforeAll(async () => {
  const app = createApiApp({ manager: harness.manager, store: harness.store, log: harness.log })
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  const port = (server.address() as AddressInfo).port
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('local REST API', () => {
  it('GET /api/health', async () => {
    const res = await fetch(`${base}/api/health`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('GET /api/printers returns the seeded printers with runtime', async () => {
    const res = await fetch(`${base}/api/printers`)
    const body = await res.json() as any
    expect(body).toHaveLength(3)
    expect(body[0]).toHaveProperty('queue')
    expect(body[0]).toHaveProperty('jobsReceived')
  })

  it('POST /api/print accepts a base64 payload', async () => {
    const data = Buffer.from(sampleReceipt(123)).toString('base64')
    const res = await fetch(`${base}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: 'Cassa', data, encoding: 'base64' })
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('POST /api/print rejects a missing printer', async () => {
    const res = await fetch(`${base}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'abc' })
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/print reports unknown printers as 422', async () => {
    const res = await fetch(`${base}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: 'Ghost', data: 'AQ==' })
    })
    expect(res.status).toBe(422)
  })

  it('GET /api/history reflects submitted jobs', async () => {
    const res = await fetch(`${base}/api/history`)
    const body = await res.json() as any
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('GET /api/stats returns a summary', async () => {
    const res = await fetch(`${base}/api/stats`)
    const body = await res.json() as any
    expect(body).toHaveProperty('totalJobs')
    expect(body).toHaveProperty('daily')
  })
})
