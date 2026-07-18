import { promises as fs, createWriteStream } from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { FIRMWARE_RELEASES_API, BOOTLOADER_VOLUME_LABELS } from '@shared/config'
import { withParsed } from '@shared/firmware-naming'
import type {
  FirmwareCatalog,
  FirmwareRelease,
  FirmwareAsset,
  ReceiverFlashMethod,
  ReceiverDfuRequest,
  BootloaderDrive,
  FlashRequest,
  FlashResult
} from '@shared/types'
import { programDfuPackage, nrfutilAvailable } from './nrfutil'

const execAsync = promisify(exec)

interface GithubAsset {
  name: string
  browser_download_url: string
  size: number
}
interface GithubRelease {
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  published_at: string
  assets: GithubAsset[]
}

function mapRelease(r: GithubRelease): FirmwareRelease {
  return {
    tag: r.tag_name,
    name: r.name || r.tag_name,
    publishedAt: r.published_at,
    notes: r.body ?? '',
    prerelease: r.prerelease,
    // The VYRO firmware CI publishes plain dated releases; the latest stable
    // one IS the recommended build.
    recommended: !r.prerelease,
    // Keep every flashable asset type (.uf2 drag-drop, .hex/.zip via nrfutil)
    // and decode each filename into structured fields for the picker. .uf2 sorts
    // first so existing callers that grab assets[0] keep working.
    assets: (r.assets || [])
      .filter((a) => /\.(uf2|hex|zip)$/i.test(a.name))
      .map((a) => withParsed({ name: a.name, downloadUrl: a.browser_download_url, sizeBytes: a.size }))
      .sort((a, b) => Number(b.name.toLowerCase().endsWith('.uf2')) - Number(a.name.toLowerCase().endsWith('.uf2')))
  }
}

/** Pick the asset that matches a receiver's flash method (.uf2 vs Secure DFU .zip). */
export function pickAsset(
  release: FirmwareRelease | undefined,
  method: ReceiverFlashMethod
): FirmwareAsset | undefined {
  if (!release) return undefined
  const ext = method === 'dfu-zip' ? '.zip' : '.uf2'
  return release.assets.find((a) => a.name.toLowerCase().endsWith(ext))
}

/**
 * Pick the recommended release: the first one explicitly marked recommended,
 * otherwise the newest non-prerelease release with flashable assets, otherwise
 * the newest prerelease with flashable assets (so a repo that has only shipped
 * prereleases so far still offers something to flash).
 */
export function pickRecommended(releases: FirmwareRelease[]): FirmwareRelease | undefined {
  const marked = releases.find((r) => r.recommended && r.assets.length > 0)
  if (marked) return marked
  return (
    releases.find((r) => !r.prerelease && r.assets.length > 0) ??
    releases.find((r) => r.assets.length > 0)
  )
}

export async function getFirmwareCatalog(): Promise<FirmwareCatalog> {
  try {
    // Newest releases first (GitHub's default order). One page is plenty —
    // the picker only surfaces the recommended release's assets.
    const res = await fetch(`${FIRMWARE_RELEASES_API}?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (res.status === 404) {
      return {
        configured: false,
        source: FIRMWARE_RELEASES_API,
        releases: [],
        error: 'Firmware repository is not available yet.'
      }
    }
    if (!res.ok) {
      return {
        configured: false,
        source: FIRMWARE_RELEASES_API,
        releases: [],
        error: `GitHub returned ${res.status}.`
      }
    }
    const releases = ((await res.json()) as GithubRelease[])
      .filter((r) => !r.draft)
      .map(mapRelease)
    if (releases.length === 0) {
      return {
        configured: false,
        source: FIRMWARE_RELEASES_API,
        releases: [],
        error: 'No firmware releases have been published yet.'
      }
    }
    return {
      configured: releases.some((r) => r.assets.length > 0),
      source: FIRMWARE_RELEASES_API,
      recommended: pickRecommended(releases),
      releases
    }
  } catch (err) {
    return {
      configured: false,
      source: FIRMWARE_RELEASES_API,
      releases: [],
      error: err instanceof Error ? err.message : 'Network error fetching firmware.'
    }
  }
}

/**
 * Compare two dotted version strings (e.g. "0.4.1", "v1.2.0-beta").
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Non-numeric segments are
 * treated as 0; a missing segment is lower than any present one.
 */
export function compareVersions(a: string, b: string): number {
  const norm = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n))
  const pa = norm(a)
  const pb = norm(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Find drives that look like a tracker in UF2 bootloader mode by matching the
 * configured volume labels. Windows-only; returns [] elsewhere.
 */
export async function detectBootloaderDrives(): Promise<BootloaderDrive[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-Volume | ' +
        'Where-Object DriveLetter | Select-Object DriveLetter, FileSystemLabel | ' +
        'ConvertTo-Json -Compress"',
      { windowsHide: true }
    )
    const parsed = JSON.parse(stdout)
    const vols: { DriveLetter?: string; FileSystemLabel?: string }[] = Array.isArray(parsed)
      ? parsed
      : [parsed]
    return vols
      .filter((v) =>
        BOOTLOADER_VOLUME_LABELS.some(
          (label) => (v.FileSystemLabel || '').toUpperCase() === label.toUpperCase()
        )
      )
      .map((v) => ({ drive: `${v.DriveLetter}:`, volumeLabel: v.FileSystemLabel || '' }))
  } catch {
    return []
  }
}

function downloadDir(): string {
  return path.join(os.tmpdir(), 'vyro-firmware')
}

/** Download a firmware asset to a temp directory and return its local path. */
export async function downloadAsset(assetUrl: string, assetName: string): Promise<string> {
  const dir = downloadDir()
  await fs.mkdir(dir, { recursive: true })
  const dest = path.join(dir, assetName)
  const res = await fetch(assetUrl)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}).`)
  }
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest))
  return dest
}

/**
 * Auto-flash: copy a downloaded .uf2 onto the bootloader drive. The UF2
 * bootloader reboots into the new firmware once the copy completes. This is
 * the opt-in "advanced" path — callers must gate it behind a soft-brick
 * warning + explicit confirmation.
 */
export async function autoFlash(req: FlashRequest): Promise<FlashResult> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Auto-flash is only supported on Windows.' }
  }
  try {
    const local = await downloadAsset(req.assetUrl, req.assetName)
    const target = path.join(`${req.targetDrive}\\`, req.assetName)
    await fs.copyFile(local, target)
    return {
      ok: true,
      message: `Copied ${req.assetName} to ${req.targetDrive}. The tracker will reboot into the new firmware.`
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Flash failed.'
    }
  }
}

/**
 * Flash a Secure DFU .zip package to a receiver (e.g. HolyIOT) via nrfutil.
 * The receiver must already be in its DFU bootloader. Downloads the package
 * first, then hands off to nrfutil — the same engine nRF Connect Programmer
 * uses, so no external app is needed.
 */
export async function flashReceiverDfu(req: ReceiverDfuRequest): Promise<FlashResult> {
  // nrfutil flashes Secure DFU .zip packages; a raw .hex would fail deep in
  // nrfutil with a cryptic "invalid Zip archive" — refuse it up front.
  if (!/\.zip$/i.test(req.assetName)) {
    return {
      ok: false,
      message: `${req.assetName} is not a DFU package (.zip). A raw .hex can only be flashed with an SWD programmer — use a release that ships a .zip for this board.`
    }
  }
  if (!(await nrfutilAvailable())) {
    return {
      ok: false,
      message:
        'The firmware tool (nrfutil) is not bundled in this build, so hex/DFU receivers cannot be flashed automatically yet.'
    }
  }
  try {
    const local = await downloadAsset(req.assetUrl, req.assetName)
    return await programDfuPackage({ packagePath: local, path: req.path })
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Flash failed.' }
  }
}
