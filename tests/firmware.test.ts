import { describe, it, expect, vi, afterEach } from 'vitest'
import { compareVersions, pickRecommended, getFirmwareCatalog } from '../src/main/services/firmware'
import { FIRMWARE_RELEASES_API } from '../src/shared/config'
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

  it('falls back to a prerelease when no stable release exists yet', () => {
    const releases = [
      release({ tag: 'v0.2.0-rc1', prerelease: true }),
      release({ tag: 'v0.1.0-rc1', prerelease: true })
    ]
    expect(pickRecommended(releases)?.tag).toBe('v0.2.0-rc1')
  })

  it('returns undefined when nothing qualifies', () => {
    expect(pickRecommended([])).toBeUndefined()
  })
})

describe('getFirmwareCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const githubRelease = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    tag_name: 'v1.0.0',
    name: 'Release 1.0.0',
    body: '',
    draft: false,
    prerelease: false,
    published_at: '2026-07-01T00:00:00Z',
    assets: [
      { name: 'SlimeNRF_Tracker_ProMicro.uf2', browser_download_url: 'http://x/a.uf2', size: 1 }
    ],
    ...over
  })

  const stubFetch = (status: number, body: unknown): ReturnType<typeof vi.fn> => {
    const fn = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('reads the releases list and picks the recommended release', async () => {
    const fetchMock = stubFetch(200, [
      githubRelease({ tag_name: 'v1.1.0-rc1', prerelease: true }),
      githubRelease()
    ])
    const catalog = await getFirmwareCatalog()
    expect(fetchMock.mock.calls[0][0]).toContain(FIRMWARE_RELEASES_API)
    expect(catalog.configured).toBe(true)
    expect(catalog.releases.map((r) => r.tag)).toEqual(['v1.1.0-rc1', 'v1.0.0'])
    expect(catalog.recommended?.tag).toBe('v1.0.0')
  })

  it('skips draft releases', async () => {
    stubFetch(200, [githubRelease({ tag_name: 'v2.0.0', draft: true }), githubRelease()])
    const catalog = await getFirmwareCatalog()
    expect(catalog.releases.map((r) => r.tag)).toEqual(['v1.0.0'])
  })

  it('is not configured while the repo has no releases yet', async () => {
    stubFetch(200, [])
    const catalog = await getFirmwareCatalog()
    expect(catalog.configured).toBe(false)
    expect(catalog.error).toMatch(/no firmware releases/i)
  })

  it('is not configured when the repo does not exist yet', async () => {
    stubFetch(404, { message: 'Not Found' })
    const catalog = await getFirmwareCatalog()
    expect(catalog.configured).toBe(false)
    expect(catalog.error).toMatch(/not available yet/i)
  })
})
