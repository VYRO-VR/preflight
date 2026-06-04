import { promises as fs } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { FlashResult } from '@shared/types'

/**
 * Thin wrapper around Nordic's `nrfutil` CLI — the same engine nRF Connect
 * Programmer drives — used to flash Secure DFU .zip packages over USB to
 * receivers that have no UF2 drive (e.g. HolyIOT modules).
 *
 * The binary is resolved from, in order:
 *   1. the VYRO_NRFUTIL_PATH env var (explicit override),
 *   2. a bundled copy under resources/nrfutil/ (shipped with the installer),
 *   3. `nrfutil` on the system PATH.
 *
 * NOTE: the binary is not committed to the repo (it is large and
 * platform-specific). The installer/build must place it under
 * resources/nrfutil/ for the bundled path to work; see README.
 */

export interface ProgramDfuOptions {
  packagePath: string
  /** Serial path of the device in DFU mode (helps when several are present). */
  path?: string
  serialNumber?: string
}

function binaryName(): string {
  return process.platform === 'win32' ? 'nrfutil.exe' : 'nrfutil'
}

/** Candidate locations for the nrfutil binary, most specific first. */
export function nrfutilCandidates(): string[] {
  const name = binaryName()
  const candidates: string[] = []
  if (process.env.VYRO_NRFUTIL_PATH) candidates.push(process.env.VYRO_NRFUTIL_PATH)
  // resourcesPath exists in a packaged app; fall back to cwd in dev.
  const resources = process.resourcesPath || process.cwd()
  candidates.push(path.join(resources, 'nrfutil', name))
  candidates.push(name) // PATH lookup
  return candidates
}

async function resolveNrfutil(): Promise<string | null> {
  for (const candidate of nrfutilCandidates()) {
    // The bare name is resolved via PATH at spawn time, so accept it as-is.
    if (!candidate.includes(path.sep)) return candidate
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  return null
}

export async function nrfutilAvailable(): Promise<boolean> {
  const bin = await resolveNrfutil()
  if (!bin) return false
  if (bin === binaryName()) {
    // Only on PATH — confirm it actually runs.
    return run(bin, ['--version']).then(
      (r) => r.code === 0,
      () => false
    )
  }
  return true
}

/**
 * Build the `nrfutil device program` arguments. Kept pure so the command shape
 * can be unit-tested without a device present.
 */
export function buildProgramArgs(opts: ProgramDfuOptions): string[] {
  const args = [
    'device',
    'program',
    '--firmware',
    opts.packagePath,
    '--traits',
    'nordicDfu'
  ]
  if (opts.serialNumber) args.push('--serial-number', opts.serialNumber)
  return args
}

export async function programDfuPackage(opts: ProgramDfuOptions): Promise<FlashResult> {
  const bin = await resolveNrfutil()
  if (!bin) {
    return { ok: false, message: 'nrfutil binary not found.' }
  }
  const { code, stderr } = await run(bin, buildProgramArgs(opts))
  if (code === 0) {
    return { ok: true, message: 'Receiver firmware updated successfully.' }
  }
  return { ok: false, message: stderr.trim() || `nrfutil exited with code ${code}.` }
}

function run(bin: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(bin, args, { windowsHide: true })
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}
