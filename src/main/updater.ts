import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

/**
 * App auto-update against this repo's GitHub Releases (configured in
 * electron-builder.yml `publish`). Status strings are forwarded to the
 * renderer so the UI can surface "update available / downloading / ready".
 */
export function initAutoUpdater(win: BrowserWindow): void {
  // Never auto-update in dev — there is no published feed.
  if (!autoUpdater.isUpdaterActive?.()) {
    // noop guard for unpacked/dev runs
  }

  const send = (status: string) => {
    if (!win.isDestroyed()) win.webContents.send('app:update-status', status)
  }

  autoUpdater.autoDownload = true
  autoUpdater.on('checking-for-update', () => send('checking'))
  autoUpdater.on('update-available', () => send('available'))
  autoUpdater.on('update-not-available', () => send('none'))
  autoUpdater.on('download-progress', (p) => send(`downloading:${Math.round(p.percent)}`))
  autoUpdater.on('update-downloaded', () => send('ready'))
  autoUpdater.on('error', () => send('error'))

  try {
    autoUpdater.checkForUpdatesAndNotify()
  } catch {
    // Offline or no feed — ignore.
  }
}
