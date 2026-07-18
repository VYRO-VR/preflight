// Pure helpers for the SlimeNRF/VYRO firmware filename taxonomy.
//
// The firmware CI publishes releases whose assets encode every build option in
// the filename. VYRO's CI (VYRO-VR/Firmware) names files like
//   VVR_Tracker_ProMicro_Default_I2C_f750a5b.uf2
//   VVR_Receiver_Holyiot_21017_2309f8b.hex
// where the last token is always the source commit the file was built from
// (also tolerated: a VYRO_VR_ prefix and hash-less names, as in the very first
// release). The upstream SlimeNRF CI names files like
//   SlimeNRF_Tracker_TDMA_SW0_NoSleep_SPI_Mag_ProMicro.uf2
//
// Parsing strategy: pull every known *option* token out of the name; whatever
// tokens remain are the board. This is order-independent and degrades well as
// the CI adds new boards (a board we've never seen still parses — it just lands
// in the board name, e.g. "ProMicro Default" vs "ProMicro Stacked"). A full
// selection of (board + every option) maps to at most one file, which is what
// makes the picker deterministic.

import type {
  FirmwareAsset,
  FirmwareBus,
  FirmwareClock,
  FirmwareFork,
  FirmwareKind,
  FirmwareProtocol,
  FirmwareSelection,
  ParsedFirmware
} from './types'

/** Parse a firmware asset filename into structured fields, or null if it isn't one. */
export function parseFirmwareName(name: string): ParsedFirmware | null {
  const m = /^(?:VYRO_VR|VVR|SlimeNRF)_(.+)\.(uf2|hex|zip)$/i.exec(name)
  if (!m) return null
  const ext = m[2].toLowerCase()

  const tokens = m[1].split('_')
  // VYRO's CI always suffixes the source commit hash (e.g.
  // VVR_Tracker_Mochi_f750a5b.uf2). Pull it out so board keys stay stable
  // across releases; tolerate hash-less names (SlimeNRF CI, first VYRO release).
  let commit: string | undefined
  const last = tokens[tokens.length - 1]
  if (tokens.length > 1 && /^[0-9a-f]{7,40}$/i.test(last)) {
    commit = last.toLowerCase()
    tokens.pop()
  }

  let kind: FirmwareKind = 'tracker'
  let protocol: FirmwareProtocol = 'standard'
  let clock: FirmwareClock = 'default'
  let bus: FirmwareBus = 'none'
  let fork: FirmwareFork = 'standard'
  let sleep = true
  let mag = false
  let sw0 = false
  const board: string[] = []

  for (const tok of tokens) {
    switch (tok.toLowerCase()) {
      case 'tracker':
        kind = 'tracker'
        break
      case 'receiver':
        kind = 'receiver'
        break
      case 'tdma':
        protocol = 'tdma'
        break
      case 'sw0':
        sw0 = true
        break
      case 'nosleep':
        sleep = false
        break
      // Combined token: no sleep *and* external clock.
      case 'nosleepclk':
        sleep = false
        clock = 'clk'
        break
      case 'noclk':
        clock = 'noclk'
        break
      case 'clk':
        clock = 'clk'
        break
      case 'i2c':
        bus = 'i2c'
        break
      case 'spi':
        bus = 'spi'
        break
      case 'smspi':
        bus = 'smspi'
        break
      case 'mag':
        mag = true
        break
      case 'jitingcat':
        fork = 'jitingcat'
        break
      default:
        board.push(tok)
    }
  }

  if (board.length === 0) return null

  return {
    kind,
    board: board.join(' '),
    boardKey: board.join('_').toLowerCase(),
    protocol,
    sleep,
    mag,
    clock,
    bus,
    sw0,
    fork,
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

export interface DimensionValues {
  protocol: FirmwareProtocol[]
  sleep: boolean[]
  mag: boolean[]
  clock: FirmwareClock[]
  bus: FirmwareBus[]
  sw0: boolean[]
  fork: FirmwareFork[]
}

/**
 * Which values each option dimension actually takes across the given
 * candidates. A dimension with a single value is "fixed" for this board and the
 * UI can hide its control.
 */
export function dimensionValues(candidates: FirmwareAsset[]): DimensionValues {
  const collect = <T>(pick: (p: ParsedFirmware) => T): T[] => {
    const set = new Set<T>()
    for (const a of candidates) if (a.parsed) set.add(pick(a.parsed))
    return [...set]
  }
  return {
    protocol: collect((p) => p.protocol),
    sleep: collect((p) => p.sleep),
    mag: collect((p) => p.mag),
    clock: collect((p) => p.clock),
    bus: collect((p) => p.bus),
    sw0: collect((p) => p.sw0),
    fork: collect((p) => p.fork)
  }
}

// How strongly each dimension should be honored when an exact match for the
// requested selection doesn't exist — compatibility-critical dimensions weigh
// more so the "closest" fallback never silently swaps the radio protocol, etc.
const WEIGHTS: Record<keyof Omit<FirmwareSelection, 'boardKey'>, number> = {
  protocol: 16,
  sleep: 8,
  mag: 8,
  bus: 4,
  clock: 2,
  fork: 2,
  sw0: 1
}

function matchScore(p: ParsedFirmware, sel: FirmwareSelection): number {
  let s = 0
  if (p.protocol === sel.protocol) s += WEIGHTS.protocol
  if (p.sleep === sel.sleep) s += WEIGHTS.sleep
  if (p.mag === sel.mag) s += WEIGHTS.mag
  if (p.bus === sel.bus) s += WEIGHTS.bus
  if (p.clock === sel.clock) s += WEIGHTS.clock
  if (p.fork === sel.fork) s += WEIGHTS.fork
  if (p.sw0 === sel.sw0) s += WEIGHTS.sw0
  return s
}

export interface ResolveResult {
  asset?: FirmwareAsset
  /** True when the asset matches every selected dimension exactly. */
  exact: boolean
}

/**
 * Resolve a selection to a single asset. Returns the exact match when the
 * combination exists; otherwise the closest candidate (so the download always
 * points at a real file) with `exact: false`.
 */
export function resolveFirmware(
  candidates: FirmwareAsset[],
  sel: FirmwareSelection
): ResolveResult {
  let best: FirmwareAsset | undefined
  let bestScore = -1
  for (const a of candidates) {
    if (!a.parsed) continue
    const score = matchScore(a.parsed, sel)
    if (score > bestScore) {
      best = a
      bestScore = score
    }
  }
  const max = Object.values(WEIGHTS).reduce((x, y) => x + y, 0)
  return { asset: best, exact: bestScore === max }
}

// Preference order used to seed sensible defaults — the "most standard" build.
const PREFERRED = {
  protocol: ['standard', 'tdma'] as FirmwareProtocol[],
  sleep: [true, false],
  mag: [false, true],
  clock: ['default', 'clk', 'noclk'] as FirmwareClock[],
  bus: ['i2c', 'none', 'spi', 'smspi'] as FirmwareBus[],
  sw0: [false, true],
  fork: ['standard', 'jitingcat'] as FirmwareFork[]
}

function preferred<T>(order: T[], available: T[]): T {
  return order.find((v) => available.includes(v)) ?? available[0]
}

/** A sensible default selection for a board that maps to a real file. */
export function defaultSelection(
  candidates: FirmwareAsset[],
  boardKey: string
): FirmwareSelection {
  const dims = dimensionValues(candidates)
  const wanted: FirmwareSelection = {
    boardKey,
    protocol: preferred(PREFERRED.protocol, dims.protocol),
    sleep: preferred(PREFERRED.sleep, dims.sleep),
    mag: preferred(PREFERRED.mag, dims.mag),
    clock: preferred(PREFERRED.clock, dims.clock),
    bus: preferred(PREFERRED.bus, dims.bus),
    sw0: preferred(PREFERRED.sw0, dims.sw0),
    fork: preferred(PREFERRED.fork, dims.fork)
  }
  // Snap to the closest real build so the defaults always resolve exactly.
  const { asset } = resolveFirmware(candidates, wanted)
  if (asset?.parsed) {
    const p = asset.parsed
    return {
      boardKey,
      protocol: p.protocol,
      sleep: p.sleep,
      mag: p.mag,
      clock: p.clock,
      bus: p.bus,
      sw0: p.sw0,
      fork: p.fork
    }
  }
  return wanted
}

/**
 * Best-effort: guess a board key from a free-form firmware/version string (e.g.
 * a tracker's reported firmware or a receiver's console banner) by looking for a
 * known board's tokens. Returns undefined when nothing matches.
 */
export function guessBoardKey(
  text: string | undefined,
  boards: BoardOption[]
): string | undefined {
  if (!text) return undefined
  const hay = text.toLowerCase()
  // Prefer the most specific (longest label) match, so "XIAO Sense" wins over "XIAO".
  const ranked = [...boards].sort((a, b) => b.label.length - a.label.length)
  for (const b of ranked) {
    const tokens = b.label.toLowerCase().split(' ')
    if (tokens.every((tok) => hay.includes(tok))) return b.key
  }
  return undefined
}
