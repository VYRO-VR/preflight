// Single source of truth for hardware + service constants and links.
// Hardware details and docs change often — edit this file (no app-logic
// changes needed) to keep Preflight current. Values marked TODO
// must be confirmed against real hardware before release.

import type { ProductDef, SensCalAxis, SensCalPlacement } from './types'

export const APP_NAME = 'VYRO VR Preflight'

export const PRODUCTS: ProductDef[] = [
  {
    id: 'core',
    name: 'Core',
    trackerCount: 6,
    description: 'Chest, hip, thighs, and ankles.'
  },
  {
    id: 'advanced',
    name: 'Advanced',
    trackerCount: 8,
    description: 'Adds foot rotation.'
  },
  {
    id: 'full-body',
    name: 'Full Body',
    trackerCount: 10,
    description: 'Adds foot rotation and arm tracking.'
  }
]

// USB receiver dongle identities (best-effort). SlimeVR-compatible receivers
// ship on many different nRF52840 boards (foxDongle, Nordic dongle, SuperMini,
// etc.) and each enumerates under different IDs — so auto-detection here is a
// convenience only. The authoritative signal that the receiver works is
// whether your trackers appear in SlimeVR Server (see the Trackers step).
// Add IDs as they are confirmed against real hardware.
//
// `flashMethod` decides how a firmware update is applied to that receiver:
//   - 'uf2'     → drag-drop a .uf2 onto the UF2 bootloader drive (most dongles)
//   - 'dfu-zip' → flash a Secure DFU .zip with nrfutil (HolyIOT and similar
//                 modules that have no UF2 drive)
// Unknown receivers default to 'uf2'; the update flow lets the user override.
export type ReceiverFlashMethod = 'uf2' | 'dfu-zip'

export const RECEIVER_USB_IDS: {
  vendorId: string
  productId: string
  label: string
  flashMethod: ReceiverFlashMethod
}[] = [
  // All receivers built from VYRO-VR/SlimeVR-Tracker-nRF-Receiver share
  // VID 0x1209 / PID 0x7690 (set in the firmware's prj.conf) — boards only
  // differ in their USB product string. That includes the HolyIOT 21017, so it
  // is detected by this entry; its per-asset flash method resolves to
  // 'dfu-zip' in the update flow because its release asset is a Secure DFU
  // .zip, not a .uf2. The `flashMethod` here is only the default for ports
  // whose firmware can't be read.
  {
    vendorId: '1209',
    productId: '7690',
    label: 'VYRO receiver (Fox / HolyIOT / SlimeNRF)',
    flashMethod: 'uf2'
  },
  {
    vendorId: '1915',
    productId: '520F',
    label: 'Nordic Semiconductor nRF52840 Dongle',
    flashMethod: 'uf2'
  },
  { vendorId: '1915', productId: '521F', label: 'Nordic nRF52840 (CDC)', flashMethod: 'uf2' },
  { vendorId: '2FE3', productId: '000C', label: 'nRF52840 USB Serial', flashMethod: 'uf2' },
  { vendorId: '239A', productId: '0029', label: 'Adafruit nRF52840 (UF2)', flashMethod: 'uf2' },
  {
    vendorId: '10C4',
    productId: 'EA60',
    label: 'Silicon Labs CP210x (UART receiver)',
    flashMethod: 'uf2'
  },
  { vendorId: '1A86', productId: '7523', label: 'CH340 (UART receiver)', flashMethod: 'uf2' }
]

// Mass-storage volume labels exposed by a tracker or receiver in UF2
// bootloader mode. Confirmed on real hardware: 'FOX-BOOT' (Fox dongle
// receiver), 'SLIMENRF' (Styria tracker), and 'MOCHI' / 'MOCHIGOME' (Mochi
// tracker). The others are common bootloaders on other SlimeVR-compatible
// boards.
export const BOOTLOADER_VOLUME_LABELS = [
  'NICENANO',
  'SLIMEVRTRK',
  'FOX-BOOT',
  'SLIMENRF',
  'MOCHI',
  'MOCHIGOME'
]

// SlimeVR Server SolarXR WebSocket feed (same endpoint the SlimeVR GUI uses).
export const SLIMEVR_WS_URL = 'ws://127.0.0.1:21110'

// How often the SolarXR data feed is allowed to push an update, in
// milliseconds. `idle` is the app-wide default — status/battery lists do not
// need more, and every update crosses an IPC boundary to the renderer. Views
// that animate orientation (the 3D preview, the sensitivity-calibration turn
// counter) request `live` while mounted and drop back to `idle` on unmount.
export const SLIMEVR_FEED_RATE_MS = {
  idle: 200,
  live: 30
}

// Firmware source — the VYRO VR firmware CI (github.com/VYRO-VR/Firmware). It
// builds every board VYRO sells and publishes dated releases whose assets are
// named `VVR_<Receiver|Tracker>_<Board>_<commit>.<uf2|hex>` (see
// @shared/firmware-naming). The app reads the releases list (newest first) and
// offers the newest stable release, falling back to the newest prerelease; it
// degrades gracefully while there are no releases or GitHub can't be reached.
// To pin a different repo, change these two lines.
export const FIRMWARE_REPO = { owner: 'VYRO-VR', repo: 'Firmware' }
export const FIRMWARE_RELEASES_API = `https://api.github.com/repos/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases`

// Tracker button reference with VYRO LED feedback colors.
export const BUTTON_ACTIONS: { input: string; action: string; led: string; detail: string }[] = [
  {
    input: '1 press',
    action: 'Reset',
    led: 'Flashes purple',
    detail: 'Resets tracking — use while standing in an I-pose.'
  },
  {
    input: '2 presses',
    action: 'Calibration',
    led: 'Rainbow until calibrated',
    detail: 'Lay the tracker flat and still until calibration finishes.'
  }
]

// Number of presses to enter DFU / bootloader mode (used by the Firmware step).
export const DFU_PRESSES = 4

// Number of button presses that puts a tracker into pairing mode (LED flashes
// blue once per second). Surfaced in the guided pairing flow.
export const PAIRING_PRESSES = 3

// Receiver serial-console protocol (SmolSlime / SlimeVR-Tracker-nRF-Receiver).
//
// The receiver exposes a USB serial (CDC) console with the SmolSlime command
// set: `pair` enters pairing mode, `exit` leaves it, `info` prints firmware
// details, `dfu` reboots into the bootloader. `info` output looks like:
//
//   <manufacturer> <product>
//   <name> 1.2.0+3 (Commit v1.2.0-4-gf750a5b, Build 2026-07-18 15:56:12)
//   Board: foxdongle_uf2
//   SOC: nRF52840
//   Target: foxdongle_uf2/nrf52840
//   Device address: 95CB23A0FDF7
//
// Everything protocol-shaped reads from here, so a firmware-side change is a
// one-file edit.
export const RECEIVER_SERIAL = {
  baudRate: 115200,
  /** Command/keystroke sent to put the receiver into pairing mode. */
  enterPairingCmd: 'pair\n',
  /** Command/keystroke sent to take the receiver back out of pairing mode. */
  exitPairingCmd: 'exit\n',
  /**
   * Matches the receiver console line printed when a tracker is paired, e.g.
   * `<inf> esb_event: Added device on id 0 with address 95CB23A0FDF7`.
   * Capture group 1 = slot id, group 2 = device address.
   */
  addedDeviceRegex: /Added device on id (\d+) with address ([0-9A-Fa-f]+)/,

  /** Command/keystroke that makes the receiver print its firmware info. */
  infoCmd: 'info\n',
  /** Command/keystroke that reboots the receiver into its DFU bootloader. */
  dfuCmd: 'dfu\n',

  /** `… 1.2.0+3 (Commit …` → the semantic version before the parenthesis. */
  versionRegex: /\b(v?\d+\.\d+\.\d+[^\s()]*)\s*\(commit/i,
  /** `(Commit v1.2.0-4-gf750a5b, …` → the commit / git-describe token. */
  commitRegex: /\(commit\s+([^,()\s]+)/i,
  /** `… Build 2026-07-18 15:56:12)` → the build timestamp. */
  buildDateRegex: /\bbuild\s+(\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2}:\d{2})?)/i,
  /** `Target: foxdongle_uf2/nrf52840` → the board target. */
  boardRegex: /^target:\s*(\S+)/im
}

// Guided gyro sensitivity calibration (`sens auto` on the tracker firmware).
//
// The tracker measures its gyro scale factor by having the user spin it a
// known number of turns about one axis. Everything here mirrors constants in
// the firmware's `cal_sens.c` — if the firmware changes, change them here and
// nowhere else. The flow reads them to drive its countdown, pace guide, and
// failure copy, so a stale value shows up as bad coaching, not a crash.
//
// VERIFY against the firmware build actually shipping on VYRO trackers
// (checked against VYRO-VR/jitingcn-smol-slime-firmware @ 2e8f2b4).
export const SENS_CAL = {
  /**
   * Turns the user makes per axis. Every degree the start and stop poses
   * differ is spread over these turns, so more turns buy a lower alignment
   * error floor: ±1° over 10 turns is 0.03%, well under the ~0.5% scale error
   * being removed. There is no time limit — the app does the measuring.
   */
  revolutions: 10,
  /** Sanity ceiling; the firmware's own `sens auto` stops at 100 too. */
  maxRevolutions: 100,

  /**
   * `CONFIG_SENSOR_SENS_REV` in the tracker firmware. `sens <x>,<y>,<z>` takes
   * each value as *degrees of difference over this many turns*, and turns it
   * into a scale of `1 / (1 - deg / (360 * rev))`. A mismatch here scales
   * every correction by the ratio, so VERIFY it against the firmware build
   * (prj.conf) whenever the tracker firmware is updated.
   */
  firmwareRevolutions: 5,

  /**
   * The three placements, in the order the flow walks through them, each with
   * the firmware gyro axis that is vertical in it. The button-face normal is
   * the IMU's Z (the IMU sits on the board, parallel to the face); which of
   * X/Y runs along the long side is an IMU-layout fact — VERIFY against the
   * board. Getting the two swapped calibrates each with the other's factor.
   * The long edge comes before the short one because it is the pose the
   * preview's heading gets pinned from (see `@shared/tracker-frame`).
   */
  placements: [
    { placement: 'flat', axis: 'z' },
    { placement: 'long-edge', axis: 'x' },
    { placement: 'short-edge', axis: 'y' }
  ] as const satisfies readonly { placement: SensCalPlacement; axis: SensCalAxis }[],

  /** How far from exactly flat / exactly on edge still reads as that placement. */
  placementToleranceDeg: 15,
  /** Total rotation rate under which the tracker counts as held still. */
  stillRateDps: 5,
  /** How long it has to stay still for the reference pose to be captured. */
  stillDwellMs: 1000,

  /**
   * Accepted implied scale, exclusive. Tighter than the firmware's own clamp
   * (0.9–1.1): its job is to catch a miscount, and the likeliest miscount is
   * half a turn — stopping against the wrong side of a symmetric case — which
   * over 10 turns is exactly 5%. Real gyro scale errors are under 1%.
   */
  minScale: 0.95,
  maxScale: 1.05,
  /** Off-axis motion ratio at which the "keep it flat" coaching turns on. */
  offAxisWarnRatio: 0.1,
  /** Off-axis motion ratio that reads as a lifted or tumbled tracker. */
  offAxisRejectRatio: 0.25,

  /**
   * Decimals the value is sent with. The receiver forwards each value as an
   * int16 of hundredths, so anything finer is lost on the air.
   */
  valueDecimals: 2,
  /** Largest magnitude that int16 of hundredths can carry. */
  maxValueDeg: 327,

  /**
   * Verification spin: residual yaw error per turn, in degrees, at or under
   * which the axis passes. 0.5°/turn ≈ 0.14% remaining scale error.
   */
  verifyPassDegPerTurn: 0.5
}

// Receiver console commands used by the sensitivity-calibration flow. Kept
// beside RECEIVER_SERIAL rather than inside it because these are *tracker*
// commands relayed through the receiver's `send` verb, not receiver commands.
export const RECEIVER_CONSOLE = {
  /** Lists paired tracker addresses, one per line, in slot order. */
  listCmd: 'list\n',
  /** A `list` output line: a 12-hex-digit device address on its own. */
  listAddressRegex: /^([0-9A-Fa-f]{12})$/,
  /**
   * Write a tracker's gyro sensitivity correction: `send <slot> sens <x>,<y>,<z>`,
   * each value in degrees of difference over `SENS_CAL.firmwareRevolutions`
   * turns (0 = no correction). The tracker applies it to the next gyro sample
   * and persists it to flash.
   */
  sensSetCmd: (slot: number, values: readonly [string, string, string]): string =>
    `send ${slot} sens ${values.join(',')}\n`,
  /**
   * Receiver ack — `Sens set (1.20,-0.40,0.00) request sent to tracker 0`.
   * Capture groups: x, y, z, slot. Only means the command was queued for the
   * tracker's next radio exchange, so the tracker has to be awake.
   */
  sensSetAckRegex: /Sens set \(([-\d.]+),([-\d.]+),([-\d.]+)\) request sent to tracker (\d+)/i,
  /** Receiver rejections of the command's arguments. */
  sensSetRejectRegex: /Invalid float value|Invalid format|Invalid tracker ID/i
}

// Developer bulk flash — the pin-fixture bootloader programming loop behind
// the hidden developer panel. Ported from VYRO's production `bootloader.ps1`:
// nrfutil programs the bundled bootloader hex over J-Link (Tag-Connect pogo
// pins) in an armed loop — press fixture → flash → lift → next board. All
// tunables live here.
export const BULK_FLASH = {
  /** Folder under resources/ (dev) or process.resourcesPath (packaged). */
  hexResourceDir: 'dev-firmware',
  /** Combined bootloader + firmware image for the Mochi tracker (nRF52833). */
  hexFileName: 'Mochi_Tracker_Combined.hex',
  /** Fast path: skip verify for speed on fresh chips. */
  programOptionsFast: 'verify=VERIFY_NONE,reset=RESET_SYSTEM',
  /** Careful path, used right after a recover (unlock + mass erase). */
  programOptionsVerify: 'verify=VERIFY_READ,reset=RESET_SYSTEM',
  /** nrfutil output that means the chip's readback protection blocks access. */
  protectionRegex:
    /NotAvailableBecauseProtection|readback protection|access port is protected|APPROTECT|protected/i,
  /** Retry interval while no board is on the pins. */
  idlePollMs: 80,
  /** Settle time after a successful flash before watching for removal. */
  cooldownMs: 1200,
  /** Poll interval while waiting for a flashed board to be lifted. */
  removePollMs: 300,
  /** Pause after a failed contact probe during the removal wait. */
  removeFailurePollMs: 40,
  /**
   * Consecutive failed probes that count as "board removed". 1 re-arms on the
   * first broken contact (fastest swap); raise to 2-3 if contact bounce ever
   * double-counts a board.
   */
  removalFailureThreshold: 1,
  /** How long a program attempt must run before the UI shows "flashing". */
  flashingHintMs: 300,
  /** Idle time before hinting that the J-Link may be missing/unplugged. */
  stuckHintMs: 15000
}

/**
 * Extracts a build-date token (e.g. `2026-06-01`, `Jun  1 2026`) from any
 * firmware version/build string. Matches an ISO date or a C `__DATE__` style
 * date; returns the matched substring as-is so equal builds compare equal.
 */
export const FIRMWARE_BUILD_DATE_REGEX = /\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/

export const LINKS = {
  store: 'https://vyrovr.com',
  docs: 'https://docs.vyrovr.com',
  setupGuide: 'https://vyrovr.com/setup',
  firmwareRepo: `https://github.com/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases/latest`,
  smolDocs: 'https://docs.slimevr.dev/smol-slimes',
  slimevrDownload: 'https://slimevr.dev',
  slimevrDocs: 'https://docs.slimevr.dev',
  steamvr: 'steam://run/250820',
  discord: 'https://discord.gg/vyrovr',
  slimevrDiscord: 'https://discord.gg/SlimeVR'
}

// Documentation pages cached for offline use and surfaced inside the app.
// slug -> source URL on docs.vyrovr.com.
export const DOC_PAGES: { slug: string; title: string; url: string }[] = [
  { slug: 'quick-start', title: 'Quick Start', url: 'https://docs.vyrovr.com/quick-start' },
  { slug: 'pairing', title: 'Pairing', url: 'https://docs.vyrovr.com/pairing' },
  { slug: 'wearing', title: 'Wearing & Mounting', url: 'https://docs.vyrovr.com/wearing' },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    url: 'https://docs.vyrovr.com/troubleshooting'
  }
]

export const SUPPORTED = {
  minWindowsMajor: 10,
  minMemoryGb: 4
}
