import { describe, it, expect } from 'vitest'
import { compareVersions, pickRecommended } from '../src/main/services/firmware'
import type { FirmwareRelease } from '../src/shared/types'

function release(partial: Partial<FirmwareRelease>): FirmwareRelease {
  return {
    tag: 'v0.0.0',
    name: 'rel',
    publishedAt: '2026-01-01T00:00:00Z',
    notes: '',
    prerelease: false,
    recommended: false,
    assets: [{ name: 'fw.uf2', downloadUrl: 'http://x/fw.uf2', sizeBytes: 1 }],
    ...partial
  }
}

describe('compareVersions', () => {
  it('orders numeric versions', () => {
    expect(compareVersions('0.4.0', '0.4.1')).toBe(-1)
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0)
  })

  it('ignores a leading v and pre-release suffixes', () => {
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.0-beta', '1.2.0')).toBe(0)
  })

  it('treats missing segments as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.1', '1.2')).toBe(1)
  })
})

describe('pickRecommended', () => {
  it('prefers an explicitly marked release', () => {
    const releases = [
      release({ tag: 'v1.0.0' }),
      release({ tag: 'v0.9.0', recommended: true })
    ]
    expect(pickRecommended(releases)?.tag).toBe('v0.9.0')
  })

  it('falls back to the first stable release with an asset', () => {
    const releases = [
      release({ tag: 'v1.1.0', prerelease: true }),
      release({ tag: 'v1.0.0' })
    ]
    expect(pickRecommended(releases)?.tag).toBe('v1.0.0')
  })

  it('skips releases without a .uf2 asset', () => {
    const releases = [release({ tag: 'v1.0.0', assets: [] }), release({ tag: 'v0.9.0' })]
    expect(pickRecommended(releases)?.tag).toBe('v0.9.0')
  })

  it('returns undefined when nothing qualifies', () => {
    expect(pickRecommended([])).toBeUndefined()
  })
})
