// Pure logic for the guided gyro sensitivity calibration.
//
// Nothing here touches Electron, the DOM, or a serial port: it is a turn
// accumulator over a quaternion stream plus a fold that mirrors the firmware's
// `cal_sens.c` phase machine, so both can be unit-tested without hardware.
//
// Two sources drive the phase machine. Firmware with the sens-cal report
// (Phase 1b, Task F3) streams its own phase, verdict, and computed scale, which
// the receiver echoes on its console; when those lines arrive they are the
// truth. Older firmware reports nothing over the radio, so the machine also
// infers the phase from the receiver's ack plus the orientation feed and its
// own copy of the firmware's timeouts — and falls back to that whenever the
// report goes quiet. Either way the verification spin at the end measures the
// one thing the firmware cannot: the residual error after the correction.
//
// One simplification worth stating: the spin is always about **world up**. The
// axis in `sens auto <x|y|z>` selects which *body* axis the user stands
// vertical (Z flat on the desk, X/Y on edge); the rotation itself is the
// tracker sliding flat on a surface. So the accumulator never needs the axis,
// and "off-axis motion" — which the firmware measures in the body frame
// against the commanded axis — is the same quantity as tilt measured in the
// world frame here, as long as the user placed the tracker as instructed.

import {
  RECEIVER_CONSOLE,
  SENS_CAL,
  SENS_CAL_PHASE,
  SENS_CAL_REPORT_AXES,
  SENS_CAL_RESULT
} from './config'
import type { Quaternion, SensCalAxis, SensCalReport } from './types'

const RAD_TO_DEG = 180 / Math.PI

/**
 * Exponential smoothing applied to the rate estimate. A single 30 ms sample is
 * far too noisy to compare against the firmware's 30 dps / 10 dps thresholds
 * without chattering between phases.
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
 * sliding a tracker on a desk produces, and an order of magnitude above the
 * ~65 °/s target pace. The live feed runs at 30 ms; even the idle 200 ms rate
 * stays inside this, so the counter still works if the rate change is lost.
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
}

export function emptyAccumulator(): TurnAccumulator {
  return { lastQuat: null, lastAtMs: null, totalDeg: 0, offAxisDeg: 0, rateDps: 0 }
}

/**
 * Fold one orientation sample in. The first sample only seeds the reference;
 * samples the accumulator cannot trust are used to re-seed rather than
 * integrated, so neither a stalled feed nor an aliased step can quietly
 * change the turn count.
 */
export function pushRotation(
  acc: TurnAccumulator,
  quat: Quaternion,
  atMs: number
): TurnAccumulator {
  if (!acc.lastQuat || acc.lastAtMs === null) {
    return { ...acc, lastQuat: quat, lastAtMs: atMs }
  }
  const reseed = { ...acc, lastQuat: quat, lastAtMs: atMs, rateDps: 0 }

  const dtMs = atMs - acc.lastAtMs
  if (dtMs <= 0 || dtMs > MAX_STEP_MS) return reseed

  const delta = rotationDelta(acc.lastQuat, quat, dtMs)
  // Belt and braces: within the time bound a step this large is not real
  // motion, so integrating it would more likely subtract turns than add them.
  if (delta.totalDeg > MAX_STEP_DEG) return reseed

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
// Firmware report
// ---------------------------------------------------------------------------

/**
 * Parse one receiver console line into the tracker's sens-cal report, or
 * `null` if the line is anything else.
 */
export function parseSensCalReport(line: string): SensCalReport | null {
  const m = RECEIVER_CONSOLE.sensCalReportRegex.exec(line)
  if (!m) return null
  const axisCode = Number(m[4])
  const axis = SENS_CAL_REPORT_AXES[axisCode]
  if (!axis) return null
  const scaleQ12 = Number(m[6])
  return {
    slot: Number(m[1]),
    phase: Number(m[2]),
    result: Number(m[3]),
    axis,
    seq: Number(m[5]),
    scale: scaleQ12 > 0 ? scaleQ12 / SENS_CAL.reportScaleQ12 : undefined,
    progressDeg: Number(m[7])
  }
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
  /** The tracker itself rejected the run — see `SensCalState.result`. */
  | 'firmware'
  /** The user left the flow. */
  | 'aborted'

/**
 * Best guess at *why* a run failed, for the failure copy. Taken from the
 * firmware's result code when there is one, otherwise inferred from what we
 * measured.
 */
export type SensCalCause =
  | 'off-axis'
  | 'too-slow'
  | 'under-spun'
  | 'miscount'
  | 'not-still'
  | 'unknown'

export interface SensCalState {
  phase: SensCalPhase
  axis: SensCalAxis
  revolutions: number
  /** Receiver slot the command went to; reports from other slots are ignored. */
  slot: number | null
  /** Latest timestamp fed in, in ms on the caller's clock. */
  nowMs: number
  /** When the current phase began. */
  phaseStartedAtMs: number
  /** When the spin itself began — the clock the 60 s budget runs against. */
  spinStartedAtMs: number | null
  acc: TurnAccumulator
  failure?: SensCalFailure
  cause?: SensCalCause
  /** Firmware result code (`SENS_CAL_RESULT`) once the tracker has ruled. */
  result?: number
  /** Latest report from the tracker for *this* run. */
  report?: SensCalReport
  /** When `report` arrived; decides whether the report is still trusted. */
  reportAtMs?: number
  /**
   * Latest report seen on the console at any time, kept across runs. A run
   * that starts inside the tracker's 10 s linger would otherwise mistake the
   * previous verdict for its own.
   */
  lastReport?: SensCalReport
  /** `seq` of a verdict that was already on the console when this run began. */
  staleDoneSeq?: number
}

export function initialSensCalState(
  axis: SensCalAxis = 'z',
  revolutions: number = SENS_CAL.revolutions
): SensCalState {
  return {
    phase: 'idle',
    axis,
    revolutions,
    slot: null,
    nowMs: 0,
    phaseStartedAtMs: 0,
    spinStartedAtMs: null,
    acc: emptyAccumulator()
  }
}

/**
 * A fresh state for the next run that keeps what has to survive between runs:
 * the last report seen, so a lingering verdict from the previous run is not
 * mistaken for the new one.
 */
export function prepareSensCal(
  previous: SensCalState,
  axis: SensCalAxis,
  revolutions: number = SENS_CAL.revolutions
): SensCalState {
  const lastReport = previous.report ?? previous.lastReport
  return {
    ...initialSensCalState(axis, revolutions),
    lastReport,
    staleDoneSeq: lastReport?.phase === SENS_CAL_PHASE.done ? lastReport.seq : undefined
  }
}

export type SensCalEvent =
  /** The `send … sens auto …` command has been written to the receiver. */
  | { type: 'sent'; axis: SensCalAxis; revolutions: number; slot?: number; atMs: number }
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
 * Whether the tracker's own report is current enough to trust over the local
 * timeout inference. Reports arrive at 2 Hz while a run is live, so silence
 * for `SENS_CAL.reportStaleMs` means either older firmware or a lost link —
 * both cases where the local clocks are the best information available.
 */
export function reportFresh(state: SensCalState, atMs: number = state.nowMs): boolean {
  return state.reportAtMs !== undefined && atMs - state.reportAtMs <= SENS_CAL.reportStaleMs
}

/** Order of phases, so a report can only move the machine forward. */
const PHASE_RANK: Record<SensCalPhase, number> = {
  idle: 0,
  sending: 1,
  bias: 2,
  'ready-to-spin': 3,
  spinning: 4,
  stopping: 4,
  complete: 5,
  failed: 5
}

function phaseForReport(report: SensCalReport): SensCalPhase | null {
  switch (report.phase) {
    case SENS_CAL_PHASE.holdStill:
    case SENS_CAL_PHASE.bias:
      return 'bias'
    case SENS_CAL_PHASE.armed:
      return 'ready-to-spin'
    case SENS_CAL_PHASE.recording:
      return 'spinning'
    default:
      return null
  }
}

/**
 * Fold in one report from the tracker. In-progress phases only ever move the
 * machine forward — the local rate detection usually notices the spin start
 * before the 2 Hz report does, and must not be dragged back. A verdict is
 * authoritative and always applies, so a rejection the tracker reaches after
 * the spin has stopped (off-axis, scale out of range) overrides a local
 * "complete".
 */
function applyReport(state: SensCalState, report: SensCalReport, atMs: number): SensCalState {
  const tracked = { ...state, nowMs: atMs, lastReport: report }
  if (state.slot !== null && report.slot !== state.slot) return { ...state, nowMs: atMs }
  if (state.phase === 'idle' || state.phase === 'failed' || state.phase === 'complete') {
    return tracked
  }
  const isDone = report.phase === SENS_CAL_PHASE.done
  if (isDone && report.seq === state.staleDoneSeq) return tracked

  const s: SensCalState = { ...tracked, report, reportAtMs: atMs }
  if (isDone) {
    const ruled = { ...s, result: report.result, staleDoneSeq: report.seq }
    return report.result === SENS_CAL_RESULT.ok
      ? enter(ruled, 'complete', atMs)
      : fail(ruled, 'firmware', atMs)
  }

  const target = phaseForReport(report)
  if (target === null || PHASE_RANK[target] <= PHASE_RANK[s.phase]) return s
  if (target === 'spinning') {
    return {
      ...enter(s, 'spinning', atMs),
      spinStartedAtMs: atMs,
      acc: { ...s.acc, totalDeg: 0, offAxisDeg: 0 }
    }
  }
  return enter(s, target, atMs)
}

/**
 * Advance the machine by one event. Pure: same state in, same state out, so
 * the whole run can be replayed in a test from a list of events.
 */
export function reduceSensCal(state: SensCalState, event: SensCalEvent): SensCalState {
  switch (event.type) {
    case 'sent':
      return {
        ...prepareSensCal(state, event.axis, event.revolutions),
        phase: 'sending',
        slot: event.slot ?? null,
        nowMs: event.atMs,
        phaseStartedAtMs: event.atMs
      }

    case 'abort':
      return { ...enter(state, 'failed', event.atMs), failure: 'aborted' }

    case 'console': {
      const report = parseSensCalReport(event.line)
      if (report) return applyReport(state, report, event.atMs)
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

/**
 * Timeout / threshold checks, run after every clock or rotation event.
 *
 * While the tracker's own report is fresh, the local clocks only *observe*:
 * they still notice the spin starting and stopping (the report is 2 Hz, the
 * feed is much faster) but leave every verdict — timeouts included — to the
 * tracker. When the report goes quiet the same clocks become the verdict, as
 * they were before the firmware could report at all.
 */
function advance(state: SensCalState, atMs: number): SensCalState {
  const s = { ...state, nowMs: atMs }
  const inPhaseMs = atMs - s.phaseStartedAtMs
  const trusted = reportFresh(s, atMs)

  switch (s.phase) {
    case 'sending':
      return inPhaseMs > ACK_TIMEOUT_MS ? fail(s, 'no-ack', atMs) : s

    case 'bias':
      // The tracker averages gyro bias for a fixed window, then asks for the
      // spin. A reporting tracker says so itself; otherwise mirror its clock.
      if (trusted) return s
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
      if (trusted) return s
      return inPhaseMs > SENS_CAL.startTimeoutMs ? fail(s, 'no-spin', atMs) : s

    case 'spinning': {
      const spinMs = atMs - (s.spinStartedAtMs ?? s.phaseStartedAtMs)
      if (!trusted && spinMs > SENS_CAL.spinTimeoutMs) return fail(s, 'spin-timeout', atMs)
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
      if (!trusted && spinMs > SENS_CAL.spinTimeoutMs) return fail(s, 'spin-timeout', atMs)
      // Moving again cancels the dwell, exactly as the firmware does.
      if (s.acc.rateDps >= SENS_CAL.stopRateDps) return enter(s, 'spinning', atMs)
      // A reporting tracker delivers the verdict itself; the dwell is only
      // the local guess at when that will be.
      if (trusted) return s
      return inPhaseMs >= SENS_CAL.stopDwellMs ? enter(s, 'complete', atMs) : s
    }

    default:
      return s
  }
}

// ---------------------------------------------------------------------------
// Selectors — everything the UI reads, derived rather than stored
// ---------------------------------------------------------------------------

/** Turns completed in the current spin, from the orientation feed. */
export function turnsCompleted(state: SensCalState): number {
  return turnsMeasured(state.acc)
}

/**
 * Turns completed as the tracker itself counts them (its integrated gyro
 * angle), or `undefined` before it has reported any. Updated at 2 Hz, so the
 * live counter stays on `turnsCompleted`; this is the number the firmware's
 * own stop criterion uses.
 */
export function firmwareTurns(state: SensCalState): number | undefined {
  const report = state.report
  if (!report || report.phase < SENS_CAL_PHASE.recording) return undefined
  return report.progressDeg / 360
}

/** The gyro scale the tracker computed and saved, once it has reported one. */
export function firmwareScale(state: SensCalState): number | undefined {
  return state.report?.scale
}

/**
 * True once the firmware would accept a stop (`SENS_CAL.minFraction`). Uses
 * whichever count is further along: the tracker's own, when it reports one,
 * is what it will actually judge by.
 */
export function hasEnoughAngle(state: SensCalState): boolean {
  const turns = Math.max(turnsMeasured(state.acc), firmwareTurns(state) ?? 0)
  return turns >= state.revolutions * SENS_CAL.minFraction
}

/**
 * True while the tracker has gone quiet after the spin and the flow is waiting
 * on its verdict rather than its own dwell clock.
 */
export function awaitingVerdict(state: SensCalState): boolean {
  return (
    state.phase === 'stopping' &&
    reportFresh(state) &&
    state.nowMs - state.phaseStartedAtMs >= SENS_CAL.stopDwellMs
  )
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
 * Most likely reason a run failed. With a firmware verdict the result code
 * names it outright; without one this reads our own measurements: too much
 * tilt is the commonest failure for a hand-turned tracker stood on edge, and
 * otherwise a timeout means the spin was too slow to finish the required angle
 * in the budget.
 */
export function inferCause(state: SensCalState, failure: SensCalFailure): SensCalCause {
  const timedOut = (): SensCalCause => {
    if (offAxisRatio(state.acc) >= SENS_CAL.offAxisWarnRatio) return 'off-axis'
    if (!hasEnoughAngle(state)) return 'too-slow'
    return 'under-spun'
  }
  if (failure === 'firmware') {
    switch (state.report?.result) {
      case SENS_CAL_RESULT.offAxis:
        return 'off-axis'
      case SENS_CAL_RESULT.spinTimeout:
        return timedOut()
      case SENS_CAL_RESULT.scaleRange:
        return 'miscount'
      case SENS_CAL_RESULT.notStill:
        return 'not-still'
      default:
        return 'unknown'
    }
  }
  if (failure !== 'spin-timeout') return 'unknown'
  return timedOut()
}

// ---------------------------------------------------------------------------
// Verification spin
// ---------------------------------------------------------------------------

/**
 * Result of the verification spin: the user turns the tracker a known number
 * of times and we compare the measured angle against the truth. The firmware
 * can say whether it *saved* a scale; only this measures whether the saved
 * scale is right, and it is the only success signal at all on firmware that
 * does not report.
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
