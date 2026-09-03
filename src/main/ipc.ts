import { ipcMain, app, type BrowserWindow } from 'electron'
import path from 'path'
import { BULK_FLASH } from '@shared/config'
import { getSystemInfo } from './services/system'
import { getSteamVrInfo } from './services/steamvr'
import { SlimeVrClient, getSlimeVrInstall } from './services/slimevr'
import { detectReceiver } from './services/usb'
import {
  ReceiverPairingClient,
  listReceivers,
  readReceiverInfo,
  enterReceiverDfu
} from './services/receiver-serial'
import { ReceiverConsoleClient } from './services/receiver-console'
import {
  getFirmwareCatalog,
  detectBootloaderDrives,
  autoFlash,
  downloadAsset,
  flashReceiverDfu
} from './services/firmware'
import { nrfutilAvailable } from './services/nrfutil'
import { BulkFlashSession } from './services/bulk-flash'
import { getDocPage, openExternal } from './services/docs'
import { exportDiagnostics } from './services/diagnostics'
import { getSettings, setSettings } from './services/settings'
import type { AppSettings, FlashRequest, ReceiverDfuRequest, SensCalRequest } from '@shared/types'

/**
 * Registers all IPC handlers. A single long-lived SlimeVrClient streams live
 * tracker state to the renderer over the 'slimevr:live-state' channel. Returns
 * the long-lived clients so the app lifecycle can tear them down on quit — in
 * particular taking the receiver out of pairing mode if the user quits while
 * the pairing screen is still active.
 *
 * Pairing and the calibration console both want the receiver's serial port,
 * which is exclusive. This is the one place that owns both clients, so it is
 * where that exclusion is enforced: starting either refuses while the other
 * holds the port, rather than failing later with an opaque serial error.
 */
export function registerIpc(win: BrowserWindow): {
  slime: SlimeVrClient
  receiver: ReceiverPairingClient
  console: ReceiverConsoleClient
  bulkFlash: BulkFlashSession
} {
  const slime = new SlimeVrClient()
  slime.on('state', (state) => {
    if (!win.isDestroyed()) win.webContents.send('slimevr:live-state', state)
  })

  const receiver = new ReceiverPairingClient()
  receiver.on('event', (event) => {
    if (!win.isDestroyed()) win.webContents.send('receiver:pairing-event', event)
  })

  const receiverConsole = new ReceiverConsoleClient()
  receiverConsole.on('event', (event) => {
    if (!win.isDestroyed()) win.webContents.send('receiver:console-event', event)
  })

  // The developer bulk-flash loop programs the bundled bootloader hex, shipped
  // as an extraResource in packaged builds and read from resources/ in dev.
  const bulkFlashHex = app.isPackaged
    ? path.join(process.resourcesPath, BULK_FLASH.hexResourceDir, BULK_FLASH.hexFileName)
    : path.join(app.getAppPath(), 'resources', BULK_FLASH.hexResourceDir, BULK_FLASH.hexFileName)
  const bulkFlash = new BulkFlashSession(bulkFlashHex)
  bulkFlash.on('event', (event) => {
    if (!win.isDestroyed()) win.webContents.send('dev:bulk-flash-event', event)
  })

  ipcMain.handle('system:get-info', () => getSystemInfo())
  ipcMain.handle('steamvr:get-info', () => getSteamVrInfo())

  ipcMain.handle('slimevr:get-install', () => getSlimeVrInstall())
  ipcMain.handle('slimevr:connect', () => slime.connect())
  ipcMain.handle('slimevr:disconnect', () => slime.disconnect())
  ipcMain.handle('slimevr:set-feed-rate', (_e, ms: number) => slime.setFeedRate(ms))

  ipcMain.handle('usb:detect-receiver', () => detectReceiver())

  ipcMain.handle('receiver:list', () => listReceivers())
  ipcMain.handle('receiver:start-pairing', (_e, path: string) => {
    if (receiverConsole.getState().open) {
      throw new Error('The receiver is busy with a calibration session.')
    }
    return receiver.startPairing(path)
  })
  ipcMain.handle('receiver:stop-pairing', () => receiver.stopPairing())
  ipcMain.handle('receiver:get-pairing-state', () => receiver.getState())
  ipcMain.handle('receiver:read-info', (_e, path: string) => readReceiverInfo(path))
  ipcMain.handle('receiver:enter-dfu', (_e, path: string) => enterReceiverDfu(path))

  ipcMain.handle('receiver:open-console', (_e, path: string) => {
    if (receiver.getState().active) {
      throw new Error('The receiver is in pairing mode. Leave pairing first.')
    }
    return receiverConsole.open(path)
  })
  ipcMain.handle('receiver:close-console', () => receiverConsole.close())
  ipcMain.handle('receiver:get-console-state', () => receiverConsole.getState())
  ipcMain.handle('receiver:list-slots', () => receiverConsole.listSlots())
  ipcMain.handle('receiver:start-sens-cal', (_e, req: SensCalRequest) =>
    receiverConsole.startSensCal(req)
  )

  ipcMain.handle('firmware:get-catalog', () => getFirmwareCatalog())
  ipcMain.handle('firmware:detect-drives', () => detectBootloaderDrives())
  ipcMain.handle('firmware:auto-flash', (_e, req: FlashRequest) => autoFlash(req))
  ipcMain.handle('firmware:download-asset', (_e, url: string, name: string) =>
    downloadAsset(url, name)
  )
  ipcMain.handle('firmware:nrfutil-available', () => nrfutilAvailable())
  ipcMain.handle('firmware:flash-receiver-dfu', (_e, req: ReceiverDfuRequest) =>
    flashReceiverDfu(req)
  )

  ipcMain.handle('docs:get-page', (_e, slug: string) => getDocPage(slug))
  ipcMain.handle('docs:open-external', (_e, url: string) => openExternal(url))

  ipcMain.handle('diagnostics:export', () => exportDiagnostics(slime.getState()))

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => setSettings(patch))

  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('dev:bulk-flash-start', () => bulkFlash.start())
  ipcMain.handle('dev:bulk-flash-stop', () => bulkFlash.stop())

  return { slime, receiver, console: receiverConsole, bulkFlash }
}
