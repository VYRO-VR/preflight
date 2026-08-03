import { describe, expect, it, vi } from 'vitest'
import {
  BulkFlashSession,
  abortableSleep,
  outputIndicatesProtection,
  type BulkFlashDeps
} from '../src/main/services/bulk-flash'
import {
  JLINK_RECOVER_ARGS,
  buildJlinkProgramArgs,
  type NrfutilRunResult
} from '../src/main/services/nrfutil'
import { BULK_FLASH } from '../src/shared/config'
import type { BulkFlashEvent } from '../src/shared/types'

const HEX = '/bundle/dev-firmware/Mochi_Tracker_Combined.hex'

const ok: NrfutilRunResult = { code: 0, stdout: '', stderr: '' }
const fail: NrfutilRunResult = { code: 1, stdout: '', stderr: '' }
const protectedFail: NrfutilRunResult = {
  code: 1,
  stdout: '',
  stderr: '[error] NotAvailableBecauseProtection: readback protection enabled'
}

describe('buildJlinkProgramArgs', () => {
  it('builds the fast program command', () => {
    expect(
      buildJlinkProgramArgs({
        hexPath: HEX,
        options: BULK_FLASH.programOptionsFast,
        logLevel: 'error'
      })
    ).toEqual([
      'device',
      'program',
      '--traits',
      'jlink',
      '--firmware',
      HEX,
      '--options',
      'verify=VERIFY_NONE,reset=RESET_SYSTEM',
      '--log-level',
      'error'
    ])
  })

  it('omits --options for the probe and uses info logging', () => {
    expect(buildJlinkProgramArgs({ hexPath: HEX, logLevel: 'info' })).toEqual([
      'device',
      'program',
      '--traits',
      'jlink',
      '--firmware',
      HEX,
      '--log-level',
      'info'
    ])
  })

  it('recover command targets jlink', () => {
    expect(JLINK_RECOVER_ARGS).toEqual([
      'device',
      'recover',
      '--traits',
      'jlink',
      '--log-level',
      'error'
    ])
  })
})

describe('outputIndicatesProtection', () => {
  it.each([
    'NotAvailableBecauseProtection',
    'readback protection is enabled',
    'the access port is protected',
    'APPROTECT enabled',
    'target is Protected'
  ])('matches "%s" case-insensitively', (text) => {
    expect(outputIndicatesProtection({ code: 1, stdout: text, stderr: '' })).toBe(true)
    expect(outputIndicatesProtection({ code: 1, stdout: '', stderr: text.toUpperCase() })).toBe(
      true
    )
  })

  it('does not match a plain no-target failure', () => {
    expect(
      outputIndicatesProtection({ code: 1, stdout: '', stderr: 'No debuggers were found' })
    ).toBe(false)
  })
})

describe('abortableSleep', () => {
  it('resolves immediately when the signal aborts', async () => {
    const abort = new AbortController()
    const sleep = abortableSleep(60_000, abort.signal)
    abort.abort()
    await expect(sleep).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Loop tests with a scripted runner. Each exec call consumes the next scripted
// result; once the script is exhausted, exec blocks until the signal aborts —
// which is exactly what a fixture with no board on the pins looks like.
// ---------------------------------------------------------------------------

interface Harness {
  session: BulkFlashSession
  events: BulkFlashEvent[]
  calls: string[][]
  sleeps: number[]
}

function harness(script: NrfutilRunResult[], overrides: Partial<BulkFlashDeps> = {}): Harness {
  const calls: string[][] = []
  const sleeps: number[] = []
  const queue = [...script]
  const deps: BulkFlashDeps = {
    resolveBin: () => Promise.resolve('/fake/nrfutil'),
    ensureDevice: () => Promise.resolve({ ok: true }),
    exec: (_bin, args, signal) => {
      calls.push(args)
      const next = queue.shift()
      if (next) return Promise.resolve(next)
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    },
    hexExists: () => Promise.resolve(true),
    sleep: (ms) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
    now: () => 0,
    ...overrides
  }
  const session = new BulkFlashSession(HEX, deps)
  const events: BulkFlashEvent[] = []
  session.on('event', (e) => events.push(e))
  return { session, events, calls, sleeps }
}

/** Waits until the scripted queue has been consumed down to the blocking exec. */
async function settled(h: Harness, expectedCalls: number): Promise<void> {
  await vi.waitFor(() => expect(h.calls.length).toBeGreaterThanOrEqual(expectedCalls))
}

describe('BulkFlashSession', () => {
  it('flashes a board, waits for removal, and re-arms', async () => {
    // fast fail + probe fail (idle) → fast ok (flashed) → remove: ok, ok, fail
    // (removed) → next idle cycle blocks on exec #7.
    const h = harness([fail, fail, ok, ok, ok, fail])
    h.session.start()
    await settled(h, 7)
    await h.session.stop()

    expect(h.events).toEqual([
      { type: 'phase', phase: 'setup' },
      { type: 'log', level: 'info', code: 'ready', detail: undefined },
      { type: 'phase', phase: 'waiting' },
      { type: 'flashed', count: 1, elapsedMs: 0 },
      { type: 'phase', phase: 'cooldown' },
      { type: 'phase', phase: 'remove' },
      { type: 'log', level: 'info', code: 'removed', detail: undefined },
      { type: 'phase', phase: 'waiting' },
      { type: 'stopped', count: 1 },
      { type: 'phase', phase: 'idle' }
    ])
    // Idle retries are silent: the one failing arm cycle produced no events.
    expect(h.sleeps).toEqual([
      BULK_FLASH.idlePollMs,
      BULK_FLASH.cooldownMs,
      BULK_FLASH.removePollMs,
      BULK_FLASH.removePollMs
    ])
  })

  it('the quiet attempt and the probe use the expected commands', async () => {
    const h = harness([fail, fail, ok])
    h.session.start()
    await settled(h, 3)
    await h.session.stop()

    expect(h.calls[0]).toContain('--options')
    expect(h.calls[0]).toContain(BULK_FLASH.programOptionsFast)
    expect(h.calls[0]).toContain('error')
    // Probe: no --options, info logging, only ever after a failure.
    expect(h.calls[1]).not.toContain('--options')
    expect(h.calls[1]).toContain('info')
  })

  it('recovers a protected chip, then programs with verification', async () => {
    // fast fail (protection visible) → recover ok → verified program ok.
    const h = harness([protectedFail, ok, ok])
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'flashed')).toBe(true))
    await h.session.stop()

    // Protection detected on the quiet attempt itself: no info probe ran.
    expect(h.calls[1]).toEqual(JLINK_RECOVER_ARGS)
    expect(h.calls[2]).toContain(BULK_FLASH.programOptionsVerify)
    expect(h.events).toContainEqual({
      type: 'log',
      level: 'info',
      code: 'protected',
      detail: undefined
    })
    expect(h.events).toContainEqual({
      type: 'log',
      level: 'success',
      code: 'recovered',
      detail: undefined
    })
    expect(h.events).toContainEqual({ type: 'flashed', count: 1, elapsedMs: 0 })
  })

  it('detects protection via the info probe when the quiet attempt is silent', async () => {
    // fast fail (silent) → probe fail with protection text → recover ok →
    // verified program ok.
    const h = harness([fail, protectedFail, ok, ok])
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'flashed')).toBe(true))
    await h.session.stop()

    expect(h.calls[2]).toEqual(JLINK_RECOVER_ARGS)
    expect(h.events).toContainEqual({ type: 'flashed', count: 1, elapsedMs: 0 })
  })

  it('keeps looping after a failed recover', async () => {
    const recoverFail: NrfutilRunResult = { code: 1, stdout: '', stderr: 'recover exploded' }
    // fast fail (protected) → recover fails → back to waiting → fast ok.
    const h = harness([protectedFail, recoverFail, ok])
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'flashed')).toBe(true))
    await h.session.stop()

    expect(h.events).toContainEqual({
      type: 'log',
      level: 'error',
      code: 'recover-failed',
      detail: 'recover exploded'
    })
    expect(h.events).toContainEqual({ type: 'flashed', count: 1, elapsedMs: 0 })
  })

  it('counts a board that lands between the quiet attempt and the probe', async () => {
    // fast fail (silent) → probe succeeds: already programmed, count it once.
    const h = harness([fail, ok])
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'flashed')).toBe(true))
    await h.session.stop()
    const flashed = h.events.filter((e) => e.type === 'flashed')
    expect(flashed).toEqual([{ type: 'flashed', count: 1, elapsedMs: 0 }])
  })

  it('stop aborts an in-flight attempt and reports the tally', async () => {
    const h = harness([fail, fail, ok, ok]) // flash one, then block in removal wait
    h.session.start()
    await settled(h, 5)
    await h.session.stop()

    expect(h.events.at(-2)).toEqual({ type: 'stopped', count: 1 })
    expect(h.events.at(-1)).toEqual({ type: 'phase', phase: 'idle' })
  })

  it('reports a missing nrfutil and ends the session', async () => {
    const h = harness([], { resolveBin: () => Promise.resolve(null) })
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'stopped')).toBe(true))
    expect(h.events).toContainEqual({
      type: 'log',
      level: 'error',
      code: 'nrfutil-missing',
      detail: undefined
    })
    expect(h.calls).toEqual([])
  })

  it('reports a missing hex and a missing device plugin', async () => {
    const noHex = harness([], { hexExists: () => Promise.resolve(false) })
    noHex.session.start()
    await vi.waitFor(() => expect(noHex.events.some((e) => e.type === 'stopped')).toBe(true))
    expect(noHex.events.some((e) => e.type === 'log' && e.code === 'hex-missing')).toBe(true)

    const noPlugin = harness([], {
      ensureDevice: () => Promise.resolve({ ok: false, message: 'no internet' })
    })
    noPlugin.session.start()
    await vi.waitFor(() => expect(noPlugin.events.some((e) => e.type === 'stopped')).toBe(true))
    expect(noPlugin.events).toContainEqual({
      type: 'log',
      level: 'error',
      code: 'device-plugin-missing',
      detail: 'no internet'
    })
  })

  it('start is idempotent while running', async () => {
    const h = harness([])
    h.session.start()
    h.session.start()
    await settled(h, 1)
    await h.session.stop()
    expect(h.events.filter((e) => e.type === 'phase' && e.phase === 'setup')).toHaveLength(1)
    expect(h.events.filter((e) => e.type === 'stopped')).toHaveLength(1)
  })

  it('hints once when nothing happens for a long time', async () => {
    // Every now() call advances the fake clock enough that the failing arm
    // cycles cross stuckHintMs almost immediately.
    let clock = 0
    const h = harness([fail, fail, fail, fail, ok], {
      now: () => {
        clock += BULK_FLASH.stuckHintMs / 2
        return clock
      }
    })
    h.session.start()
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'flashed')).toBe(true))
    await h.session.stop()
    expect(h.events.filter((e) => e.type === 'log' && e.code === 'stuck-hint')).toHaveLength(1)
  })
})
