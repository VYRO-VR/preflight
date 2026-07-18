// Pure helpers for the VYRO firmware filename taxonomy.
//
// The VYRO firmware CI (github.com/VYRO-VR/Firmware) publishes dated releases
// whose assets are named
//   VVR_<Receiver|Tracker>_<Board...>_<commit>.<uf2|hex>
// e.g.
//   VVR_Receiver_Fox_Dongle_f750a5b.uf2
//   VVR_Tracker_ProMicro_Stacked_I2C_2309f8b.uf2
//
// There is exactly one build per board/variant — every option (TDMA radio,
// sleep behaviour, …) is baked into the build — so picking firmware is just
// picking the board. The trailing token is the short commit of the firmware
// source repository the file was built from, which is what "is this device up
// to date?" compares against. Also tolerated: the `VYRO_VR_` prefix and
// hash-less names used by the very first release.

import type { FirmwareAsset, FirmwareKind, ParsedFirmware } from './types'

const COMMIT_TOKEN = /^[0-9a-f]{7,40}$/i

/** Parse a VYRO firmware asset filename into structured fields, or null. */
export function parseFirmwareName(name: string): ParsedFirmware | null {
  const m = /^(?:VVR|VYRO_VR)_(Receiver|Tracker)_(.+)\.(uf2|hex|zip)$/i.exec(name)
  if (!m) return null
  const kind: FirmwareKind = m[1].toLowerCase() === 'receiver' ? 'receiver' : 'tracker'
  const ext = m[3].toLowerCase()

  const tokens = m[2].split('_').filter(Boolean)
  // The trailing token is the source commit; tolerate its absence so a future
  // rename doesn't hide firmware from the picker.
  let commit: string | undefined
  if (tokens.length > 1 && COMMIT_TOKEN.test(tokens[tokens.length - 1])) {
    commit = tokens.pop()!.toLowerCase()
  }
  if (tokens.length === 0) return null

  return {
    kind,
    board: tokens.join(' '),
    boardKey: tokens.join('_').toLowerCase(),
    commit,
    ext
  }
}

/** Attach parsed metadata to an asset (used by the main process). */
export function withParsed(asset: FirmwareAsset): FirmwareAsset {
  return { ...asset, parsed: parseFirmwareName(asset.name) ?? undefined }
}

export interface BoardOption {
  key: string
  label: string
  count: number
}

/** Distinct boards available for a kind, sorted alphabetically. */
export function firmwareBoards(assets: FirmwareAsset[], kind: FirmwareKind): BoardOption[] {
  const byKey = new Map<string, BoardOption>()
  for (const a of assets) {
    const p = a.parsed
    if (!p || p.kind !== kind) continue
    const existing = byKey.get(p.boardKey)
    if (existing) existing.count++
    else byKey.set(p.boardKey, { key: p.boardKey, label: p.board, count: 1 })
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/** All assets for a given kind + board. */
export function candidatesFor(
  assets: FirmwareAsset[],
  kind: FirmwareKind,
  boardKey: string
): FirmwareAsset[] {
  return assets.filter((a) => a.parsed && a.parsed.kind === kind && a.parsed.boardKey === boardKey)
}

/**
 * Resolve a board to its firmware file. When a release ships several formats
 * for one board, prefer the ones the app can flash itself: .uf2 (drag & drop
 * onto the bootloader drive), then .zip (Secure DFU package via nrfutil), then
 * .hex last — a raw hex needs an SWD programmer.
 */
export function resolveFirmware(candidates: FirmwareAsset[]): FirmwareAsset | undefined {
  const rank = (a: FirmwareAsset): number =>
    a.parsed?.ext === 'uf2' ? 0 : a.parsed?.ext === 'zip' ? 1 : 2
  return [...candidates].sort((a, b) => rank(a) - rank(b))[0]
}

/**
 * The source commit a release's assets of one kind were built from. Receiver
 * and tracker firmware come from different repositories, so they carry
 * different commits — always ask per kind.
 */
export function releaseCommitFor(assets: FirmwareAsset[], kind: FirmwareKind): string | undefined {
  for (const a of assets) {
    if (a.parsed?.kind === kind && a.parsed.commit) return a.parsed.commit
  }
  return undefined
}

/**
 * Best-effort: guess a board key from a free-form string (a tracker's reported
 * firmware, or the receiver's `Target: foxdongle33_uf2/nrf52833` line).
 * Returns undefined when nothing matches confidently.
 */
export function guessBoardKey(
  text: string | undefined,
  boards: BoardOption[]
): string | undefined {
  if (!text) return undefined
  const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

  // A Zephyr board target (`foxdongle33_uf2/nrf52833`) names the board
  // exactly: the segment before the SoC, minus the transport suffix. Trust it
  // over any fuzzy matching — and if no asset matches it exactly, suggest
  // nothing rather than risk the wrong variant (e.g. the nRF52840 Fox Dongle
  // build for the nRF52833 Fox Dongle33).
  const target = /([a-z0-9_]+?)(?:_uf2|_dfu)?\/nrf[a-z0-9]*/i.exec(text)
  if (target) {
    const wanted = squash(target[1])
    return boards.find((b) => squash(b.key) === wanted)?.key
  }

  // Free-form text (tracker firmware strings): squash separators so
  // "Fox Dongle" matches "foxdongle", and prefer the most specific (longest
  // label) match so a variant board wins over its base name.
  const hay = squash(text)
  const ranked = [...boards].sort((a, b) => b.label.length - a.label.length)
  for (const b of ranked) {
    const tokens = b.label.toLowerCase().split(' ')
    if (tokens.every((tok) => hay.includes(squash(tok)))) return b.key
  }
  return undefined
}
