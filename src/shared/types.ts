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
// Receiver pairing (serial)
// ---------------------------------------------------------------------------

/** How a firmware update is applied to a receiver. */
export type ReceiverFlashMethod = 'uf2' | 'dfu-zip'

/** A candidate receiver found on a serial port. */
export interface ReceiverPort {
  /** Serial path, e.g. "COM3" (Windows) or "/dev/ttyACM0". */
  path: string
  /** Friendly label for the picker, e.g. "foxDongle / SlimeVR nRF receiver (COM3)". */
  label: string
  vendorId?: string
  productId?: string
  /** Update method inferred from the matched USB id (defaults to 'uf2'). */
  flashMethod: ReceiverFlashMethod
}

/** Firmware info read from a receiver over its serial console. */
export interface ReceiverInfo {
  firmwareVersion?: string
  /** Build-date token extracted from the firmware string, when present. */
  buildDate?: string
  /** Raw console output, for diagnostics. */
  raw: string
}

/** Result of comparing a receiver's firmware build against the trackers'. */
export interface FirmwareMatch {
  status: 'match' | 'mismatch' | 'unknown'
  receiverBuildDate?: string
  trackerBuildDate?: string
  detail?: string
}

/** Request to flash a Secure DFU .zip package to a receiver via nrfutil. */
export interface ReceiverDfuRequest {
  assetUrl: string
  assetName: string
  /** Serial path of the receiver in DFU mode, when known. */
  path?: string
}

/**
 * Events streamed from the receiver during a pairing session. `paired` is the
 * one the UI celebrates; `log` carries raw console lines for diagnostics.
 */
export type PairingEvent =
  | { type: 'status'; status: 'opening' | 'listening' | 'stopped' }
  | { type: 'paired'; id: string; address: string; line: string }
  | { type: 'log'; line: string }
  | { type: 'error'; message: string }

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
  /** Structured fields decoded from the firmware filename, when it matches. */
  parsed?: ParsedFirmware
}

// ---------------------------------------------------------------------------
// Firmware filename taxonomy (VYRO / SlimeNRF CI naming scheme)
//
// Asset names look like `VYRO_VR_Tracker_ProMicro_Default_I2C.uf2`,
// `VYRO_VR_Receiver_Holyiot_21017.hex`, or (upstream SlimeNRF CI)
// `SlimeNRF_Tracker_TDMA_SW0_NoSleep_SPI_Mag_ProMicro.uf2`. Every option is an
// optional token; whatever tokens are left after pulling the known options out
// form the board name. See `@shared/firmware-naming`.
// ---------------------------------------------------------------------------

export type FirmwareKind = 'tracker' | 'receiver'
/** Radio protocol — the receiver and trackers must use the same one. */
export type FirmwareProtocol = 'standard' | 'tdma'
export type FirmwareClock = 'default' | 'clk' | 'noclk'
export type FirmwareBus = 'none' | 'i2c' | 'spi' | 'smspi'
/** Build variant: the stock build or the JitingCat fork. */
export type FirmwareFork = 'standard' | 'jitingcat'

export interface ParsedFirmware {
  kind: FirmwareKind
  /** Human board name, e.g. "ProMicro", "SlimevrMini3 R6", "Holyiot Dongle". */
  board: string
  /** Normalized board key for grouping/equality, e.g. "promicro". */
  boardKey: string
  protocol: FirmwareProtocol
  /** True when deep sleep is enabled (the default; `NoSleep` builds set false). */
  sleep: boolean
  /** True when the magnetometer is enabled. */
  mag: boolean
  clock: FirmwareClock
  bus: FirmwareBus
  /** True for `SW0` builds (alternate button/wake pin). */
  sw0: boolean
  fork: FirmwareFork
  /**
   * Source commit the file was built from — VYRO's CI always suffixes it to
   * the filename (e.g. `VVR_Tracker_Mochi_f750a5b.uf2`). Lowercased;
   * undefined for hash-less names (SlimeNRF CI, first VYRO release).
   */
  commit?: string
  /** File extension without the dot: 'uf2' | 'hex' | 'zip'. */
  ext: string
}

/** A user's firmware choice — board plus the option dimensions. */
export interface FirmwareSelection {
  boardKey: string
  protocol: FirmwareProtocol
  sleep: boolean
  mag: boolean
  clock: FirmwareClock
  bus: FirmwareBus
  sw0: boolean
  fork: FirmwareFork
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
  receiver: {
    /** List receivers found on serial ports (for the pairing flow's picker). */
    list: () => Promise<ReceiverPort[]>
    /** Open the receiver and enter pairing mode. */
    startPairing: (path: string) => Promise<void>
    /** Exit pairing mode and release the port. */
    stopPairing: () => Promise<void>
    /** Subscribe to pairing events. Returns an unsubscribe function. */
    onPairingEvent: (cb: (event: PairingEvent) => void) => () => void
    /** Read the receiver's firmware info over its serial console. */
    readInfo: (path: string) => Promise<ReceiverInfo>
    /** Reboot the receiver into its DFU bootloader. */
    enterDfu: (path: string) => Promise<void>
  }
  firmware: {
    getCatalog: () => Promise<FirmwareCatalog>
    detectBootloaderDrives: () => Promise<BootloaderDrive[]>
    autoFlash: (req: FlashRequest) => Promise<FlashResult>
    downloadAsset: (assetUrl: string, assetName: string) => Promise<string>
    /** Whether the bundled nrfutil binary is available for DFU flashing. */
    nrfutilAvailable: () => Promise<boolean>
    /** Flash a Secure DFU .zip package to a receiver via nrfutil. */
    flashReceiverDfu: (req: ReceiverDfuRequest) => Promise<FlashResult>
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
