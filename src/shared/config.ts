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

// Firmware source — the SlimeNRF firmware CI. It publishes a single rolling
// `latest` release whose ~200 assets cover every board + build-option combo
// (see @shared/firmware-naming). The firmware step reads that release and lets
// the user pick their board + options; it degrades gracefully if it can't be
// reached. To pin a different fork/build server, change these three lines.
export const FIRMWARE_REPO = { owner: 'Shine-Bright-Meow', repo: 'SlimeNRF-Firmware-CI' }
export const FIRMWARE_RELEASE_TAG = 'latest'
export const FIRMWARE_RELEASES_API = `https://api.github.com/repos/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases`
// The specific rolling release the picker reads from.
export const FIRMWARE_RELEASE_API = `${FIRMWARE_RELEASES_API}/tags/${FIRMWARE_RELEASE_TAG}`

// A release is treated as "recommended" when its notes contain this marker,
// otherwise the latest non-prerelease release is used.
export const FIRMWARE_RECOMMENDED_MARKER = '[recommended]'

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

// Receiver serial-console protocol used by the guided pairing flow.
//
// IMPORTANT: these values are firmware-specific. The nRF/smol-slime receiver
// exposes a USB serial (CDC) console; the host enters pairing mode and the
// receiver prints an "Added device …" line for each tracker it accepts. Confirm
// the baud rate, the pairing command, and the output format against the VYRO
// firmware fork (VYRO-VR/jitingcn-smol-slime-firmware) or real hardware before
// release — everything else in the pairing flow reads from here, so a protocol
// correction is a one-file change.
export const RECEIVER_SERIAL = {
  baudRate: 115200,
  /** Command/keystroke sent to put the receiver into pairing mode. */
  enterPairingCmd: 'pair\n',
  /**
   * Command/keystroke sent to take the receiver back out of pairing mode.
   * Pairing mode is a toggle (the same control enters and exits it), so this
   * re-sends the pairing command by default. VERIFY against the firmware.
   */
  exitPairingCmd: 'pair\n',
  /**
   * Matches the receiver console line printed when a tracker is paired, e.g.
   * `<inf> esb_event: Added device on id 0 with address 95CB23A0FDF7`.
   * Capture group 1 = slot id, group 2 = device address.
   */
  addedDeviceRegex: /Added device on id (\d+) with address ([0-9A-Fa-f]+)/,

  /** Command/keystroke that makes the receiver print its firmware info. */
  versionCmd: 'version\n',
  /** Command/keystroke that reboots the receiver into its DFU bootloader. */
  dfuCmd: 'dfu\n',
  /**
   * Extracts the firmware version token from the receiver's `version` output,
   * e.g. `firmware version 0.5.0` → `0.5.0`. VERIFY against the firmware.
   */
  versionRegex: /version[:\s]+v?([0-9][0-9A-Za-z.+-]*)/i
}

/**
 * Extracts a build-date token (e.g. `Jun  1 2026`, `2026-06-01`) from any
 * firmware version/build string — used to compare a receiver against the
 * trackers. Matches an ISO date or a C `__DATE__` style date. Returns the
 * matched substring as-is so equal builds compare equal. VERIFY the firmware
 * actually embeds a build date; otherwise the version string is compared whole.
 */
export const FIRMWARE_BUILD_DATE_REGEX =
  /\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/

export const LINKS = {
  store: 'https://vyrovr.com',
  docs: 'https://docs.vyrovr.com',
  setupGuide: 'https://vyrovr.com/setup',
  firmwareRepo: `https://github.com/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases/tag/${FIRMWARE_RELEASE_TAG}`,
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
