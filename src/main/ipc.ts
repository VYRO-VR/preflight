import { ipcMain, app, type BrowserWindow } from 'electron'
import { getSystemInfo } from './services/system'
import { getSteamVrInfo } from './services/steamvr'
import { SlimeVrClient, getSlimeVrInstall } from './services/slimevr'
import { detectReceiver } from './services/usb'
import {
  getFirmwareCatalog,
  detectBootloaderDrives,
  autoFlash,
  downloadAsset
} from './services/firmware'
import { getDocPage, openExternal } from './services/docs'
import { exportDiagnostics } from './services/diagnostics'
import { getSettings, setSettings } from './services/settings'
import type { AppSettings, FlashRequest } from '@shared/types'

/**
 * Registers all IPC handlers. A single long-lived SlimeVrClient streams live
 * tracker state to the renderer over the 'slimevr:live-state' channel.
 */
export function registerIpc(win: BrowserWindow): SlimeVrClient {
  const slime = new SlimeVrClient()
  slime.on('state', (state) => {
    if (!win.isDestroyed()) win.webContents.send('slimevr:live-state', state)
  })

  ipcMain.handle('system:get-info', () => getSystemInfo())
  ipcMain.handle('steamvr:get-info', () => getSteamVrInfo())

  ipcMain.handle('slimevr:get-install', () => getSlimeVrInstall())
  ipcMain.handle('slimevr:connect', () => slime.connect())
  ipcMain.handle('slimevr:disconnect', () => slime.disconnect())

  ipcMain.handle('usb:detect-receiver', () => detectReceiver())

  ipcMain.handle('firmware:get-catalog', () => getFirmwareCatalog())
  ipcMain.handle('firmware:detect-drives', () => detectBootloaderDrives())
  ipcMain.handle('firmware:auto-flash', (_e, req: FlashRequest) => autoFlash(req))
  ipcMain.handle('firmware:download-asset', (_e, url: string, name: string) =>
    downloadAsset(url, name)
  )

  ipcMain.handle('docs:get-page', (_e, slug: string) => getDocPage(slug))
  ipcMain.handle('docs:open-external', (_e, url: string) => openExternal(url))

  ipcMain.handle('diagnostics:export', () => exportDiagnostics(slime.getState()))

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => setSettings(patch))

  ipcMain.handle('app:get-version', () => app.getVersion())

  return slime
}
