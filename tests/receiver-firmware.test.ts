import { describe, it, expect } from 'vitest'
import { parseReceiverInfo } from '../src/main/services/receiver-protocol'
import { pickAsset } from '../src/main/services/firmware'
import { buildProgramArgs, nrfutilCandidates } from '../src/main/services/nrfutil'
import { firmwareBuildToken, matchFirmware } from '../src/shared/firmware-match'
import type { FirmwareRelease, ReceiverInfo } from '../src/shared/types'

describe('parseReceiverInfo', () => {
  it('extracts version and build date from console output', () => {
    const info = parseReceiverInfo('SlimeVR receiver\r\nfirmware version 0.5.0 (Jun  1 2026)\r\n> ')
    expect(info.firmwareVersion).toBe('0.5.0')
    expect(info.buildDate).toBe('Jun  1 2026')
  })

  it('keeps raw output and tolerates unknown formats', () => {
    const info = parseReceiverInfo('garbage prompt')
    expect(info.firmwareVersion).toBeUndefined()
    expect(info.raw).toBe('garbage prompt')
  })
})

describe('firmwareBuildToken', () => {
  it('pulls an ISO build date out of a firmware string', () => {
    expect(firmwareBuildToken('0.5.0+2026-06-01')).toBe('2026-06-01')
  })
  it('falls back to the trimmed string when no date is present', () => {
    expect(firmwareBuildToken('  0.5.0  ')).toBe('0.5.0')
  })
  it('returns undefined for missing firmware', () => {
    expect(firmwareBuildToken(undefined)).toBeUndefined()
  })
})

describe('matchFirmware', () => {
  const receiver = (raw: string): ReceiverInfo => parseReceiverInfo(raw)

  it('reports a match when build dates align', () => {
    const r = matchFirmware(receiver('version 0.5.0 (2026-06-01)'), ['0.5.0+2026-06-01'])
    expect(r.status).toBe('match')
  })

  it('reports a mismatch when build dates differ', () => {
    const r = matchFirmware(receiver('version 0.5.0 (2026-06-01)'), ['0.5.0+2026-05-01'])
    expect(r.status).toBe('mismatch')
    expect(r.receiverBuildDate).toBe('2026-06-01')
    expect(r.trackerBuildDate).toBe('2026-05-01')
  })

  it('is unknown when there is nothing to compare', () => {
    expect(matchFirmware(receiver('version 0.5.0 (2026-06-01)'), []).status).toBe('unknown')
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
  it('honours the VYRO_NRFUTIL_PATH override first', () => {
    const prev = process.env.VYRO_NRFUTIL_PATH
    process.env.VYRO_NRFUTIL_PATH = '/custom/nrfutil'
    expect(nrfutilCandidates()[0]).toBe('/custom/nrfutil')
    if (prev === undefined) delete process.env.VYRO_NRFUTIL_PATH
    else process.env.VYRO_NRFUTIL_PATH = prev
  })
})
