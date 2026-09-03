// Pure logic for the guided gyro sensitivity calibration.
//
// Nothing here touches Electron, the DOM, or a serial port: it is a turn
// accumulator over a quaternion stream plus a fold that mirrors the firmware's
// `cal_sens.c` phase machine, so both can be unit-tested without hardware.
//
// Why the flow needs to track this at all: the firmware reports success,
// failure, and the computed scale only on the *tracker's own* serial console —
// nothing comes back over the radio (see the Phase 1 handoff, Task F3). Until
// that gap is closed, the phase we show is inferred from the receiver's ack
// plus the orientation feed, and the real success detector is the verification
// spin at the end.
//
// One simplification worth stating: the spin is always about **world up**. The
// axis in `sens auto <x|y|z>` selects which *body* axis the user stands
// vertical (Z flat on the desk, X/Y on edge); the rotation itself is the
// tracker sliding flat on a surface. So the accumulator never needs the axis,
// and "off-axis motion" — which the firmware measures in the body frame
// against the commanded axis — is the same quantity as tilt measured in the
// world frame here, as long as the user placed the tracker as instructed.

import { RECEIVER_CONSOLE, SENS_CAL } from './config'
import type { Quaternion, SensCalAxis } from './types'

const RAD_TO_DEG = 180 / Math.PI

/**
 * Exponential smoothing applied to the rate estimate. A single 30 ms sample is
 * far too noisy to compare against the firmware's 30 dps / 10 dps thresholds
 * without chattering between phases.
 */
const RATE_SMOOTHING = 0.3

/**
 * How long to wait for the receiver to echo its `Sens auto request sent …`
 * ack before giving up. The receiver answers immediately or not at all.
 */
export const ACK_TIMEOUT_MS = 3000

// ---------------------------------------------------------------------------
// Quaternion helpers
// ---------------------------------------------------------------------------

function conjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
}

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  }
}

// ---------------------------------------------------------------------------
// Turn accumulator
// ---------------------------------------------------------------------------

/** One sample-to-sample step, split into rotation about world up and the rest. */
export interface RotationDelta {
  /** Signed rotation about world up (+Y), in degrees. */
  aboutUpDeg: number
  /** Rotation about everything else — tilt and wobble — in degrees. */
  offAxisDeg: number
  dtMs: number
}

/**
 * Rotation between two orientations, decomposed about world up.
 *
 * Taking the *incremental* world-frame delta `curr · prev⁻¹` (rather than
 * reading a yaw angle out of each sample and unwrapping it) is what makes the
 * turn count singularity-free: a yaw extraction degenerates when the tracker
 * is tipped on edge, exactly the placement two of the three axes require.
 * The only requirement is that a single step stays under 180°, which at 30 ms
 * and 360 °/s means ~11°.
 */
export function rotationDelta(prev: Quaternion, curr: Quaternion, dtMs: number): RotationDelta {
  let d = multiply(curr, conjugate(prev))
  // Take the shortest arc: q and -q are the same rotation.
  if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w }

  const sin = Math.hypot(d.x, d.y, d.z)
  if (sin < 1e-9) return { aboutUpDeg: 0, offAxisDeg: 0, dtMs }

  const angleDeg = 2 * Math.atan2(sin, d.w) * RAD_TO_DEG
  // Axis of the delta, as a unit vector; its Y component is the fraction of
  // the rotation that is about world up.
  const upComponent = d.y / sin
  const offComponent = Math.sqrt(Math.max(0, 1 - upComponent * upComponent))
  return {
    aboutUpDeg: angleDeg * upComponent,
    offAxisDeg: angleDeg * offComponent,
    dtMs
  }
}

/** Running total of how far the tracker has been turned. */
export interface TurnAccumulator {
  lastQuat: Quaternion | null
  lastAtMs: number | null
  /** Signed rotation about world up since the last reset, in degrees. */
  totalDeg: number
  /** Rotation about every other axis since the last reset, in degrees. */
  offAxisDeg: number
  /** Smoothed magnitude of the rate about world up, in deg/s. */
  rateDps: number
}

export function emptyAccumulator(): TurnAccumulator {
  return { lastQuat: null, lastAtMs: null, totalDeg: 0, offAxisDeg: 0, rateDps: 0 }
}

/**
 * Fold one orientation sample in. The first sample only seeds the reference;
 * samples with a non-positive or implausibly large gap are used to re-seed
 * rather than integrated, so a stalled feed cannot invent turns.
 */
export function pushRotation(
  acc: TurnAccumulator,
  quat: Quaternion,
  atMs: number
): TurnAccumulator {
  if (!acc.lastQuat || acc.lastAtMs === null) {
    return { ...acc, lastQuat: quat, lastAtMs: atMs }
  }
  const dtMs = atMs - acc.lastAtMs
  if (dtMs <= 0 || dtMs > 500) {
    return { ...acc, lastQuat: quat, lastAtMs: atMs, rateDps: 0 }
  }

  const delta = rotationDelta(acc.lastQuat, quat, dtMs)
  const instantDps = Math.abs(delta.aboutUpDeg) / (dtMs / 1000)
  return {
    lastQuat: quat,
    lastAtMs: atMs,
    totalDeg: acc.totalDeg + delta.aboutUpDeg,
    offAxisDeg: acc.offAxisDeg + delta.offAxisDeg,
    rateDps: acc.rateDps + (instantDps - acc.rateDps) * RATE_SMOOTHING
  }
}

/** Whole and fractional turns measured so far. */
export function turnsMeasured(acc: TurnAccumulator): number {
  return Math.abs(acc.totalDeg) / 360
}

/**
 * Fraction of the motion that was *not* about the spin axis. Compare against
 * `SENS_CAL.offAxisWarnRatio` / `offAxisRejectRatio` — the firmware rejects
 * the run outright above the latter.
 */
export function offAxisRatio(acc: TurnAccumulator): number {
  const total = Math.abs(acc.totalDeg) + acc.offAxisDeg
  return total > 0 ? acc.offAxisDeg / total : 0
}

// ---------------------------------------------------------------------------
// Phase machine
// ---------------------------------------------------------------------------

/**
 * Where the run is, mirroring `cal_sens.c`. `sending` and `failed` are ours;
 * the rest track firmware states the user can see on the tracker's LED.
 */
export type SensCalPhase =
  | 'idle'
  | 'sending'
  | 'bias'
  | 'ready-to-spin'
  | 'spinning'
  | 'stopping'
  | 'complete'
  | 'failed'

/** How a run ended badly. */
export type SensCalFailure =
  /** The receiver rejected the command (bad axis or revolution count). */
  | 'rejected'
  /** The receiver never acked — wrong port, or it is not listening. */
  | 'no-ack'
  /** The user never started spinning within `startTimeoutMs`. */
  | 'no-spin'
  /** The spin did not finish inside `spinTimeoutMs`. */
  | 'spin-timeout'
  /** The user left the flow. */
  | 'aborted'

/**
 * Best guess at *why* a run failed, for the failure copy. Inferred from what
 * we measured, because the firmware's own verdict never leaves the tracker.
 */
export type SensCalCause = 'off-axis' | 'too-slow' | 'under-spun' | 'unknown'

export interface SensCalState {
  phase: SensCalPhase
  axis: SensCalAxis
  revolutions: number
  /** Latest timestamp fed in, in ms on the caller's clock. */
  nowMs: number
  /** When the current phase began. */
  phaseStartedAtMs: number
  /** When the spin itself began — the clock the 60 s budget runs against. */
  spinStartedAtMs: number | null
  acc: TurnAccumulator
  failure?: SensCalFailure
  cause?: SensCalCause
}

export function initialSensCalState(
  axis: SensCalAxis = 'z',
  revolutions: number = SENS_CAL.revolutions
): SensCalState {
  return {
    phase: 'idle',
    axis,
    revolutions,
    nowMs: 0,
    phaseStartedAtMs: 0,
    spinStartedAtMs: null,
    acc: emptyAccumulator()
  }
}

export type SensCalEvent =
  /** The `send … sens auto …` command has been written to the receiver. */
  | { type: 'sent'; axis: SensCalAxis; revolutions: number; atMs: number }
  /** A line from the receiver console. */
  | { type: 'console'; line: string; atMs: number }
  /** An orientation sample from the live feed. */
  | { type: 'rotation'; quat: Quaternion; atMs: number }
  /** A clock tick, so timeouts advance even when the feed is quiet. */
  | { type: 'tick'; atMs: number }
  | { type: 'abort'; atMs: number }

function enter(state: SensCalState, phase: SensCalPhase, atMs: number): SensCalState {
  return { ...state, phase, phaseStartedAtMs: atMs, nowMs: atMs }
}

function fail(state: SensCalState, failure: SensCalFailure, atMs: number): SensCalState {
  return {
    ...enter(state, 'failed', atMs),
    failure,
    cause: inferCause(state, failure)
  }
}

/**
 * Advance the machine by one event. Pure: same state in, same state out, so
 * the whole run can be replayed in a test from a list of events.
 */
export function reduceSensCal(state: SensCalState, event: SensCalEvent): SensCalState {
  switch (event.type) {
    case 'sent':
      return {
        ...initialSensCalState(event.axis, event.revolutions),
        phase: 'sending',
        nowMs: event.atMs,
        phaseStartedAtMs: event.atMs
      }

    case 'abort':
      return { ...enter(state, 'failed', event.atMs), failure: 'aborted' }

    case 'console': {
      if (state.phase !== 'sending') return { ...state, nowMs: event.atMs }
      if (RECEIVER_CONSOLE.sensAutoRejectRegex.test(event.line)) {
        return fail(state, 'rejected', event.atMs)
      }
      if (RECEIVER_CONSOLE.sensAutoAckRegex.test(event.line)) {
        return enter(state, 'bias', event.atMs)
      }
      return { ...state, nowMs: event.atMs }
    }

    case 'rotation':
      return advance({ ...state, acc: pushRotation(state.acc, event.quat, event.atMs) }, event.atMs)

    case 'tick':
      return advance(state, event.atMs)
  }
}

/** Timeout / threshold checks, run after every clock or rotation event. */
function advance(state: SensCalState, atMs: number): SensCalState {
  const s = { ...state, nowMs: atMs }
  const inPhaseMs = atMs - s.phaseStartedAtMs

  switch (s.phase) {
    case 'sending':
      return inPhaseMs > ACK_TIMEOUT_MS ? fail(s, 'no-ack', atMs) : s

    case 'bias':
      // The tracker averages gyro bias for a fixed window, then asks for the
      // spin. Nothing is reported, so we mirror the firmware's own clock.
      return inPhaseMs >= SENS_CAL.biasWindowMs ? enter(s, 'ready-to-spin', atMs) : s

    case 'ready-to-spin':
      if (s.acc.rateDps >= SENS_CAL.startRateDps) {
        // The spin is the thing being measured — start counting from here.
        return {
          ...enter(s, 'spinning', atMs),
          spinStartedAtMs: atMs,
          acc: { ...s.acc, totalDeg: 0, offAxisDeg: 0 }
        }
      }
      return inPhaseMs > SENS_CAL.startTimeoutMs ? fail(s, 'no-spin', atMs) : s

    case 'spinning': {
      const spinMs = atMs - (s.spinStartedAtMs ?? s.phaseStartedAtMs)
      if (spinMs > SENS_CAL.spinTimeoutMs) return fail(s, 'spin-timeout', atMs)
      // The firmware only accepts a stop once enough angle has been covered
      // *and* the tracker has gone quiet — under-spinning does not produce a
      // bad calibration, it hangs until the timeout.
      if (hasEnoughAngle(s) && s.acc.rateDps < SENS_CAL.stopRateDps) {
        return enter(s, 'stopping', atMs)
      }
      return s
    }

    case 'stopping': {
      const spinMs = atMs - (s.spinStartedAtMs ?? s.phaseStartedAtMs)
      if (spinMs > SENS_CAL.spinTimeoutMs) return fail(s, 'spin-timeout', atMs)
      // Moving again cancels the dwell, exactly as the firmware does.
      if (s.acc.rateDps >= SENS_CAL.stopRateDps) return enter(s, 'spinning', atMs)
      return inPhaseMs >= SENS_CAL.stopDwellMs ? enter(s, 'complete', atMs) : s
    }

    default:
      return s
  }
}

// ---------------------------------------------------------------------------
// Selectors — everything the UI reads, derived rather than stored
// ---------------------------------------------------------------------------

/** Turns completed in the current spin. */
export function turnsCompleted(state: SensCalState): number {
  return turnsMeasured(state.acc)
}

/** True once the firmware would accept a stop (`SENS_CAL.minFraction`). */
export function hasEnoughAngle(state: SensCalState): boolean {
  return turnsMeasured(state.acc) >= state.revolutions * SENS_CAL.minFraction
}

/**
 * Where the user *should* be by now, for the pace guide beside the live
 * counter. The budget covers the spin and the careful edge-aligned stop, so
 * the pace asked for is deliberately faster than `spinTimeoutMs / revolutions`.
 */
export function paceTurns(state: SensCalState): number {
  if (state.spinStartedAtMs === null) return 0
  const elapsedS = (state.nowMs - state.spinStartedAtMs) / 1000
  return Math.min(state.revolutions, elapsedS / SENS_CAL.paceSecondsPerTurn)
}

/** Seconds left on whichever budget the current phase runs against. */
export function secondsLeft(state: SensCalState): number {
  const remaining = (ms: number, since: number): number =>
    Math.max(0, (ms - (state.nowMs - since)) / 1000)
  switch (state.phase) {
    case 'ready-to-spin':
      return remaining(SENS_CAL.startTimeoutMs, state.phaseStartedAtMs)
    case 'spinning':
    case 'stopping':
      return remaining(SENS_CAL.spinTimeoutMs, state.spinStartedAtMs ?? state.phaseStartedAtMs)
    default:
      return 0
  }
}

/** Whether the countdown should read as urgent. */
export function isUrgent(state: SensCalState): boolean {
  return (
    (state.phase === 'spinning' || state.phase === 'stopping') &&
    secondsLeft(state) <= SENS_CAL.urgentSecondsLeft
  )
}

/** Off-axis motion level, for the "keep it flat" coaching during the spin. */
export function offAxisLevel(state: SensCalState): 'ok' | 'warn' | 'reject' {
  const ratio = offAxisRatio(state.acc)
  if (ratio >= SENS_CAL.offAxisRejectRatio) return 'reject'
  if (ratio >= SENS_CAL.offAxisWarnRatio) return 'warn'
  return 'ok'
}

/**
 * Most likely reason a run failed. The firmware's own verdict never leaves the
 * tracker, so this reads our own measurements: too much tilt is the commonest
 * failure for a hand-turned tracker stood on edge, and otherwise a timeout
 * means the spin was too slow to finish the required angle in the budget.
 */
export function inferCause(state: SensCalState, failure: SensCalFailure): SensCalCause {
  if (failure !== 'spin-timeout') return 'unknown'
  if (offAxisRatio(state.acc) >= SENS_CAL.offAxisWarnRatio) return 'off-axis'
  if (!hasEnoughAngle(state)) return 'too-slow'
  return 'under-spun'
}

// ---------------------------------------------------------------------------
// Verification spin
// ---------------------------------------------------------------------------

/**
 * Result of the verification spin: the user turns the tracker a known number
 * of times and we compare the measured angle against the truth. This is the
 * only real success detector until the firmware reports its own result.
 */
export interface VerificationResult {
  measuredDeg: number
  expectedDeg: number
  /** Measured minus expected — positive means the gyro over-reports. */
  residualDeg: number
  /** Residual spread over the turns; the number the user is shown. */
  degPerTurn: number
  /** Measured / expected. Outside the firmware's clamp means a miscount. */
  impliedScale: number
  /** Whether the implied scale is inside `SENS_CAL.minScale`..`maxScale`. */
  withinClamp: boolean
  pass: boolean
}

export function verifySpin(
  acc: TurnAccumulator,
  revolutions: number = SENS_CAL.revolutions
): VerificationResult {
  const measuredDeg = Math.abs(acc.totalDeg)
  const expectedDeg = revolutions * 360
  const residualDeg = measuredDeg - expectedDeg
  const degPerTurn = revolutions > 0 ? residualDeg / revolutions : 0
  const impliedScale = expectedDeg > 0 ? measuredDeg / expectedDeg : 0
  const withinClamp = impliedScale >= SENS_CAL.minScale && impliedScale <= SENS_CAL.maxScale
  return {
    measuredDeg,
    expectedDeg,
    residualDeg,
    degPerTurn,
    impliedScale,
    withinClamp,
    // A residual so large that it implies a miscounted spin is not a pass,
    // however small the per-turn number would look.
    pass: withinClamp && Math.abs(degPerTurn) <= SENS_CAL.verifyPassDegPerTurn
  }
}
