import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

const SHOTS = join(process.cwd(), 'artifacts', 'screenshots')
const API_PORT = 9100
const QZ_PORT = 8182

let app: ElectronApplication
let page: Page

async function shot(name: string): Promise<void> {
  await page.waitForTimeout(450)
  await page.screenshot({ path: join(SHOTS, `${name}.png`) })
}
async function nav(name: string): Promise<void> {
  await page.click(`[data-testid="nav-${name}"]`)
  await page.waitForTimeout(350)
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'clicketta-e2e-'))
  app = await electron.launch({
    args: ['out/main/index.js', `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' }
  })
  page = await app.firstWindow()
  await page.waitForSelector('[data-testid="nav-dashboard"]', { timeout: 30_000 })
  // Give the servers a moment to bind their ports.
  await page.waitForTimeout(1200)
})

test.afterAll(async () => {
  await app.close()
})

test('boots and shows the seeded printers on the dashboard', async () => {
  await expect(page.locator('[data-testid="printer-card-Cucina"]')).toBeVisible()
  await expect(page.locator('[data-testid="printer-card-Bar"]')).toBeVisible()
  await expect(page.locator('[data-testid="printer-card-Cassa"]')).toBeVisible()
  await shot('01-dashboard')
})

test('creates a new virtual printer', async () => {
  await nav('printers')
  await page.click('[data-testid="new-printer"]')
  await page.fill('[data-testid="printer-name"]', 'Magazzino')
  await page.fill('[data-testid="printer-identifier"]', 'Magazzino')
  await page.click('[data-testid="printer-save"]')
  await expect(page.locator('[data-testid="printer-card-Magazzino"]')).toBeVisible({ timeout: 10_000 })
  await shot('02-printers')
})

test('sends a sample print and renders the receipt', async () => {
  await nav('printers')
  await page.click('[data-testid="printer-card-Cucina"]')
  await page.click('[data-testid="sample-restaurant"]')
  // The history view should then contain at least one row with a rendered receipt.
  await page.waitForTimeout(800)
  await nav('history')
  await expect(page.locator('[data-testid="history-row"]').first()).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-testid="history-row"]').first().click()
  await expect(page.locator('[data-testid="receipt"]')).toBeVisible()
  await shot('03-history-receipt')
  await page.keyboard.press('Escape')
})

test('the local REST API responds (real Electron runtime)', async () => {
  const health = await fetch(`http://127.0.0.1:${API_PORT}/api/health`)
  expect(health.status).toBe(200)

  const printersRes = await fetch(`http://127.0.0.1:${API_PORT}/api/printers`)
  const printers = (await printersRes.json()) as Array<{ identifier: string }>
  expect(printers.some((p) => p.identifier === 'Cucina')).toBe(true)

  // Drive a print through the HTTP API and confirm it is accepted.
  const escpos = Buffer.from('\x1b@API TEST\n\x1dV\x00').toString('base64')
  const printRes = await fetch(`http://127.0.0.1:${API_PORT}/api/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: 'Bar', data: escpos, encoding: 'base64' })
  })
  const printBody = (await printRes.json()) as { ok: boolean }
  expect(printBody.ok).toBe(true)
})

test('the QZ Tray compatibility websocket answers printers.find', async () => {
  const result = await new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${QZ_PORT}`)
    const timer = setTimeout(() => reject(new Error('QZ timeout')), 8000)
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.connected) {
        socket.send(JSON.stringify({ call: 'qz.printers.find', uid: 'e2e' }))
        return
      }
      if (msg.uid === 'e2e') {
        clearTimeout(timer)
        socket.close()
        resolve(msg.result)
      }
    })
    socket.on('error', reject)
  })
  expect(Array.isArray(result)).toBe(true)
  expect(result).toContain('Cucina')
})

test('captures the remaining views for review', async () => {
  await nav('monitor')
  await shot('04-monitor')
  await nav('simulations')
  await page.click('[data-testid="rate-50"]')
  await page.click('[data-testid="sim-start"]')
  await page.waitForTimeout(2500)
  await shot('05-simulations')
  await page.click('[data-testid="sim-stop"]')
  await nav('statistics')
  await shot('06-statistics')
  await nav('settings')
  await shot('07-settings')
  await nav('system')
  await shot('08-system')
})
