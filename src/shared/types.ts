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

/** Orientation quaternion, in SlimeVR Server's reference frame. */
export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface TrackerInfo {
  id: string
  name: string
  bodyPart?: string
  /**
   * Current orientation. Only present when the data feed was asked for
   * rotation and the server has a reading — treat `undefined` as "unknown",
   * not as identity.
   */
  rotation?: Quaternion
  /** 0..1 */
  batteryLevel?: number
  batteryVoltage?: number
  /** Signal strength in dBm (negative). */
  rssi?: number
  firmwareVersion?: string
  status: 'ok' | 'disconnected' | 'busy' | 'error' | 'unknown'
}

/**
 * Body axis of a tracker, as named by the firmware's `sens auto <x|y|z>`.
 * Z is the axis normal to the flat face (tracker lying on a desk); X and Y
 * are the in-plane axes (tracker stood on edge).
 */
export type SensCalAxis = 'x' | 'y' | 'z'

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

/** Firmware info read from a receiver over its serial console (`info`). */
export interface ReceiverInfo {
  /** Semantic version, e.g. "1.2.0+3". */
  firmwareVersion?: string
  /** Source commit the firmware was built from (short hash or git describe). */
  commit?: string
  /** Build timestamp, e.g. "2026-07-18 15:56:12". */
  buildDate?: string
  /** Board target reported by the firmware, e.g. "foxdongle_uf2/nrf52840". */
  board?: string
  /** Raw console output, for diagnostics. */
  raw: string
}

/** Result of comparing installed firmware against the latest release. */
export interface FirmwareMatch {
  status: 'match' | 'mismatch' | 'unknown'
  /** Commit token of the installed firmware, when readable. */
  current?: string
  /** Commit token of the latest release build, when known. */
  latest?: string
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

/**
 * Whether the receiver is currently held in pairing mode. Owned by the main
 * process (the single `ReceiverPairingClient`) so any part of the UI — the
 * pairing flow or the global indicator — can agree on one answer.
 */
export interface PairingState {
  /** True while a port is open and the receiver is in pairing mode. */
  active: boolean
  /** Serial path in use, or the last one used, so the UI can offer a restart. */
  path: string | null
}

// ---------------------------------------------------------------------------
// Receiver console (shared serial session used by the calibration flow)
// ---------------------------------------------------------------------------

/** A tracker slot stored on the receiver, as printed by its `list` command. */
export interface ReceiverSlot {
  /** Slot id — the `<id>` that `send <id> …` takes. */
  slot: number
  /** 12-hex-digit device address. */
  address: string
}

/**
 * A slot paired with the SlimeVR tracker it probably is. `confident` is only
 * true when exactly one tracker matched; the user confirms either way.
 */
export interface TrackerSlotMatch extends ReceiverSlot {
  /** `deviceId:trackerNum` of the matching tracker in the live feed. */
  trackerId?: string
  confident: boolean
}

/** Whether the shared receiver console session is open, and on which port. */
export interface ReceiverConsoleState {
  open: boolean
  path: string | null
}

/** Events streamed from the shared receiver console session. */
export type ReceiverConsoleEvent =
  | { type: 'status'; status: 'opening' | 'open' | 'closed' }
  | { type: 'line'; line: string }
  | { type: 'error'; message: string }

/** Request to start a gyro sensitivity calibration on one tracker. */
export interface SensCalRequest {
  /** Receiver slot id of the tracker. */
  slot: number
  axis: SensCalAxis
  revolutions: number
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
  /** Structured fields decoded from the VYRO filename, when it matches. */
  parsed?: ParsedFirmware
}

// ---------------------------------------------------------------------------
// Firmware filename taxonomy (VYRO-VR/Firmware naming scheme)
//
// Asset names look like `VVR_Receiver_Fox_Dongle_f750a5b.uf2` or
// `VVR_Tracker_ProMicro_Stacked_I2C_2309f8b.uf2`: a `VVR` prefix, the kind,
// the board/variant name, and the short commit of the firmware source it was
// built from. One build per board — every option (TDMA radio, sleep, …) is
// baked in. See `@shared/firmware-naming`.
// ---------------------------------------------------------------------------

export type FirmwareKind = 'tracker' | 'receiver'

export interface ParsedFirmware {
  kind: FirmwareKind
  /** Human board name, e.g. "Fox Dongle", "ProMicro Stacked I2C". */
  board: string
  /** Normalized board key for grouping/equality, e.g. "fox_dongle". */
  boardKey: string
  /**
   * Short commit hash of the firmware source this file was built from
   * (lowercased). Undefined for hash-less names, as in the first release.
   */
  commit?: string
  /** File extension without the dot: 'uf2' | 'hex' | 'zip'. */
  ext: string
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
// Developer bulk flash (pin-fixture bootloader programming over J-Link)
// ---------------------------------------------------------------------------

/** Where the bulk-flash loop currently is. Drives the panel's status line. */
export type BulkFlashPhase =
  | 'idle'
  | 'setup'
  | 'waiting'
  | 'flashing'
  | 'recovering'
  | 'cooldown'
  | 'remove'

/**
 * Stable message codes for log lines — the renderer maps each to a translated
 * string, keeping the log clean and localisable. Raw nrfutil output only ever
 * travels in the optional `detail` field.
 */
export type BulkFlashLogCode =
  | 'ready'
  | 'protected'
  | 'recovered'
  | 'recover-failed'
  | 'removed'
  | 'stuck-hint'
  | 'nrfutil-missing'
  | 'device-plugin-missing'
  | 'hex-missing'

/**
 * Events streamed while the bulk-flash loop runs. The idle retry storm
 * (~12 probes/sec while no board is on the pins) intentionally emits nothing —
 * `waiting` is a single phase, not log spam.
 */
export type BulkFlashEvent =
  | { type: 'phase'; phase: BulkFlashPhase }
  | { type: 'log'; level: 'info' | 'success' | 'error'; code: BulkFlashLogCode; detail?: string }
  | { type: 'flashed'; count: number; elapsedMs: number }
  | { type: 'stopped'; count: number }

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
    /**
     * Re-request the data feed at a different maximum rate (see
     * SLIMEVR_FEED_RATE_MS). Views that animate orientation raise it while
     * mounted and restore the idle rate on unmount.
     */
    setFeedRate: (minimumTimeSinceLastMs: number) => Promise<void>
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
    /** Current pairing state, for UI that mounts after a session started. */
    getPairingState: () => Promise<PairingState>
    /** Subscribe to pairing events. Returns an unsubscribe function. */
    onPairingEvent: (cb: (event: PairingEvent) => void) => () => void
    /** Read the receiver's firmware info over its serial console. */
    readInfo: (path: string) => Promise<ReceiverInfo>
    /** Reboot the receiver into its DFU bootloader. */
    enterDfu: (path: string) => Promise<void>

    /**
     * Open the shared receiver console session. Mutually exclusive with
     * pairing — both hold the same serial port exclusively — so this rejects
     * while a pairing session is running, and vice versa.
     */
    openConsole: (path: string) => Promise<void>
    /** Close the console session and release the port. */
    closeConsole: () => Promise<void>
    /** Current console state, for UI that mounts after a session started. */
    getConsoleState: () => Promise<ReceiverConsoleState>
    /** Subscribe to console events. Returns an unsubscribe function. */
    onConsoleEvent: (cb: (event: ReceiverConsoleEvent) => void) => () => void
    /** Run `list` and return the paired tracker slots, in slot order. */
    listSlots: () => Promise<ReceiverSlot[]>
    /** Send `send <slot> sens auto <axis> <rev>` to start a calibration. */
    startSensCal: (req: SensCalRequest) => Promise<void>
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
  dev: {
    /** Start the bulk bootloader-flash loop (developer fixture workflow). */
    bulkFlashStart: () => Promise<void>
    /** Stop the loop, killing any in-flight nrfutil process. */
    bulkFlashStop: () => Promise<void>
    /** Subscribe to bulk-flash events. Returns an unsubscribe function. */
    onBulkFlashEvent: (cb: (event: BulkFlashEvent) => void) => () => void
  }
}
