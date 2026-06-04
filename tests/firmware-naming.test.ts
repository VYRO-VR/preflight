import { describe, it, expect } from 'vitest'
import {
  parseFirmwareName,
  withParsed,
  firmwareBoards,
  candidatesFor,
  dimensionValues,
  resolveFirmware,
  defaultSelection,
  guessBoardKey
} from '../src/shared/firmware-naming'
import type { FirmwareAsset, FirmwareSelection } from '../src/shared/types'

// A representative slice of the real `latest` asset list, chosen to exercise
// every option token and every awkward (multi-token) board name.
const REAL_NAMES = [
  'SlimeNRF_Tracker_ProMicro.uf2',
  'SlimeNRF_Tracker_Mag_ProMicro.uf2',
  'SlimeNRF_Tracker_I2C_Mag_ProMicro.uf2',
  'SlimeNRF_Tracker_TDMA_SW0_NoSleepCLK_SPI_Mag_ProMicro.uf2',
  'SlimeNRF_Tracker_NoSleep_smSPI_ProMicro.uf2',
  'SlimeNRF_Tracker_Chrysalis_ProMicro.uf2',
  'SlimeNRF_Tracker_Mag_Chrysalis_ProMicro_JitingCat.uf2',
  'SlimeNRF_Tracker_NoCLK_NoSleep_I2C_Mag_StackedSmol.uf2',
  'SlimeNRF_Tracker_XIAO.uf2',
  'SlimeNRF_Tracker_XIAO_Sense.uf2',
  'SlimeNRF_Tracker_NoSleep_SlimevrMini3_R6.uf2',
  'SlimeNRF_Tracker_SlimevrMini4R9.uf2',
  'SlimeNRF_Tracker_R3.uf2',
  'SlimeNRF_Tracker_Bao_JitingCat.uf2',
  'SlimeNRF_Holyiot_Dongle_Receiver.hex',
  'SlimeNRF_Holyiot_Dongle_TDMA_Receiver.hex',
  'SlimeNRF_Nordic_eByte_Dongle_Receiver_JitingCat.hex',
  'SlimeNRF_Butterfly_P1_TDMA_Receiver.uf2',
  'SlimeNRF_ProMicro_Receiver.uf2',
  'SlimeNRF_etee_TDMA_Receiver.uf2'
]

const assets: FirmwareAsset[] = REAL_NAMES.map((name) =>
  withParsed({ name, downloadUrl: `http://x/${name}`, sizeBytes: 1 })
)

describe('parseFirmwareName', () => {
  it('decodes a fully-loaded tracker name', () => {
    const p = parseFirmwareName('SlimeNRF_Tracker_TDMA_SW0_NoSleepCLK_SPI_Mag_ProMicro.uf2')
    expect(p).toMatchObject({
      kind: 'tracker',
      board: 'ProMicro',
      boardKey: 'promicro',
      protocol: 'tdma',
      sw0: true,
      sleep: false,
      clock: 'clk', // NoSleepCLK implies external clock + no sleep
      bus: 'spi',
      mag: true,
      fork: 'standard',
      ext: 'uf2'
    })
  })

  it('defaults the unspecified options (sleep on, no mag, standard protocol)', () => {
    expect(parseFirmwareName('SlimeNRF_Tracker_ProMicro.uf2')).toMatchObject({
      protocol: 'standard',
      sleep: true,
      mag: false,
      clock: 'default',
      bus: 'none',
      sw0: false,
      fork: 'standard'
    })
  })

  it('keeps leftover tokens as the board, regardless of token order', () => {
    expect(parseFirmwareName('SlimeNRF_Tracker_Mag_Chrysalis_ProMicro_JitingCat.uf2')).toMatchObject(
      { board: 'Chrysalis ProMicro', mag: true, fork: 'jitingcat' }
    )
    expect(parseFirmwareName('SlimeNRF_Tracker_XIAO_Sense.uf2')?.board).toBe('XIAO Sense')
    expect(parseFirmwareName('SlimeNRF_Tracker_NoSleep_SlimevrMini3_R6.uf2')).toMatchObject({
      board: 'SlimevrMini3 R6',
      sleep: false
    })
  })

  it('parses receivers, including multi-token boards and .hex', () => {
    expect(parseFirmwareName('SlimeNRF_Holyiot_Dongle_TDMA_Receiver.hex')).toMatchObject({
      kind: 'receiver',
      board: 'Holyiot Dongle',
      protocol: 'tdma',
      ext: 'hex'
    })
    expect(parseFirmwareName('SlimeNRF_Nordic_eByte_Dongle_Receiver_JitingCat.hex')).toMatchObject({
      kind: 'receiver',
      board: 'Nordic eByte Dongle',
      fork: 'jitingcat'
    })
  })

  it('rejects non-SlimeNRF names', () => {
    expect(parseFirmwareName('random.uf2')).toBeNull()
    expect(parseFirmwareName('SlimeNRF_Tracker.uf2')).toBeNull() // no board left
    expect(parseFirmwareName('notes.txt')).toBeNull()
  })
})

describe('board grouping', () => {
  it('lists distinct boards per kind', () => {
    const trackers = firmwareBoards(assets, 'tracker').map((b) => b.label)
    expect(trackers).toContain('ProMicro')
    expect(trackers).toContain('XIAO Sense')
    expect(trackers).not.toContain('Holyiot Dongle') // that's a receiver
    const receivers = firmwareBoards(assets, 'receiver').map((b) => b.label)
    expect(receivers).toContain('Holyiot Dongle')
    expect(receivers).toContain('Butterfly P1')
  })

  it('counts the ProMicro tracker variants', () => {
    const promicro = firmwareBoards(assets, 'tracker').find((b) => b.key === 'promicro')
    // 5 ProMicro tracker builds in the sample set above.
    expect(promicro?.count).toBe(5)
  })
})

describe('dimensionValues', () => {
  it('reports which options vary for a board', () => {
    const dims = dimensionValues(candidatesFor(assets, 'tracker', 'promicro'))
    expect(dims.mag.sort()).toEqual([false, true])
    expect(dims.bus).toEqual(expect.arrayContaining(['none', 'i2c', 'spi', 'smspi']))
  })
})

describe('resolveFirmware', () => {
  const promicro = candidatesFor(assets, 'tracker', 'promicro')

  it('returns the exact file for a matching selection', () => {
    const sel: FirmwareSelection = {
      boardKey: 'promicro',
      protocol: 'standard',
      sleep: true,
      mag: true,
      clock: 'default',
      bus: 'i2c',
      sw0: false,
      fork: 'standard'
    }
    const { asset, exact } = resolveFirmware(promicro, sel)
    expect(exact).toBe(true)
    expect(asset?.name).toBe('SlimeNRF_Tracker_I2C_Mag_ProMicro.uf2')
  })

  it('falls back to the closest real file and flags it inexact', () => {
    const sel: FirmwareSelection = {
      boardKey: 'promicro',
      protocol: 'standard',
      sleep: true,
      mag: true,
      clock: 'noclk', // no such ProMicro build in the sample
      bus: 'i2c',
      sw0: false,
      fork: 'standard'
    }
    const { asset, exact } = resolveFirmware(promicro, sel)
    expect(exact).toBe(false)
    expect(asset).toBeDefined()
  })
})

describe('defaultSelection', () => {
  it('always resolves to a real file', () => {
    for (const board of firmwareBoards(assets, 'tracker')) {
      const candidates = candidatesFor(assets, 'tracker', board.key)
      const sel = defaultSelection(candidates, board.key)
      const { asset, exact } = resolveFirmware(candidates, sel)
      expect(asset, board.key).toBeDefined()
      expect(exact, board.key).toBe(true)
    }
  })

  it('prefers the standard, sleep-on, no-mag build when available', () => {
    const sel = defaultSelection(candidatesFor(assets, 'tracker', 'promicro'), 'promicro')
    expect(sel.protocol).toBe('standard')
    expect(sel.sleep).toBe(true)
    expect(sel.mag).toBe(false)
  })
})

describe('guessBoardKey', () => {
  const boards = firmwareBoards(assets, 'tracker')
  it('matches a board mentioned in a firmware string', () => {
    expect(guessBoardKey('SlimeNRF 0.5.0 ProMicro build', boards)).toBe('promicro')
  })
  it('prefers the most specific board (XIAO Sense over XIAO)', () => {
    expect(guessBoardKey('xiao sense rev b', boards)).toBe('xiao_sense')
  })
  it('returns undefined when nothing matches', () => {
    expect(guessBoardKey('totally unknown', boards)).toBeUndefined()
    expect(guessBoardKey(undefined, boards)).toBeUndefined()
  })
})
