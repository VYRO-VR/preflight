import { describe, it, expect } from 'vitest'
import {
  parseFirmwareName,
  withParsed,
  firmwareBoards,
  candidatesFor,
  resolveFirmware,
  releaseCommitFor,
  guessBoardKey
} from '../src/shared/firmware-naming'
import type { FirmwareAsset } from '../src/shared/types'

// The real asset list of a VYRO-VR/Firmware release.
const REAL_NAMES = [
  'VVR_Receiver_Fox_Dongle_f750a5b.uf2',
  'VVR_Receiver_Holyiot_21017_f750a5b.hex',
  'VVR_Receiver_ProMicro_f750a5b.uf2',
  'VVR_Receiver_Styria_R1_f750a5b.uf2',
  'VVR_Tracker_Mochi_2309f8b.uf2',
  'VVR_Tracker_ProMicro_Chrysalis_2309f8b.uf2',
  'VVR_Tracker_ProMicro_Default_I2C_2309f8b.uf2',
  'VVR_Tracker_ProMicro_Default_SPI_2309f8b.uf2',
  'VVR_Tracker_ProMicro_Stacked_I2C_2309f8b.uf2',
  'VVR_Tracker_ProMicro_Stacked_SPI_2309f8b.uf2',
  'VVR_Tracker_Styria_Mini_SPI_2309f8b.uf2'
]

const assets: FirmwareAsset[] = REAL_NAMES.map((name) =>
  withParsed({ name, downloadUrl: `http://x/${name}`, sizeBytes: 1 })
)

describe('parseFirmwareName', () => {
  it('decodes a receiver name with a multi-token board', () => {
    expect(parseFirmwareName('VVR_Receiver_Fox_Dongle_f750a5b.uf2')).toEqual({
      kind: 'receiver',
      board: 'Fox Dongle',
      boardKey: 'fox_dongle',
      commit: 'f750a5b',
      ext: 'uf2'
    })
  })

  it('decodes a tracker variant and .hex receivers', () => {
    expect(parseFirmwareName('VVR_Tracker_ProMicro_Stacked_I2C_2309f8b.uf2')).toMatchObject({
      kind: 'tracker',
      board: 'ProMicro Stacked I2C',
      boardKey: 'promicro_stacked_i2c',
      commit: '2309f8b'
    })
    expect(parseFirmwareName('VVR_Receiver_Holyiot_21017_f750a5b.hex')).toMatchObject({
      kind: 'receiver',
      board: 'Holyiot 21017',
      ext: 'hex'
    })
  })

  it('tolerates a missing commit suffix', () => {
    expect(parseFirmwareName('VVR_Tracker_Mochi.uf2')).toMatchObject({
      kind: 'tracker',
      board: 'Mochi',
      commit: undefined
    })
  })

  it('rejects non-VYRO names', () => {
    expect(parseFirmwareName('SlimeNRF_Tracker_ProMicro.uf2')).toBeNull()
    expect(parseFirmwareName('random.uf2')).toBeNull()
    expect(parseFirmwareName('notes.txt')).toBeNull()
  })
})

describe('board grouping', () => {
  it('lists distinct boards per kind', () => {
    const trackers = firmwareBoards(assets, 'tracker').map((b) => b.label)
    expect(trackers).toContain('Mochi')
    expect(trackers).toContain('ProMicro Stacked I2C')
    expect(trackers).not.toContain('Fox Dongle') // that's a receiver
    const receivers = firmwareBoards(assets, 'receiver').map((b) => b.label)
    expect(receivers).toEqual(['Fox Dongle', 'Holyiot 21017', 'ProMicro', 'Styria R1'])
  })
})

describe('resolveFirmware', () => {
  it('resolves a board to its single firmware file', () => {
    const asset = resolveFirmware(candidatesFor(assets, 'receiver', 'fox_dongle'))
    expect(asset?.name).toBe('VVR_Receiver_Fox_Dongle_f750a5b.uf2')
  })

  it('prefers .uf2 over .hex if a board ever ships both', () => {
    const both = ['VVR_Receiver_Both_abc1234.hex', 'VVR_Receiver_Both_abc1234.uf2'].map((name) =>
      withParsed({ name, downloadUrl: 'u', sizeBytes: 1 })
    )
    expect(resolveFirmware(both)?.name).toBe('VVR_Receiver_Both_abc1234.uf2')
  })

  it('returns undefined for no candidates', () => {
    expect(resolveFirmware([])).toBeUndefined()
  })
})

describe('releaseCommitFor', () => {
  it('reports the per-kind source commit (receiver and tracker differ)', () => {
    expect(releaseCommitFor(assets, 'receiver')).toBe('f750a5b')
    expect(releaseCommitFor(assets, 'tracker')).toBe('2309f8b')
  })
  it('is undefined when no asset of that kind has a commit', () => {
    expect(releaseCommitFor([], 'receiver')).toBeUndefined()
  })
})

describe('guessBoardKey', () => {
  const receivers = firmwareBoards(assets, 'receiver')

  it("matches the receiver's Target line", () => {
    expect(guessBoardKey('foxdongle_uf2/nrf52840', receivers)).toBe('fox_dongle')
    expect(guessBoardKey('holyiot_21017/nrf52840', receivers)).toBe('holyiot_21017')
    expect(guessBoardKey('styria_r1_uf2/nrf52840', receivers)).toBe('styria_r1')
  })

  it('prefers the most specific board over a base-name prefix', () => {
    const trackers = firmwareBoards(assets, 'tracker')
    expect(guessBoardKey('promicro stacked i2c rev b', trackers)).toBe('promicro_stacked_i2c')
  })

  it('returns undefined when nothing matches', () => {
    expect(guessBoardKey('totally unknown', receivers)).toBeUndefined()
    expect(guessBoardKey(undefined, receivers)).toBeUndefined()
  })
})
