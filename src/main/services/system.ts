import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { SystemInfo } from '@shared/types'

const execAsync = promisify(exec)

/**
 * Windows reports the marketing name (e.g. "Windows 11") only via the
 * registry / WMI; os.release() returns a build number. We try to resolve a
 * friendly name on Windows and fall back gracefully elsewhere.
 */
async function resolveOsName(): Promise<string> {
  if (process.platform !== 'win32') {
    return `${os.type()} ${os.release()}`
  }
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'
    )
    const name = stdout.trim()
    if (name) return name
  } catch {
    // ignore — fall through to release string
  }
  return `Windows (build ${os.release()})`
}

async function resolveIsAdmin(): Promise<boolean> {
  if (process.platform !== 'win32') {
    return typeof process.getuid === 'function' ? process.getuid() === 0 : false
  }
  try {
    // `net session` only succeeds from an elevated context.
    await execAsync('net session', { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const [osName, isAdmin] = await Promise.all([resolveOsName(), resolveIsAdmin()])
  return {
    platform: process.platform,
    osName,
    osVersion: os.release(),
    arch: process.arch,
    is64Bit: process.arch === 'x64' || process.arch === 'arm64',
    totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    isAdmin
  }
}
