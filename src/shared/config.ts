// Single source of truth for hardware + service constants and links.
// Hardware details and docs change often — edit this file (no app-logic
// changes needed) to keep Preflight current. Values marked TODO
// must be confirmed against real hardware before release.

import type { ProductDef } from './types'

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
  { vendorId: '1209', productId: '7690', label: 'foxDongle / SlimeVR nRF receiver', flashMethod: 'uf2' },
  { vendorId: '1915', productId: '520F', label: 'Nordic Semiconductor nRF52840 Dongle', flashMethod: 'uf2' },
  { vendorId: '1915', productId: '521F', label: 'Nordic nRF52840 (CDC)', flashMethod: 'uf2' },
  { vendorId: '2FE3', productId: '000C', label: 'nRF52840 USB Serial', flashMethod: 'uf2' },
  { vendorId: '239A', productId: '0029', label: 'Adafruit nRF52840 (UF2)', flashMethod: 'uf2' },
  { vendorId: '10C4', productId: 'EA60', label: 'Silicon Labs CP210x (UART receiver)', flashMethod: 'uf2' },
  { vendorId: '1A86', productId: '7523', label: 'CH340 (UART receiver)', flashMethod: 'uf2' }
  // TODO: add HolyIOT receiver VID/PID(s) with flashMethod: 'dfu-zip' once confirmed.
]

// Mass-storage volume labels exposed by a tracker in UF2/DFU bootloader mode.
export const BOOTLOADER_VOLUME_LABELS = ['NICENANO', 'SLIMEVRTRK']

// SlimeVR Server SolarXR WebSocket feed (same endpoint the SlimeVR GUI uses).
export const SLIMEVR_WS_URL = 'ws://127.0.0.1:21110'

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

/**
 * Extracts a build-date token (e.g. `2026-06-01`, `Jun  1 2026`) from any
 * firmware version/build string. Matches an ISO date or a C `__DATE__` style
 * date; returns the matched substring as-is so equal builds compare equal.
 */
export const FIRMWARE_BUILD_DATE_REGEX =
  /\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/

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
