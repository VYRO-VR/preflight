#!/usr/bin/env node
// Downloads the latest combined Mochi bootloader + application hex from the
// VYRO-VR/Firmware GitHub releases into resources/dev-firmware/, where the
// hidden developer bulk-flash panel (BULK_FLASH in src/shared/config.ts) and
// electron-builder pick it up. Run before packaging: `npm run fetch:dev-firmware`.
//
// The hex committed in the repo is the fallback. By default a failed fetch
// warns and leaves it in place; with --strict (or FETCH_DEV_FIRMWARE_STRICT=1)
// it exits non-zero instead, so a release can't silently ship a stale image.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict') || process.env.FETCH_DEV_FIRMWARE_STRICT === '1'

/** Release asset published by the Firmware CI: VVR_Combined_Tracker_Mochi_<commit>.hex */
const ASSET_PATTERN = /^VVR_Combined_Tracker_Mochi_.+\.hex$/i
const MIN_BYTES = 100 * 1024
const ATTEMPTS = 3

async function main() {
  const config = await fs.readFile(path.join(root, 'src/shared/config.ts'), 'utf8')
  const repo = /FIRMWARE_REPO\s*=\s*\{\s*owner:\s*'([^']+)',\s*repo:\s*'([^']+)'\s*\}/.exec(config)
  const dir = /hexResourceDir:\s*'([^']+)'/.exec(config)
  const file = /hexFileName:\s*'([^']+)'/.exec(config)
  if (!repo || !dir || !file) throw new Error('could not read FIRMWARE_REPO / BULK_FLASH from src/shared/config.ts')

  const dest = path.join(root, 'resources', dir[1], file[1])
  const { release, asset } = await findAsset(repo[1], repo[2])
  console.log(`Using ${asset.name} from ${repo[1]}/${repo[2]} ${release.tag_name}`)

  const hex = await withRetry(() => download(asset.browser_download_url))
  validateHex(hex)

  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, hex)
  console.log(`Wrote ${path.relative(root, dest)} (${hex.length} bytes)`)
}

/** Newest non-draft release (stable preferred over prerelease) that has the asset. */
async function findAsset(owner, name) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'preflight-fetch-dev-firmware' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const url = `https://api.github.com/repos/${owner}/${name}/releases?per_page=20`
  const releases = await withRetry(async () => {
    let res = await fetch(url, { headers })
    // The repo is public: a token that can't read it (wrong scope, expired)
    // shouldn't block an anonymous request.
    if ((res.status === 401 || res.status === 403) && headers.Authorization) {
      delete headers.Authorization
      res = await fetch(url, { headers })
    }
    if (!res.ok) throw new Error(`releases API returned HTTP ${res.status}`)
    return res.json()
  })
  const candidates = releases.filter((r) => !r.draft)
  for (const wantPrerelease of [false, true]) {
    for (const release of candidates.filter((r) => r.prerelease === wantPrerelease)) {
      const asset = (release.assets ?? []).find((a) => ASSET_PATTERN.test(a.name))
      if (asset) return { release, asset }
    }
  }
  throw new Error(`no release of ${owner}/${name} has an asset matching ${ASSET_PATTERN}`)
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'preflight-fetch-dev-firmware' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`download returned HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Sanity check: a complete Intel HEX file of plausible size, not an error page. */
function validateHex(buf) {
  const text = buf.toString('utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (buf.length < MIN_BYTES) throw new Error(`hex is only ${buf.length} bytes`)
  if (!lines.every((l) => /^:[0-9A-Fa-f]+$/.test(l))) throw new Error('file is not Intel HEX')
  if (lines[lines.length - 1].toUpperCase() !== ':00000001FF') throw new Error('hex has no end-of-file record')
}

async function withRetry(fn) {
  let last
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * i))
    }
  }
  throw last
}

main().catch((err) => {
  const msg = `fetch-dev-firmware: ${err.message}`
  if (strict) {
    console.error(msg)
    process.exit(1)
  }
  console.warn(`${msg}\nKeeping the committed hex.`)
})
