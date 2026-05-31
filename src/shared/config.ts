// Single source of truth for hardware + service constants and links.
// Hardware details and docs change often — edit this file (no app-logic
// changes needed) to keep the configurator current. Values marked TODO
// must be confirmed against real hardware before release.

import type { ProductDef } from './types'

export const APP_NAME = 'VYRO VR Configurator'

export const PRODUCTS: ProductDef[] = [
  {
    id: 'ibis-core',
    name: 'IBIS Core',
    trackerCount: 6,
    description: 'Lower-body tracking — waist, chest/hip, thighs, and feet.'
  },
  {
    id: 'ibis-advanced',
    name: 'IBIS Advanced',
    trackerCount: 8,
    description: 'Lower-body plus elbows for improved upper-body fidelity.'
  },
  {
    id: 'ibis-full-body',
    name: 'IBIS Full Body',
    trackerCount: 10,
    description: 'Full coverage including arms and chest.'
  }
]

// USB receiver dongle identity. nRF52840-class dongles commonly enumerate
// under Nordic / Adafruit IDs. TODO: confirm exact VID/PID of the shipping
// VYRO receiver and add every variant here.
export const RECEIVER_USB_IDS: { vendorId: string; productId: string; label: string }[] = [
  { vendorId: '1915', productId: '520F', label: 'Nordic Semiconductor nRF52840 Dongle' },
  { vendorId: '239A', productId: '0029', label: 'Adafruit nRF52840 (UF2)' }
]

// Mass-storage volume labels exposed by a tracker in UF2/DFU bootloader mode.
export const BOOTLOADER_VOLUME_LABELS = ['NICENANO', 'SLIMEVRTRK']

// SlimeVR Server SolarXR WebSocket feed (same endpoint the SlimeVR GUI uses).
export const SLIMEVR_WS_URL = 'ws://127.0.0.1:21110'

// Firmware source. TODO: github.com/vyro-vr/firmware does not exist yet —
// the firmware step degrades gracefully until releases are published here.
export const FIRMWARE_REPO = { owner: 'vyro-vr', repo: 'firmware' }
export const FIRMWARE_RELEASES_API = `https://api.github.com/repos/${FIRMWARE_REPO.owner}/${FIRMWARE_REPO.repo}/releases`

// A release is treated as "recommended" when its notes contain this marker,
// otherwise the latest non-prerelease release is used.
export const FIRMWARE_RECOMMENDED_MARKER = '[recommended]'

// Tracker button-press reference. TODO: verify against final docs — sources
// disagree on the exact mapping.
export const BUTTON_ACTIONS: { presses: number; action: string; detail: string }[] = [
  { presses: 1, action: 'Reset', detail: 'Full reset — use while standing in I-pose.' },
  {
    presses: 2,
    action: 'Side calibration',
    detail: 'Lay the tracker on a flat surface and wait for the light to flash.'
  },
  { presses: 3, action: 'Pairing mode', detail: 'Pair an additional tracker to the receiver.' },
  {
    presses: 5,
    action: 'DFU / firmware mode',
    detail: 'Exposes the NICENANO / SLIMEVRTRK drive for flashing a .uf2 file.'
  }
]

export const LINKS = {
  store: 'https://vyrovr.com',
  docs: 'https://docs.vyrovr.com',
  setupGuide: 'https://vyrovr.com/setup',
  firmwareRepo: 'https://github.com/vyro-vr/firmware',
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
