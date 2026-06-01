import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import type { SteamVrInfo } from '@shared/types'

/**
 * SteamVR records its install location and registered external drivers in
 * %localappdata%\openvr\openvrpaths.vrpath (a JSON file). We read it to find
 * the runtime path and to check whether the SlimeVR OpenVR driver is
 * registered as an external driver.
 */
function openVrPathsFile(): string {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  return path.join(localAppData, 'openvr', 'openvrpaths.vrpath')
}

interface OpenVrPaths {
  runtime?: string[]
  external_drivers?: string[] | null
}

export async function getSteamVrInfo(): Promise<SteamVrInfo> {
  try {
    const raw = await fs.readFile(openVrPathsFile(), 'utf-8')
    const parsed = JSON.parse(raw) as OpenVrPaths
    const installPath = parsed.runtime?.[0]
    const externals = parsed.external_drivers ?? []
    const slimevrDriverRegistered = externals.some((p) => /slimevr/i.test(p))
    return {
      installed: Boolean(installPath),
      installPath,
      slimevrDriverRegistered
    }
  } catch {
    // File missing => SteamVR has never run / not installed.
    return { installed: false, slimevrDriverRegistered: false }
  }
}
