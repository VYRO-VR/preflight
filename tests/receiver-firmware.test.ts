import { describe, it, expect } from 'vitest'
import { parseReceiverInfo } from '../src/main/services/receiver-protocol'
import { pickAsset } from '../src/main/services/firmware'
import {
  buildProgramArgs,
  nrfutilCandidates,
  isNoDeviceError,
  DEVICE_CHECK_ARGS,
  DEVICE_INSTALL_ARGS
} from '../src/main/services/nrfutil'
import { commitToken, commitsEqual, matchToLatest } from '../src/shared/firmware-match'
import type { FirmwareRelease } from '../src/shared/types'

// Real-shaped `info` output from the SmolSlime receiver firmware: the FW_STRING
// banner plus Board/SOC/Target/address lines.
const INFO_OUTPUT = [
  'VYRO VR Receiver',
  'SlimeVR Receiver 1.2.0+3 (Commit v1.2.0-4-gf750a5b, Build 2026-07-18 15:56:12)',
  '',
  'Board: foxdongle_uf2',
  'SOC: nRF52840',
  'Target: foxdongle_uf2/nrf52840',
  '',
  'Device address: 95CB23A0FDF7'
].join('\r\n')

// Verbatim `info` output captured from a real FoxDongle33 (nRF52833).
const REAL_INFO_OUTPUT = [
  'FoxApplication FoxApplication FoxDongle33',
  'SlimeVR-Tracker-nRF-Receiver 0.6.9+0 (Commit e6f498e1899d, Build 2026-05-02 21:22:33)',
  'Repo: https://github.com/VYRO-VR/SlimeVR-Tracker-nRF-Receiver.git | Branch: dev | Author: Bris Ibis',
  '',
  'Board: foxdongle33_uf2',
  'SOC: nrf52833',
  'Target: foxdongle33_uf2/nrf52833',
  '',
  'Device address: 5986CE236A22',
  'RF Channel: 84 (default)'
].join('\r\n')

describe('parseReceiverInfo', () => {
  it('extracts version, commit, build date, and board from the info banner', () => {
    const info = parseReceiverInfo(INFO_OUTPUT)
    expect(info.firmwareVersion).toBe('1.2.0+3')
    expect(info.commit).toBe('v1.2.0-4-gf750a5b')
    expect(info.buildDate).toBe('2026-07-18 15:56:12')
    expect(info.board).toBe('foxdongle_uf2/nrf52840')
  })

  it('parses real FoxDongle33 console output', () => {
    const info = parseReceiverInfo(REAL_INFO_OUTPUT)
    expect(info.firmwareVersion).toBe('0.6.9+0')
    expect(info.commit).toBe('e6f498e1899d')
    expect(info.buildDate).toBe('2026-05-02 21:22:33')
    expect(info.board).toBe('foxdongle33_uf2/nrf52833')
  })

  it('handles a plain-hash commit', () => {
    const info = parseReceiverInfo('fw 0.5.0 (Commit f750a5b, Build 2026-07-18 15:56:12)')
    expect(info.firmwareVersion).toBe('0.5.0')
    expect(info.commit).toBe('f750a5b')
  })

  it('keeps raw output and tolerates unknown formats', () => {
    const info = parseReceiverInfo('garbage prompt')
    expect(info.firmwareVersion).toBeUndefined()
    expect(info.commit).toBeUndefined()
    expect(info.raw).toBe('garbage prompt')
  })
})

describe('commitToken', () => {
  it('extracts the hash from a git describe string', () => {
    expect(commitToken('v1.2.0-4-gf750a5b')).toBe('f750a5b')
  })
  it('accepts a bare short hash', () => {
    expect(commitToken('f750a5b')).toBe('f750a5b')
    expect(commitToken('  2309F8B ')).toBe('2309f8b')
  })
  it('finds a trailing hash in a longer firmware string', () => {
    expect(commitToken('SmolSlime foxdongle 2309f8b')).toBe('2309f8b')
  })
  it('does not mistake versions or dates for hashes', () => {
    expect(commitToken('1.2.0')).toBeUndefined()
    expect(commitToken('2026-07-18')).toBeUndefined()
    expect(commitToken(undefined)).toBeUndefined()
  })
})

describe('commitsEqual', () => {
  it('matches short against long hashes in either direction', () => {
    expect(commitsEqual('f750a5b', 'f750a5b8c9d0e1f2')).toBe(true)
    expect(commitsEqual('f750a5b8c9d0e1f2', 'F750A5B')).toBe(true)
    expect(commitsEqual('f750a5b', '2309f8b')).toBe(false)
  })
})

describe('matchToLatest', () => {
  it('reports a match when the installed commit is the latest', () => {
    expect(matchToLatest('v1.2.0-4-gf750a5b', 'f750a5b').status).toBe('match')
  })
  it('reports a mismatch with both tokens when they differ', () => {
    const m = matchToLatest('aabbcc1', 'f750a5b')
    expect(m).toEqual({ status: 'mismatch', current: 'aabbcc1', latest: 'f750a5b' })
  })
  it('is unknown when either side is unreadable', () => {
    expect(matchToLatest(undefined, 'f750a5b').status).toBe('unknown')
    expect(matchToLatest('garbage', 'f750a5b').status).toBe('unknown')
    expect(matchToLatest('f750a5b', undefined).status).toBe('unknown')
  })
})

describe('pickAsset', () => {
  const release = {
    assets: [
      { name: 'receiver-0.5.0.uf2', downloadUrl: 'u', sizeBytes: 1 },
      { name: 'receiver-0.5.0.zip', downloadUrl: 'z', sizeBytes: 2 }
    ]
  } as FirmwareRelease

  it('selects the .uf2 for the UF2 method', () => {
    expect(pickAsset(release, 'uf2')?.name).toBe('receiver-0.5.0.uf2')
  })
  it('selects the .zip for the DFU method', () => {
    expect(pickAsset(release, 'dfu-zip')?.name).toBe('receiver-0.5.0.zip')
  })
  it('returns undefined when no release is given', () => {
    expect(pickAsset(undefined, 'uf2')).toBeUndefined()
  })
})

describe('nrfutil command', () => {
  it('builds the device program args with nordicDfu traits', () => {
    expect(buildProgramArgs({ packagePath: '/tmp/app.zip' })).toEqual([
      'device',
      'program',
      '--firmware',
      '/tmp/app.zip',
      '--traits',
      'nordicDfu'
    ])
  })
  it('adds the serial number when provided', () => {
    expect(buildProgramArgs({ packagePath: 'a.zip', serialNumber: 'ABC123' })).toContain('ABC123')
  })
  it('checks and installs the device command plugin by its nrfutil launcher names', () => {
    // `nrfutil device …` only works after `nrfutil install device`; the
    // command names are part of nrfutil's CLI contract.
    expect(DEVICE_CHECK_ARGS[0]).toBe('device')
    expect(DEVICE_INSTALL_ARGS).toEqual(['install', 'device'])
  })
  it('recognizes "no device yet" errors as retryable, others as fatal', () => {
    // Verbatim from a customer report — device still re-enumerating after `dfu`.
    expect(
      isNoDeviceError('Error: No devices with requested serial number(s) or trait(s) found')
    ).toBe(true)
    expect(isNoDeviceError('No devices found')).toBe(true)
    // Real failures must not be retried for 40 seconds.
    expect(
      isNoDeviceError(
        'One or more program tasks failed: * E9EB95B69B5A: invalid Zip archive: Could not find EOCD (Generic)'
      )
    ).toBe(false)
    expect(isNoDeviceError('nrfutil exited with code 1.')).toBe(false)
  })

  it('honours the VYRO_NRFUTIL_PATH override first', () => {
    const prev = process.env.VYRO_NRFUTIL_PATH
    process.env.VYRO_NRFUTIL_PATH = '/custom/nrfutil'
    expect(nrfutilCandidates()[0]).toBe('/custom/nrfutil')
    if (prev === undefined) delete process.env.VYRO_NRFUTIL_PATH
    else process.env.VYRO_NRFUTIL_PATH = prev
  })
})
