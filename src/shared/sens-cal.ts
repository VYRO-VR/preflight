// Pure logic for the guided gyro sensitivity calibration.
//
// Nothing here touches Electron, the DOM, or a serial port: it is a turn
// accumulator over a quaternion stream, the arithmetic that turns a measured
// spin into the value the firmware wants, and a small fold for the receiver's
// ack — so all of it can be unit-tested without hardware.
//
// The method: the app asks for the tracker to be spun a known number of full
// turns about one axis and put back exactly where it started, measures how
// far the tracker *thinks* it turned, and writes the difference to the
// tracker with `send <slot> sens <x>,<y>,<z>`. The tracker turns each value
// (degrees of difference over `SENS_CAL.firmwareRevolutions` turns) into a
// scale it multiplies every gyro sample by. Compared with the firmware's own
// `sens auto`, nothing is timed, nothing has to be spun at a set pace, and
// the result is visible on screen instead of on the tracker's serial console.
//
// The spin is always about **world up**: the placement selects which *body*
// axis the user stands vertical (flat, or on an edge), while the rotation
// itself is the tracker sliding flat on a surface. So the accumulator never
// needs the axis, and "off-axis motion" — tilt and wobble — is measured in
// the world frame. SlimeVR Server's rotation is safe to integrate this way
// whatever resets the user has done: the server's left-multiplied fixes are
// pure yaws (world up survives them) and its right-multiplied fixes cancel
// out of an incremental delta entirely.

import { RECEIVER_CONSOLE, SENS_CAL } from './config'
import type { Quaternion, SensCalAxis } from './types'
import { RAD_TO_DEG, conjugate, multiply } from './quaternion'

/**
 * Exponential smoothing applied to the rate estimates. A single 30 ms sample
 * is far too noisy to compare against a threshold without chattering.
 */
const RATE_SMOOTHING = 0.3

/**
 * Largest sample gap still integrated into the turn count.
 *
 * This bound is what keeps the count honest, and it is a statement about spin
 * rate: two orientations 180° apart are ambiguous in direction, and worse, a
 * step of 180°+x is indistinguishable from one of 180°-x the other way. No
 * inspection of the quaternions can separate those, so the only defence is to
 * sample often enough that a real spin cannot cover 180° between samples.
 *
 * 180° in 250 ms is 720 °/s — two turns a second, far beyond anything a hand
 * sliding a tracker on a desk produces. The live feed runs at 30 ms; even the
 * idle 200 ms rate stays inside this, so the counter still works if the rate
 * change is lost.
 */
const MAX_STEP_MS = 250

/**
 * Largest single-step rotation still integrated. Secondary to `MAX_STEP_MS`:
 * it narrows the ambiguous band rather than removing it, since a genuine
 * 150°-plus step and an aliased one look alike. Within the time bound above,
 * a reading this large is not a plausible hand spin, so it is treated as
 * dropped samples.
 */
const MAX_STEP_DEG = 150

/**
 * How long to wait for the receiver to echo its `Sens set … request sent …`
 * ack before giving up. The receiver answers immediately or not at all.
 */
export const ACK_TIMEOUT_MS = 3000

// ---------------------------------------------------------------------------
// Turn accumulator
// ---------------------------------------------------------------------------

/** One sample-to-sample step, split into rotation about world up and the rest. */
export interface RotationDelta {
  /** Signed rotation about world up (+Y), in degrees. */
  aboutUpDeg: number
  /** Rotation about everything else — tilt and wobble — in degrees. */
  offAxisDeg: number
  /** Magnitude of the whole step, about every axis, in degrees. */
  totalDeg: number
  dtMs: number
}

/**
 * Rotation between two orientations, decomposed about world up.
 *
 * Taking the *incremental* world-frame delta `curr · prev⁻¹` (rather than
 * reading a yaw angle out of each sample and unwrapping it) is what makes the
 * turn count singularity-free: a yaw extraction degenerates when the tracker
 * is tipped on edge, exactly the placement two of the three axes require.
 * The only requirement is that a single step stays under 180°, which at the
 * 30 ms live feed rate holds up to 6000 °/s. `pushRotation` enforces the
 * bound (`MAX_STEP_MS`) rather than trusting the feed to keep up.
 */
export function rotationDelta(prev: Quaternion, curr: Quaternion, dtMs: number): RotationDelta {
  let d = multiply(curr, conjugate(prev))
  // Take the shortest arc: q and -q are the same rotation.
  if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w }

  const sin = Math.hypot(d.x, d.y, d.z)
  if (sin < 1e-9) return { aboutUpDeg: 0, offAxisDeg: 0, totalDeg: 0, dtMs }

  const angleDeg = 2 * Math.atan2(sin, d.w) * RAD_TO_DEG
  // Axis of the delta, as a unit vector; its Y component is the fraction of
  // the rotation that is about world up.
  const upComponent = d.y / sin
  const offComponent = Math.sqrt(Math.max(0, 1 - upComponent * upComponent))
  return {
    aboutUpDeg: angleDeg * upComponent,
    offAxisDeg: angleDeg * offComponent,
    totalDeg: angleDeg,
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
  /** Smoothed magnitude of the rate about every axis, in deg/s. */
  motionDps: number
  /**
   * Samples the accumulator could not trust since the last reset — a stalled
   * feed or an aliased step. Each one is angle that was *not* counted, so a
   * measurement with any is not a measurement.
   */
  gaps: number
  /** Samples integrated since the last reset. */
  samples: number
}

export function emptyAccumulator(): TurnAccumulator {
  return {
    lastQuat: null,
    lastAtMs: null,
    totalDeg: 0,
    offAxisDeg: 0,
    rateDps: 0,
    motionDps: 0,
    gaps: 0,
    samples: 0
  }
}

/**
 * Fold one orientation sample in. The first sample only seeds the reference;
 * samples the accumulator cannot trust are used to re-seed rather than
 * integrated, so neither a stalled feed nor an aliased step can quietly
 * change the turn count — they are counted in `gaps` instead.
 */
export function pushRotation(
  acc: TurnAccumulator,
  quat: Quaternion,
  atMs: number
): TurnAccumulator {
  if (!acc.lastQuat || acc.lastAtMs === null) {
    return { ...acc, lastQuat: quat, lastAtMs: atMs }
  }
  const reseed = {
    ...acc,
    lastQuat: quat,
    lastAtMs: atMs,
    rateDps: 0,
    motionDps: 0,
    gaps: acc.gaps + 1
  }

  const dtMs = atMs - acc.lastAtMs
  if (dtMs <= 0 || dtMs > MAX_STEP_MS) return reseed

  const delta = rotationDelta(acc.lastQuat, quat, dtMs)
  // Belt and braces: within the time bound a step this large is not real
  // motion, so integrating it would more likely subtract turns than add them.
  if (delta.totalDeg > MAX_STEP_DEG) return reseed

  const dtS = dtMs / 1000
  const instantDps = Math.abs(delta.aboutUpDeg) / dtS
  const instantMotionDps = delta.totalDeg / dtS
  return {
    lastQuat: quat,
    lastAtMs: atMs,
    totalDeg: acc.totalDeg + delta.aboutUpDeg,
    offAxisDeg: acc.offAxisDeg + delta.offAxisDeg,
    rateDps: acc.rateDps + (instantDps - acc.rateDps) * RATE_SMOOTHING,
    motionDps: acc.motionDps + (instantMotionDps - acc.motionDps) * RATE_SMOOTHING,
    gaps: acc.gaps,
    samples: acc.samples + 1
  }
}

/** Whole and fractional turns measured so far. */
export function turnsMeasured(acc: TurnAccumulator): number {
  return Math.abs(acc.totalDeg) / 360
}

/**
 * Fraction of the motion that was *not* about the spin axis. Compare against
 * `SENS_CAL.offAxisWarnRatio` / `offAxisRejectRatio`.
 */
export function offAxisRatio(acc: TurnAccumulator): number {
  const total = Math.abs(acc.totalDeg) + acc.offAxisDeg
  return total > 0 ? acc.offAxisDeg / total : 0
}

/** Off-axis motion level, for the "keep it flat" coaching during the spin. */
export function offAxisLevel(acc: TurnAccumulator): 'ok' | 'warn' | 'reject' {
  const ratio = offAxisRatio(acc)
  if (ratio >= SENS_CAL.offAxisRejectRatio) return 'reject'
  if (ratio >= SENS_CAL.offAxisWarnRatio) return 'warn'
  return 'ok'
}

/** Whether the tracker is being held still, as far as the feed can tell. */
export function isStill(acc: TurnAccumulator): boolean {
  return acc.samples > 0 && acc.motionDps < SENS_CAL.stillRateDps
}

// ---------------------------------------------------------------------------
// Measurement → firmware correction
// ---------------------------------------------------------------------------

/**
 * The firmware's `sens` value for a spin: the degrees the gyro fell short
 * (or, negative, overshot) over `SENS_CAL.firmwareRevolutions` turns.
 *
 * Mirrors `cmd_sens_set` in the tracker: it computes
 * `scale = 1 / (1 - deg / (360 * rev))`, so a gyro that reads `k` times the
 * truth (measured = k · 360 · turns) needs `deg = (1 - k) · 360 · rev`, which
 * gives `scale = 1 / k`. The measurement must be made with no correction on
 * that axis, which is why the flow zeroes the axis before every spin.
 */
export function correctionDegrees(measuredDeg: number, revolutions: number): number {
  const expectedDeg = revolutions * 360
  if (expectedDeg <= 0) return 0
  return ((expectedDeg - measuredDeg) / expectedDeg) * 360 * SENS_CAL.firmwareRevolutions
}

/** The gyro scale the tracker will apply for a `sens` value. */
export function scaleFromCorrection(deg: number): number {
  const den = 1 - deg / (360 * SENS_CAL.firmwareRevolutions)
  return Math.abs(den) < 1e-6 ? Number.POSITIVE_INFINITY : 1 / den
}

/**
 * Result of one calibration spin: the user turned the tracker `revolutions`
 * times and put it back where it started, and this is what the gyro made of
 * that.
 */
export interface SpinMeasurement {
  measuredDeg: number
  expectedDeg: number
  /** Measured / expected — the gyro's scale error. 0.99 reads 1% low. */
  impliedScale: number
  /** Degrees per turn the gyro is off by; negative means it reads low. */
  errorDegPerTurn: number
  /** The value to send to the firmware for this axis. */
  correctionDeg: number
  /** Whether the implied scale is inside `SENS_CAL.minScale`..`maxScale`. */
  withinClamp: boolean
  gaps: number
  offAxis: 'ok' | 'warn' | 'reject'
  /**
   * Whether the measurement can be applied. `gaps` means the feed dropped
   * samples so angle went uncounted; `miscount` means the turn count or the
   * return-to-start was off by more than any real gyro error could be.
   */
  verdict: 'ok' | 'gaps' | 'miscount'
}

export function measureSpin(
  acc: TurnAccumulator,
  revolutions: number = SENS_CAL.revolutions
): SpinMeasurement {
  const measuredDeg = Math.abs(acc.totalDeg)
  const expectedDeg = revolutions * 360
  const impliedScale = expectedDeg > 0 ? measuredDeg / expectedDeg : 0
  const withinClamp = impliedScale > SENS_CAL.minScale && impliedScale < SENS_CAL.maxScale
  const correctionDeg = correctionDegrees(measuredDeg, revolutions)
  return {
    measuredDeg,
    expectedDeg,
    impliedScale,
    errorDegPerTurn: revolutions > 0 ? (measuredDeg - expectedDeg) / revolutions : 0,
    correctionDeg,
    withinClamp,
    gaps: acc.gaps,
    offAxis: offAxisLevel(acc),
    verdict: acc.gaps > 0 ? 'gaps' : withinClamp ? 'ok' : 'miscount'
  }
}

// ---------------------------------------------------------------------------
// The correction triple
// ---------------------------------------------------------------------------

/** Per-axis corrections held by the flow; `null` is "not calibrated". */
export type SensCorrections = Record<SensCalAxis, number | null>

export function emptyCorrections(): SensCorrections {
  return { x: null, y: null, z: null }
}

/**
 * The x/y/z triple to send. Axes without a correction go as 0, which the
 * firmware treats as scale 1 — the same as never having been calibrated.
 * `zeroAxis` clears one axis on the wire without forgetting its value, for
 * the spin that re-measures it.
 */
export function sensSetValues(
  corrections: SensCorrections,
  zeroAxis?: SensCalAxis
): [number, number, number] {
  const pick = (axis: SensCalAxis): number => (axis === zeroAxis ? 0 : (corrections[axis] ?? 0))
  return [pick('x'), pick('y'), pick('z')]
}

/**
 * Format one value the way the receiver echoes it back (`%.2f`), so the ack
 * can be matched string-for-string. `-0.00` is folded to `0.00`.
 */
export function formatSensValue(deg: number): string {
  const clamped = Math.max(-SENS_CAL.maxValueDeg, Math.min(SENS_CAL.maxValueDeg, deg))
  const s = clamped.toFixed(SENS_CAL.valueDecimals)
  return /^-0\.0+$/.test(s) ? s.slice(1) : s
}

export function formatSensValues(
  values: readonly [number, number, number]
): [string, string, string] {
  return [formatSensValue(values[0]), formatSensValue(values[1]), formatSensValue(values[2])]
}

// ---------------------------------------------------------------------------
// Send / ack fold
// ---------------------------------------------------------------------------

/**
 * Where a `sens` write is. The receiver acks on its console the moment it
 * queues the command; the tracker itself says nothing back over the radio,
 * so `acked` is as far as this can see — the verification spin is the proof.
 */
export type SendPhase = 'idle' | 'sending' | 'acked' | 'failed'

export type SendFailure =
  /** The receiver rejected the command's arguments. */
  | 'rejected'
  /** The receiver never acked — wrong port, or the slot is not paired. */
  | 'no-ack'

export interface SendState {
  phase: SendPhase
  slot: number | null
  /** The formatted values that were sent, to match against the ack. */
  values: [string, string, string] | null
  sentAtMs: number
  nowMs: number
  failure?: SendFailure
}

export function initialSendState(): SendState {
  return { phase: 'idle', slot: null, values: null, sentAtMs: 0, nowMs: 0 }
}

export type SendEvent =
  /** The command has been written to the receiver. */
  | { type: 'sent'; slot: number; values: readonly [number, number, number]; atMs: number }
  /** A line from the receiver console. */
  | { type: 'console'; line: string; atMs: number }
  /** A clock tick, so the timeout advances even when the console is quiet. */
  | { type: 'tick'; atMs: number }

/**
 * Advance the send fold by one event. Pure: same state in, same state out.
 * Console lines are only read while a send is in flight, and the ack has to
 * name the slot and echo the values, so a late ack from an earlier write
 * cannot be mistaken for this one.
 */
export function reduceSend(state: SendState, event: SendEvent): SendState {
  switch (event.type) {
    case 'sent':
      return {
        phase: 'sending',
        slot: event.slot,
        values: formatSensValues(event.values),
        sentAtMs: event.atMs,
        nowMs: event.atMs
      }

    case 'console': {
      if (state.phase !== 'sending') return { ...state, nowMs: event.atMs }
      if (RECEIVER_CONSOLE.sensSetRejectRegex.test(event.line)) {
        return { ...state, phase: 'failed', failure: 'rejected', nowMs: event.atMs }
      }
      const m = RECEIVER_CONSOLE.sensSetAckRegex.exec(event.line)
      if (m && Number(m[4]) === state.slot && state.values) {
        const echoed = [m[1], m[2], m[3]].map((v) => formatSensValue(Number(v)))
        if (echoed.every((v, i) => v === state.values![i])) {
          return { ...state, phase: 'acked', nowMs: event.atMs }
        }
      }
      return { ...state, nowMs: event.atMs }
    }

    case 'tick':
      if (state.phase === 'sending' && event.atMs - state.sentAtMs > ACK_TIMEOUT_MS) {
        return { ...state, phase: 'failed', failure: 'no-ack', nowMs: event.atMs }
      }
      return { ...state, nowMs: event.atMs }
  }
}

// ---------------------------------------------------------------------------
// Verification spin
// ---------------------------------------------------------------------------

/**
 * Result of the verification spin: with the correction applied, the user
 * turns the tracker the same number of times again and the measured angle
 * should now match the truth. This is the only confirmation the tracker
 * took the value — it reports nothing back over the radio.
 */
export interface VerificationResult {
  measuredDeg: number
  expectedDeg: number
  /** Measured minus expected — positive means the gyro over-reports. */
  residualDeg: number
  /** Residual spread over the turns; the number the user is shown. */
  degPerTurn: number
  /** Measured / expected. Outside the clamp means a miscount, not a gyro. */
  impliedScale: number
  /** Whether the implied scale is inside `SENS_CAL.minScale`..`maxScale`. */
  withinClamp: boolean
  gaps: number
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
  const withinClamp = impliedScale > SENS_CAL.minScale && impliedScale < SENS_CAL.maxScale
  return {
    measuredDeg,
    expectedDeg,
    residualDeg,
    degPerTurn,
    impliedScale,
    withinClamp,
    gaps: acc.gaps,
    // A residual so large that it implies a miscounted spin is not a pass,
    // however small the per-turn number would look; nor is a spin the feed
    // dropped out of.
    pass: acc.gaps === 0 && withinClamp && Math.abs(degPerTurn) <= SENS_CAL.verifyPassDegPerTurn
  }
}
