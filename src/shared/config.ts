// Single source of truth for hardware + service constants and links.
// Hardware details and docs change often — edit this file (no app-logic
// changes needed) to keep the configurator current. Values marked TODO
// must be confirmed against real hardware before release.

import type { ProductDef } from './types'

export const APP_NAME = 'VYRO VR Configurator'

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
export const RECEIVER_USB_IDS: { vendorId: string; productId: string; label: string }[] = [
  { vendorId: '1209', productId: '7690', label: 'foxDongle / SlimeVR nRF receiver' },
  { vendorId: '1915', productId: '520F', label: 'Nordic Semiconductor nRF52840 Dongle' },
  { vendorId: '1915', productId: '521F', label: 'Nordic nRF52840 (CDC)' },
  { vendorId: '2FE3', productId: '000C', label: 'nRF52840 USB Serial' },
  { vendorId: '239A', productId: '0029', label: 'Adafruit nRF52840 (UF2)' },
  { vendorId: '10C4', productId: 'EA60', label: 'Silicon Labs CP210x (UART receiver)' },
  { vendorId: '1A86', productId: '7523', label: 'CH340 (UART receiver)' }
]

// Mass-storage volume labels exposed by a tracker in UF2/DFU bootloader mode.
export const BOOTLOADER_VOLUME_LABELS = ['NICENANO', 'SLIMEVRTRK']

// SlimeVR Server SolarXR WebSocket feed (same endpoint the SlimeVR GUI uses).
export const SLIMEVR_WS_URL = 'ws://127.0.0.1:21110'

// Firmware source — VYRO's smol-slime firmware fork. The firmware step reads
// GitHub Releases here; it degrades gracefully if there are no releases yet.
export const FIRMWARE_REPO = { owner: 'VYRO-VR', repo: 'jitingcn-smol-slime-firmware' }
export const FIRMWARE_RELEASES_API = `https://api.github.com/repos/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases`

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

export const LINKS = {
  store: 'https://vyrovr.com',
  docs: 'https://docs.vyrovr.com',
  setupGuide: 'https://vyrovr.com/setup',
  firmwareRepo: 'https://github.com/VYRO-VR/jitingcn-smol-slime-firmware',
  smolDocs: 'https://docs.slimevr.dev/smol-slimes',
  slimevrDownload: 'https://slimevr.dev',
  slimevrDocs: 'https://docs.slimevr.dev',
  steamvr: 'steam://run/250820',
  discord: 'https://discord.gg/vyrovr'
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
