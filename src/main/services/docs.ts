import { promises as fs } from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import { DOC_PAGES } from '@shared/config'

/**
 * Offline-first docs. We serve a cached copy of each doc page so setup works
 * on flaky connections, refreshing from docs.vyrovr.com in the background when
 * online. Pages are stored as plain HTML fragments under userData/docs-cache;
 * a seed cache is shipped in resources/docs-cache.
 */
function cacheDir(): string {
  return path.join(app.getPath('userData'), 'docs-cache')
}

function seedDir(): string {
  // Packaged: process.resourcesPath/docs-cache (see electron-builder extraResources).
  // Dev: resources/docs-cache at the repo root.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs-cache')
    : path.join(app.getAppPath(), 'resources', 'docs-cache')
}

async function readFromDisk(slug: string, dir: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(dir, `${slug}.html`), 'utf-8')
  } catch {
    return null
  }
}

async function fetchAndCache(slug: string): Promise<string | null> {
  const page = DOC_PAGES.find((p) => p.slug === slug)
  if (!page) return null
  try {
    const res = await fetch(page.url)
    if (!res.ok) return null
    const html = await res.text()
    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(path.join(cacheDir(), `${slug}.html`), html, 'utf-8')
    return html
  } catch {
    return null
  }
}

/**
 * Returns the freshest available copy of a doc page: live fetch when possible,
 * otherwise the user cache, otherwise the shipped seed cache.
 */
export async function getDocPage(slug: string): Promise<string> {
  const fresh = await fetchAndCache(slug)
  if (fresh) return fresh

  const cached = await readFromDisk(slug, cacheDir())
  if (cached) return cached

  const seed = await readFromDisk(slug, seedDir())
  if (seed) return seed

  const page = DOC_PAGES.find((p) => p.slug === slug)
  return `<p>This page isn't available offline yet. Open it online: <a href="${
    page?.url ?? 'https://docs.vyrovr.com'
  }">${page?.title ?? 'docs.vyrovr.com'}</a></p>`
}

export async function openExternal(url: string): Promise<void> {
  await shell.openExternal(url)
}
