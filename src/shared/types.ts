// Domain + IPC types shared across main, preload, and renderer.

export type CheckStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail'

export interface CheckResult {
  status: CheckStatus
  /** Short human-readable summary, e.g. "Windows 11 (x64)". */
  label: string
  /** Optional longer detail / remediation hint. */
  detail?: string
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductId = 'core' | 'advanced' | 'full-body'

export interface ProductDef {
  id: ProductId
  name: string
  trackerCount: number
  description: string
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface SystemInfo {
  platform: NodeJS.Platform
  osName: string
  osVersion: string
  arch: string
  is64Bit: boolean
  totalMemoryGb: number
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// SteamVR
// ---------------------------------------------------------------------------

export interface SteamVrInfo {
  installed: boolean
  installPath?: string
  /** Whether the SlimeVR OpenVR driver is registered with SteamVR. */
  slimevrDriverRegistered: boolean
}

// ---------------------------------------------------------------------------
// SlimeVR Server
// ---------------------------------------------------------------------------

export interface SlimeVrInstall {
  installed: boolean
  installPath?: string
  version?: string
}

export interface TrackerInfo {
  id: string
  name: string
  bodyPart?: string
  /** 0..1 */
  batteryLevel?: number
  batteryVoltage?: number
  /** Signal strength in dBm (negative). */
  rssi?: number
  firmwareVersion?: string
  status: 'ok' | 'disconnected' | 'busy' | 'error' | 'unknown'
}

export interface SlimeVrLiveState {
  connected: boolean
  serverVersion?: string
  trackers: TrackerInfo[]
}

// ---------------------------------------------------------------------------
// USB receiver
// ---------------------------------------------------------------------------

export interface UsbDeviceMatch {
  detected: boolean
  description?: string
  vendorId?: string
  productId?: string
  /** COM port if the device exposes a serial interface. */
  comPort?: string
}

// ---------------------------------------------------------------------------
// Firmware
// ---------------------------------------------------------------------------

export interface FirmwareRelease {
  tag: string
  name: string
  publishedAt: string
  notes: string
  prerelease: boolean
  /** True when release notes / metadata mark this as the recommended build. */
  recommended: boolean
  assets: FirmwareAsset[]
}

export interface FirmwareAsset {
  name: string
  downloadUrl: string
  sizeBytes: number
}

export interface FirmwareCatalog {
  /** False until the firmware repo / releases exist. */
  configured: boolean
  source: string
  recommended?: FirmwareRelease
  releases: FirmwareRelease[]
  error?: string
}

export interface BootloaderDrive {
  /** Drive letter, e.g. "E:". */
  drive: string
  volumeLabel: string
}

export interface FlashRequest {
  assetUrl: string
  assetName: string
  targetDrive: string
}

export interface FlashResult {
  ok: boolean
  message: string
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface DiagnosticsResult {
  ok: boolean
  filePath?: string
  message: string
}

// ---------------------------------------------------------------------------
// App settings (persisted via electron-store)
// ---------------------------------------------------------------------------

export interface AppSettings {
  locale: string
  selectedProduct: ProductId | null
  telemetryEnabled: boolean
  completedFirstRun: boolean
}

// ---------------------------------------------------------------------------
// IPC surface exposed on window.api via preload
// ---------------------------------------------------------------------------

export interface Api {
  system: {
    getInfo: () => Promise<SystemInfo>
  }
  steamvr: {
    getInfo: () => Promise<SteamVrInfo>
  }
  slimevr: {
    getInstall: () => Promise<SlimeVrInstall>
    /** Subscribe to live tracker state. Returns an unsubscribe function. */
    onLiveState: (cb: (state: SlimeVrLiveState) => void) => () => void
    connect: () => Promise<void>
    disconnect: () => Promise<void>
  }
  usb: {
    detectReceiver: () => Promise<UsbDeviceMatch>
  }
  firmware: {
    getCatalog: () => Promise<FirmwareCatalog>
    detectBootloaderDrives: () => Promise<BootloaderDrive[]>
    autoFlash: (req: FlashRequest) => Promise<FlashResult>
    downloadAsset: (assetUrl: string, assetName: string) => Promise<string>
  }
  docs: {
    getPage: (slug: string) => Promise<string>
    openExternal: (url: string) => Promise<void>
  }
  diagnostics: {
    export: () => Promise<DiagnosticsResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>
  }
  app: {
    getVersion: () => Promise<string>
    onUpdateStatus: (cb: (status: string) => void) => () => void
  }
}
