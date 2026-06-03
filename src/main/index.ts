import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { openStore } from './db'
import { AppContext } from './context'
import { registerIpc } from './ipc'

let ctx: AppContext | null = null

const isDev = !app.isPackaged

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0e17',
    title: 'Clicketta Thermal Simulator',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    await win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function bootstrap(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'clicketta.sqlite')
  const store = await openStore(dbPath)
  ctx = new AppContext(store, dbPath)
  registerIpc(ctx)
  await ctx.init()
  await createWindow()
}

app.whenReady().then(bootstrap).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err)
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async (event) => {
  if (ctx) {
    event.preventDefault()
    const disposing = ctx
    ctx = null
    await disposing.dispose()
    app.exit(0)
  }
})
