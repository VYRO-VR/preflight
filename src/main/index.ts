import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { initAutoUpdater } from './updater'

const devUrl = process.env['ELECTRON_RENDERER_URL']

// Load a renderer HTML page in both dev (vite server) and packaged (file) modes.
function loadRendererPage(win: BrowserWindow, page: string): void {
  if (devUrl) {
    win.loadURL(`${devUrl}/${page}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}`))
  }
}

// A tiny frameless window shown immediately at launch. It has no React bundle,
// so it paints almost instantly and covers the gap until the main window is
// ready-to-show (the React app + device detection take a moment to boot).
function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 360,
    height: 420,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#0e1118',
    title: 'VYRO VR Preflight'
  })
  splash.once('ready-to-show', () => splash.show())
  loadRendererPage(splash, 'splash.html')
  return splash
}

function createWindow(splash?: BrowserWindow): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#0e1118',
    autoHideMenuBar: true,
    title: 'VYRO VR Preflight',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const reveal = (): void => {
    if (win.isDestroyed()) return
    win.show()
    if (splash && !splash.isDestroyed()) splash.destroy()
  }

  win.once('ready-to-show', reveal)
  // Safety net: never leave the user stuck on the splash if ready-to-show is
  // delayed or never fires (e.g. a renderer load hiccup).
  setTimeout(reveal, 15000)

  // Open target=_blank / external links in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const splash = createSplashWindow()
  const win = createWindow(splash)
  const { slime, receiver, console: receiverConsole, bulkFlash } = registerIpc(win)

  if (app.isPackaged) {
    initAutoUpdater(win)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Tear down long-lived device connections on quit. stopPairing also takes the
  // receiver out of pairing mode, so quitting while the pairing screen is still
  // active doesn't strand the receiver in pairing mode (the renderer's own
  // cleanup can't be relied on to flush during app teardown).
  app.on('before-quit', () => {
    slime.disconnect()
    receiver.stopPairing()
    // Release the calibration console's port too; unlike pairing it puts the
    // receiver in no special mode, so closing it is all that is needed.
    void receiverConsole.close()
    // Abort the developer bulk-flash loop so no nrfutil child outlives the app.
    void bulkFlash.stop()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
