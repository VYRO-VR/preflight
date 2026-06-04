import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  SlimeVrLiveState,
  AppSettings,
  FlashRequest,
  PairingEvent,
  ReceiverDfuRequest
} from '@shared/types'

const api: Api = {
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info')
  },
  steamvr: {
    getInfo: () => ipcRenderer.invoke('steamvr:get-info')
  },
  slimevr: {
    getInstall: () => ipcRenderer.invoke('slimevr:get-install'),
    onLiveState: (cb: (state: SlimeVrLiveState) => void) => {
      const listener = (_e: unknown, state: SlimeVrLiveState) => cb(state)
      ipcRenderer.on('slimevr:live-state', listener)
      return () => ipcRenderer.removeListener('slimevr:live-state', listener)
    },
    connect: () => ipcRenderer.invoke('slimevr:connect'),
    disconnect: () => ipcRenderer.invoke('slimevr:disconnect')
  },
  usb: {
    detectReceiver: () => ipcRenderer.invoke('usb:detect-receiver')
  },
  receiver: {
    list: () => ipcRenderer.invoke('receiver:list'),
    startPairing: (path: string) => ipcRenderer.invoke('receiver:start-pairing', path),
    stopPairing: () => ipcRenderer.invoke('receiver:stop-pairing'),
    onPairingEvent: (cb: (event: PairingEvent) => void) => {
      const listener = (_e: unknown, event: PairingEvent) => cb(event)
      ipcRenderer.on('receiver:pairing-event', listener)
      return () => ipcRenderer.removeListener('receiver:pairing-event', listener)
    },
    readInfo: (path: string) => ipcRenderer.invoke('receiver:read-info', path),
    enterDfu: (path: string) => ipcRenderer.invoke('receiver:enter-dfu', path)
  },
  firmware: {
    getCatalog: () => ipcRenderer.invoke('firmware:get-catalog'),
    detectBootloaderDrives: () => ipcRenderer.invoke('firmware:detect-drives'),
    autoFlash: (req: FlashRequest) => ipcRenderer.invoke('firmware:auto-flash', req),
    downloadAsset: (assetUrl: string, assetName: string) =>
      ipcRenderer.invoke('firmware:download-asset', assetUrl, assetName),
    nrfutilAvailable: () => ipcRenderer.invoke('firmware:nrfutil-available'),
    flashReceiverDfu: (req: ReceiverDfuRequest) =>
      ipcRenderer.invoke('firmware:flash-receiver-dfu', req)
  },
  docs: {
    getPage: (slug: string) => ipcRenderer.invoke('docs:get-page', slug),
    openExternal: (url: string) => ipcRenderer.invoke('docs:open-external', url)
  },
  diagnostics: {
    export: () => ipcRenderer.invoke('diagnostics:export')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', patch)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    onUpdateStatus: (cb: (status: string) => void) => {
      const listener = (_e: unknown, status: string) => cb(status)
      ipcRenderer.on('app:update-status', listener)
      return () => ipcRenderer.removeListener('app:update-status', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
