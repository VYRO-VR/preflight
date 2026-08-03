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

export async function resolveNrfutil(): Promise<string | null> {
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
    return runNrfutil(bin, ['--version']).then(
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
  const args = ['device', 'program', '--firmware', opts.packagePath, '--traits', 'nordicDfu']
  if (opts.serialNumber) args.push('--serial-number', opts.serialNumber)
  return args
}

export interface JlinkProgramOptions {
  hexPath: string
  /** `--options` value, e.g. `verify=VERIFY_NONE,reset=RESET_SYSTEM`. Omitted when absent. */
  options?: string
  /** `error` for quiet attempts; `info` when the output will be inspected. */
  logLevel: 'error' | 'info'
}

/**
 * Build the `nrfutil device program` arguments for SWD programming of a raw
 * .hex over a J-Link probe (the bulk-flash fixture path). Pure, for tests.
 */
export function buildJlinkProgramArgs(opts: JlinkProgramOptions): string[] {
  const args = ['device', 'program', '--traits', 'jlink', '--firmware', opts.hexPath]
  if (opts.options) args.push('--options', opts.options)
  args.push('--log-level', opts.logLevel)
  return args
}

/** `nrfutil device recover` — unlock a protected chip via MASS ERASE. */
export const JLINK_RECOVER_ARGS = ['device', 'recover', '--traits', 'jlink', '--log-level', 'error']

/**
 * `nrfutil` is a launcher: subcommands like `device` are plugins that must be
 * installed once (`nrfutil install device`). A freshly bundled binary has no
 * plugins, so ensure the device command exists before first use — the install
 * needs network access, which the caller already has (it just downloaded the
 * firmware package).
 */
export const DEVICE_CHECK_ARGS = ['device', '--help']
export const DEVICE_INSTALL_ARGS = ['install', 'device']

export async function ensureDeviceCommand(bin: string): Promise<{ ok: boolean; message?: string }> {
  const check = await runNrfutil(bin, DEVICE_CHECK_ARGS).catch(() => ({
    code: -1,
    stdout: '',
    stderr: ''
  }))
  if (check.code === 0) return { ok: true }
  const install = await runNrfutil(bin, DEVICE_INSTALL_ARGS).catch(() => ({
    code: -1,
    stdout: '',
    stderr: 'Could not run nrfutil install.'
  }))
  if (install.code === 0) return { ok: true }
  return {
    ok: false,
    message:
      `nrfutil's device command is missing and could not be installed ` +
      `(${(install.stderr || install.stdout).trim() || `exit code ${install.code}`}).`
  }
}

// After the receiver's `dfu` console command, the bootloader takes a moment to
// re-enumerate on USB — programming immediately races it. Retry a failed
// program a few times so slow enumeration doesn't surface as a user error.
const PROGRAM_ATTEMPTS = 4
const PROGRAM_RETRY_DELAY_MS = 2500

export async function programDfuPackage(opts: ProgramDfuOptions): Promise<FlashResult> {
  const bin = await resolveNrfutil()
  if (!bin) {
    return { ok: false, message: 'nrfutil binary not found.' }
  }
  const device = await ensureDeviceCommand(bin)
  if (!device.ok) {
    return { ok: false, message: device.message ?? 'nrfutil device command unavailable.' }
  }

  let lastError = ''
  for (let attempt = 1; attempt <= PROGRAM_ATTEMPTS; attempt++) {
    const { code, stdout, stderr } = await runNrfutil(bin, buildProgramArgs(opts))
    if (code === 0) {
      return { ok: true, message: 'Receiver firmware updated successfully.' }
    }
    // nrfutil reports errors on stderr or stdout depending on version.
    lastError = (stderr.trim() || stdout.trim() || `nrfutil exited with code ${code}.`).trim()
    if (attempt < PROGRAM_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, PROGRAM_RETRY_DELAY_MS))
    }
  }
  return { ok: false, message: lastError }
}

export interface NrfutilRunResult {
  code: number
  stdout: string
  stderr: string
}

/**
 * Spawn nrfutil and buffer its output. An optional AbortSignal kills the
 * child mid-run (the bulk-flash loop's Stop button / app quit); an aborted
 * spawn surfaces as a rejection, which callers treat as a failed attempt.
 */
export function runNrfutil(
  bin: string,
  args: string[],
  signal?: AbortSignal
): Promise<NrfutilRunResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(bin, args, { windowsHide: true, signal })
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}
