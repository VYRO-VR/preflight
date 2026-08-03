import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import type { BulkFlashEvent, BulkFlashLogCode, BulkFlashPhase } from '@shared/types'
import { BULK_FLASH } from '@shared/config'
import {
  JLINK_RECOVER_ARGS,
  buildJlinkProgramArgs,
  ensureDeviceCommand,
  resolveNrfutil,
  runNrfutil,
  type NrfutilRunResult
} from './nrfutil'

/**
 * The developer bulk-flash loop — a TypeScript port of VYRO's production
 * `bootloader.ps1` pin-fixture script. While running, it arms `nrfutil device
 * program --traits jlink` against the bundled bootloader hex:
 *
 *   waiting  — silent fast retries (~12/sec) until a board lands on the pins.
 *              After each failure the output is checked for readback
 *              protection (probing at --log-level info when the quiet attempt
 *              said nothing), which triggers a recover (unlock + MASS ERASE)
 *              followed by a verified program.
 *   flashed  — count it, cool down, then watch for removal: keep programming
 *              silently; success means the same board is still on the pins
 *              (never re-counted), the first broken contact re-arms the loop.
 *
 * All side effects go through an injectable `BulkFlashDeps` so the whole
 * state machine is unit-testable with a scripted runner. One AbortController
 * per start() threads a signal into every child process and sleep, so stop()
 * (and app quit) kills an in-flight nrfutil immediately.
 */

export interface BulkFlashDeps {
  resolveBin: () => Promise<string | null>
  ensureDevice: (bin: string) => Promise<{ ok: boolean; message?: string }>
  exec: (bin: string, args: string[], signal: AbortSignal) => Promise<NrfutilRunResult>
  hexExists: (hexPath: string) => Promise<boolean>
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  now: () => number
}

/** Resolves after `ms`, or immediately once the signal aborts. Never rejects. */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done)
  })
}

/** Whether nrfutil output says the chip's readback protection blocked access. */
export function outputIndicatesProtection(result: NrfutilRunResult): boolean {
  return BULK_FLASH.protectionRegex.test(`${result.stdout}\n${result.stderr}`)
}

const defaultDeps: BulkFlashDeps = {
  resolveBin: resolveNrfutil,
  ensureDevice: ensureDeviceCommand,
  exec: (bin, args, signal) => runNrfutil(bin, args, signal),
  hexExists: (hexPath) =>
    fs.access(hexPath).then(
      () => true,
      () => false
    ),
  sleep: abortableSleep,
  now: () => Date.now()
}

const FAILED: NrfutilRunResult = { code: -1, stdout: '', stderr: '' }

interface Attempt {
  ok: boolean
  elapsedMs: number
  result: NrfutilRunResult
}

export class BulkFlashSession extends EventEmitter {
  private abort: AbortController | null = null
  private loop: Promise<void> | null = null
  private phase: BulkFlashPhase = 'idle'
  private count = 0
  private bin = ''

  constructor(
    private readonly hexPath: string,
    private readonly deps: BulkFlashDeps = defaultDeps
  ) {
    super()
  }

  /** Type-safe event subscription (the only event we emit is `event`). */
  override on(event: 'event', listener: (e: BulkFlashEvent) => void): this {
    return super.on(event, listener)
  }

  /** Starts the loop. No-op if already running. */
  start(): void {
    if (this.abort) return
    const abort = new AbortController()
    this.abort = abort
    this.count = 0
    this.loop = this.run(abort.signal)
      .catch(() => {
        // The loop swallows attempt failures itself; anything surfacing here
        // is unexpected — end the session rather than crash the process.
      })
      .finally(() => {
        this.abort = null
        this.loop = null
        this.send({ type: 'stopped', count: this.count })
        this.setPhase('idle')
      })
  }

  /** Stops the loop, killing any in-flight nrfutil. Resolves once it's dead. */
  async stop(): Promise<void> {
    this.abort?.abort()
    await this.loop
  }

  private send(e: BulkFlashEvent): void {
    this.emit('event', e)
  }

  private setPhase(phase: BulkFlashPhase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.send({ type: 'phase', phase })
  }

  private log(level: 'info' | 'success' | 'error', code: BulkFlashLogCode, detail?: string): void {
    this.send({ type: 'log', level, code, detail })
  }

  private async run(signal: AbortSignal): Promise<void> {
    this.setPhase('setup')
    const bin = await this.deps.resolveBin()
    if (!bin) return this.log('error', 'nrfutil-missing')
    this.bin = bin
    if (!(await this.deps.hexExists(this.hexPath))) {
      return this.log('error', 'hex-missing', this.hexPath)
    }
    if (signal.aborted) return
    const device = await this.deps.ensureDevice(bin)
    if (!device.ok) return this.log('error', 'device-plugin-missing', device.message)
    if (signal.aborted) return
    this.log('info', 'ready')

    while (!signal.aborted) {
      const elapsedMs = await this.armAndProgram(signal)
      if (elapsedMs === null) return
      this.count++
      this.send({ type: 'flashed', count: this.count, elapsedMs })
      this.setPhase('cooldown')
      await this.deps.sleep(BULK_FLASH.cooldownMs, signal)
      if (signal.aborted) return
      this.setPhase('remove')
      await this.waitForRemoval(signal)
      if (signal.aborted) return
      this.log('info', 'removed')
    }
  }

  /**
   * The arming phase: silent fast program attempts until one succeeds.
   * Returns the successful attempt's duration, or null when aborted.
   */
  private async armAndProgram(signal: AbortSignal): Promise<number | null> {
    this.setPhase('waiting')
    const idleSince = this.deps.now()
    let stuckHinted = false
    const fastArgs = buildJlinkProgramArgs({
      hexPath: this.hexPath,
      options: BULK_FLASH.programOptionsFast,
      logLevel: 'error'
    })
    const probeArgs = buildJlinkProgramArgs({ hexPath: this.hexPath, logLevel: 'info' })

    while (!signal.aborted) {
      const attempt = await this.attempt(fastArgs, signal, true)
      if (attempt.ok) return attempt.elapsedMs
      if (signal.aborted) return null

      // A failure is either "no board on the pins" (retry silently) or a
      // protected chip. The quiet attempt sometimes says which; when it
      // doesn't, probe once at --log-level info — the same
      // fail-then-inspect rhythm as the PowerShell script.
      let isProtected = outputIndicatesProtection(attempt.result)
      if (!isProtected) {
        const probe = await this.attempt(probeArgs, signal, true)
        // The board can land between the two attempts — a successful probe
        // already programmed it, so count it rather than flash it twice.
        if (probe.ok) return probe.elapsedMs
        if (signal.aborted) return null
        isProtected = outputIndicatesProtection(probe.result)
      }

      if (isProtected) {
        const elapsedMs = await this.recoverAndProgram(signal)
        if (elapsedMs !== null) return elapsedMs
        if (signal.aborted) return null
        this.setPhase('waiting')
      }

      if (!stuckHinted && this.deps.now() - idleSince >= BULK_FLASH.stuckHintMs) {
        stuckHinted = true
        this.log('info', 'stuck-hint')
      }
      this.setPhase('waiting')
      await this.deps.sleep(BULK_FLASH.idlePollMs, signal)
    }
    return null
  }

  /** Unlock + mass-erase a protected chip, then program with verification. */
  private async recoverAndProgram(signal: AbortSignal): Promise<number | null> {
    this.setPhase('recovering')
    this.log('info', 'protected')
    const recover = await this.deps.exec(this.bin, JLINK_RECOVER_ARGS, signal).catch(() => FAILED)
    if (signal.aborted) return null
    if (recover.code !== 0) {
      this.log('error', 'recover-failed', errorText(recover))
      return null
    }
    const attempt = await this.attempt(
      buildJlinkProgramArgs({
        hexPath: this.hexPath,
        options: BULK_FLASH.programOptionsVerify,
        logLevel: 'error'
      }),
      signal,
      true
    )
    if (attempt.ok) {
      this.log('success', 'recovered')
      return attempt.elapsedMs
    }
    if (!signal.aborted) this.log('error', 'recover-failed', errorText(attempt.result))
    return null
  }

  /**
   * Post-flash watch: keep programming silently. Success means the same board
   * is still on the pins (harmless reflash, never re-counted); the first
   * broken contact re-arms the loop for the next unit ("edge trigger").
   */
  private async waitForRemoval(signal: AbortSignal): Promise<void> {
    let failures = 0
    while (!signal.aborted && failures < BULK_FLASH.removalFailureThreshold) {
      const attempt = await this.attempt(
        buildJlinkProgramArgs({
          hexPath: this.hexPath,
          options: BULK_FLASH.programOptionsFast,
          logLevel: 'error'
        }),
        signal,
        false
      )
      if (signal.aborted) return
      if (attempt.ok) {
        failures = 0
        await this.deps.sleep(BULK_FLASH.removePollMs, signal)
      } else {
        failures++
        if (failures < BULK_FLASH.removalFailureThreshold) {
          await this.deps.sleep(BULK_FLASH.removeFailurePollMs, signal)
        }
      }
    }
  }

  /**
   * One timed program attempt. With `hint`, flips the phase to `flashing`
   * if the attempt outlives the quick no-target failure — so the UI shows
   * activity for real flashes without flickering on every idle probe.
   */
  private async attempt(args: string[], signal: AbortSignal, hint: boolean): Promise<Attempt> {
    const started = this.deps.now()
    const timer = hint
      ? setTimeout(() => this.setPhase('flashing'), BULK_FLASH.flashingHintMs)
      : null
    try {
      const result = await this.deps.exec(this.bin, args, signal).catch(() => FAILED)
      return { ok: result.code === 0, elapsedMs: this.deps.now() - started, result }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

function errorText(result: NrfutilRunResult): string {
  return (result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`).trim()
}
