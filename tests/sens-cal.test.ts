import { describe, it, expect } from 'vitest'
import { SENS_CAL } from '../src/shared/config'
import {
  ACK_TIMEOUT_MS,
  emptyAccumulator,
  hasEnoughAngle,
  inferCause,
  initialSensCalState,
  isUrgent,
  offAxisLevel,
  offAxisRatio,
  paceTurns,
  pushRotation,
  reduceSensCal,
  rotationDelta,
  secondsLeft,
  turnsCompleted,
  turnsMeasured,
  verifySpin,
  type SensCalEvent,
  type SensCalState,
  type TurnAccumulator
} from '../src/shared/sens-cal'
import type { Quaternion } from '../src/shared/types'

const DEG = Math.PI / 180

/** Quaternion for `deg` about an arbitrary unit axis. */
function quatAbout(axis: [number, number, number], deg: number): Quaternion {
  const half = (deg * DEG) / 2
  const s = Math.sin(half)
  return { x: axis[0] * s, y: axis[1] * s, z: axis[2] * s, w: Math.cos(half) }
}

/** Quaternion for a yaw of `deg` about world up (+Y). */
const yaw = (deg: number): Quaternion => quatAbout([0, 1, 0], deg)

/**
 * Feed a spin into an accumulator: `totalDeg` degrees about world up, sampled
 * every `stepMs`, starting at `startMs`. `tilt` pre-rotates the tracker about
 * a horizontal axis (the "stood on edge" placement) — a constant tilt must not
 * leak into the turn count.
 */
function spin({
  totalDeg,
  dps,
  stepMs = 30,
  startMs = 0,
  tiltDeg = 0,
  acc = emptyAccumulator()
}: {
  totalDeg: number
  dps: number
  stepMs?: number
  startMs?: number
  tiltDeg?: number
  acc?: TurnAccumulator
}): { acc: TurnAccumulator; endMs: number; samples: { quat: Quaternion; atMs: number }[] } {
  const tilt = quatAbout([1, 0, 0], tiltDeg)
  const mul = (a: Quaternion, b: Quaternion): Quaternion => ({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  })

  const samples: { quat: Quaternion; atMs: number }[] = []
  const durationMs = (Math.abs(totalDeg) / dps) * 1000
  let out = acc
  // Always land the last sample exactly on the end of the spin, so the fixture
  // delivers the full angle rather than one step short of it.
  for (let ms = 0; ms <= durationMs; ms = Math.min(ms + stepMs, durationMs)) {
    const progressed = (ms / durationMs) * totalDeg
    const quat = mul(yaw(progressed), tilt)
    const atMs = startMs + ms
    samples.push({ quat, atMs })
    out = pushRotation(out, quat, atMs)
    if (ms === durationMs) break
  }
  return { acc: out, endMs: startMs + durationMs, samples }
}

describe('rotationDelta', () => {
  it('splits a pure yaw step into all about-up and no off-axis', () => {
    const d = rotationDelta(yaw(0), yaw(10), 30)
    expect(d.aboutUpDeg).toBeCloseTo(10, 6)
    expect(d.offAxisDeg).toBeCloseTo(0, 6)
    expect(d.totalDeg).toBeCloseTo(10, 6)
  })

  it('signs the rotation, so a reversal cancels', () => {
    expect(rotationDelta(yaw(10), yaw(0), 30).aboutUpDeg).toBeCloseTo(-10, 6)
  })

  it('reports a pure tilt as entirely off-axis', () => {
    const d = rotationDelta(quatAbout([1, 0, 0], 0), quatAbout([1, 0, 0], 8), 30)
    expect(d.aboutUpDeg).toBeCloseTo(0, 6)
    expect(d.offAxisDeg).toBeCloseTo(8, 6)
  })
})

describe('turn accumulator', () => {
  it('counts ten turns of a flat spin', () => {
    const { acc } = spin({ totalDeg: 3600, dps: 360 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
    expect(offAxisRatio(acc)).toBeCloseTo(0, 4)
  })

  it('counts the same ten turns with the tracker stood on edge', () => {
    // 90° of tilt is where a naive yaw-from-quaternion extraction falls apart.
    const { acc } = spin({ totalDeg: 3600, dps: 360, tiltDeg: 90 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
    expect(offAxisRatio(acc)).toBeCloseTo(0, 4)
  })

  it('counts turns in either direction', () => {
    const { acc } = spin({ totalDeg: -3600, dps: 360 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
  })

  it('tracks the spin rate', () => {
    const { acc } = spin({ totalDeg: 1080, dps: 360 })
    expect(acc.rateDps).toBeGreaterThan(300)
    expect(acc.rateDps).toBeLessThan(400)
  })

  it('flags wobble as off-axis motion', () => {
    let acc = emptyAccumulator()
    let atMs = 0
    // Alternate a yaw step with a tilt step: half the motion is off-axis.
    for (let i = 0; i < 20; i++) {
      const tilt = quatAbout([1, 0, 0], i % 2 === 0 ? 0 : 6)
      const mulYaw = quatAbout([0, 1, 0], i * 6)
      acc = pushRotation(
        acc,
        {
          w: mulYaw.w * tilt.w - mulYaw.x * tilt.x - mulYaw.y * tilt.y - mulYaw.z * tilt.z,
          x: mulYaw.w * tilt.x + mulYaw.x * tilt.w + mulYaw.y * tilt.z - mulYaw.z * tilt.y,
          y: mulYaw.w * tilt.y - mulYaw.x * tilt.z + mulYaw.y * tilt.w + mulYaw.z * tilt.x,
          z: mulYaw.w * tilt.z + mulYaw.x * tilt.y - mulYaw.y * tilt.x + mulYaw.z * tilt.w
        },
        (atMs += 30)
      )
    }
    expect(offAxisRatio(acc)).toBeGreaterThan(SENS_CAL.offAxisWarnRatio)
  })

  it('re-seeds instead of integrating across a feed stall', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(170), 5000) // a 5 s gap: the feed dropped out
    expect(acc.totalDeg).toBe(0)
    expect(acc.rateDps).toBe(0)
  })

  it('re-seeds on a gap long enough for a spin to alias', () => {
    // 300 ms is short enough to look like a live sample, but a fast spin can
    // cover more than 180° in it — and past 180° a step reads as the shorter
    // rotation the other way, silently subtracting turns from the count.
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(216), 300)
    expect(acc.totalDeg).toBe(0)
  })

  it('re-seeds on a step whose reading is near the ambiguous half-turn', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(170), 200)
    expect(acc.totalDeg).toBe(0)
  })

  it('still integrates a large step that is unambiguous', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(140), 200)
    expect(acc.totalDeg).toBeCloseTo(140, 6)
  })

  it('keeps counting from the new reference after a re-seed', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(216), 300) // dropped samples: re-seeds here
    acc = pushRotation(acc, yaw(246), 330)
    expect(acc.totalDeg).toBeCloseTo(30, 6)
  })

  it('keeps counting at the idle feed rate, in case the rate change is lost', () => {
    const { acc } = spin({ totalDeg: 3600, dps: 360, stepMs: 200 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
  })
})

// ---------------------------------------------------------------------------
// Phase machine
// ---------------------------------------------------------------------------

const ACK = 'Sens auto request sent to tracker 0 on z axis for 10 rev'

/** Replay a list of events through the reducer. */
function run(events: SensCalEvent[], from = initialSensCalState()): SensCalState {
  return events.reduce(reduceSensCal, from)
}

/** Drive a run up to the point where the tracker is asking for the spin. */
function readyToSpin(): SensCalState {
  return run([
    { type: 'sent', axis: 'z', revolutions: 10, atMs: 0 },
    { type: 'console', line: ACK, atMs: 50 },
    { type: 'tick', atMs: 50 + SENS_CAL.biasWindowMs }
  ])
}

describe('sens-cal phase machine', () => {
  it('starts idle', () => {
    expect(initialSensCalState().phase).toBe('idle')
  })

  it('waits for the receiver ack, then mirrors the bias window', () => {
    const sent = run([{ type: 'sent', axis: 'z', revolutions: 10, atMs: 0 }])
    expect(sent.phase).toBe('sending')

    const acked = reduceSensCal(sent, { type: 'console', line: ACK, atMs: 50 })
    expect(acked.phase).toBe('bias')

    expect(reduceSensCal(acked, { type: 'tick', atMs: 50 + SENS_CAL.biasWindowMs - 1 }).phase).toBe(
      'bias'
    )
    expect(readyToSpin().phase).toBe('ready-to-spin')
  })

  it('fails when the receiver never acks', () => {
    const s = run([
      { type: 'sent', axis: 'z', revolutions: 10, atMs: 0 },
      { type: 'tick', atMs: ACK_TIMEOUT_MS + 1 }
    ])
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('no-ack')
  })

  it('fails when the receiver rejects the command', () => {
    const s = run([
      { type: 'sent', axis: 'z', revolutions: 10, atMs: 0 },
      { type: 'console', line: "Invalid revolutions '0'", atMs: 20 }
    ])
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('rejected')
  })

  it('fails when the user never starts spinning', () => {
    const s = reduceSensCal(readyToSpin(), {
      type: 'tick',
      atMs: readyToSpin().phaseStartedAtMs + SENS_CAL.startTimeoutMs + 1
    })
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('no-spin')
  })

  it('runs a good ten-turn spin through to complete', () => {
    let s = readyToSpin()
    const { samples, endMs } = spin({
      totalDeg: 3600,
      dps: 360,
      startMs: s.phaseStartedAtMs + 100
    })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    expect(s.phase).toBe('spinning')
    expect(turnsCompleted(s)).toBeGreaterThan(9)
    expect(hasEnoughAngle(s)).toBe(true)

    // Hold still: the rate decays below the stop threshold and the dwell runs.
    let atMs = endMs
    const last = samples[samples.length - 1].quat
    while (s.phase !== 'complete' && atMs < endMs + 5000) {
      atMs += 30
      s = reduceSensCal(s, { type: 'rotation', quat: last, atMs })
    }
    expect(s.phase).toBe('complete')
  })

  it('does not accept a stop before the required angle', () => {
    let s = readyToSpin()
    // 8 turns is over half, but under `minFraction * 10`.
    const { samples, endMs } = spin({
      totalDeg: 8 * 360,
      dps: 360,
      startMs: s.phaseStartedAtMs + 100
    })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    expect(hasEnoughAngle(s)).toBe(false)

    const last = samples[samples.length - 1].quat
    for (let atMs = endMs; atMs < endMs + 4000; atMs += 30) {
      s = reduceSensCal(s, { type: 'rotation', quat: last, atMs })
    }
    // Still spinning as far as the firmware is concerned — it will hang until
    // the timeout rather than accept an under-spun run.
    expect(s.phase).toBe('spinning')
  })

  it('cancels the stop dwell if the tracker moves again', () => {
    let s = readyToSpin()
    const { samples, endMs } = spin({
      totalDeg: 3600,
      dps: 360,
      startMs: s.phaseStartedAtMs + 100
    })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    const last = samples[samples.length - 1].quat
    let atMs = endMs
    while (s.phase !== 'stopping' && atMs < endMs + 3000) {
      atMs += 30
      s = reduceSensCal(s, { type: 'rotation', quat: last, atMs })
    }
    expect(s.phase).toBe('stopping')

    // Nudge it hard enough to clear the stop-rate threshold again.
    const nudged = spin({ totalDeg: 180, dps: 360, startMs: atMs, acc: s.acc })
    for (const sample of nudged.samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    expect(s.phase).toBe('spinning')
  })

  it('times out a spin that never finishes, and blames the pace', () => {
    let s = readyToSpin()
    // Fast enough to count as spinning (over `startRateDps`), far too slow to
    // cover ten turns inside the 60 s budget.
    const { samples } = spin({
      totalDeg: 40 * 70,
      dps: 40,
      startMs: s.phaseStartedAtMs + 100,
      stepMs: 100
    })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('spin-timeout')
    expect(s.cause).toBe('too-slow')
  })

  it('blames off-axis motion when the run was tilted', () => {
    const acc = { ...emptyAccumulator(), totalDeg: 720, offAxisDeg: 400 }
    const s: SensCalState = { ...initialSensCalState(), acc }
    expect(offAxisLevel(s)).toBe('reject')
    expect(inferCause(s, 'spin-timeout')).toBe('off-axis')
  })

  it('abandons the run on abort', () => {
    const s = reduceSensCal(readyToSpin(), { type: 'abort', atMs: 9000 })
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('aborted')
  })
})

describe('pace guide and countdown', () => {
  it('asks for a pace that finishes inside the spin budget', () => {
    // The pace has to leave room for the careful edge-aligned stop.
    expect(SENS_CAL.paceSecondsPerTurn * SENS_CAL.revolutions * 1000).toBeLessThan(
      SENS_CAL.spinTimeoutMs
    )
  })

  it('advances the target turn count with the clock', () => {
    const s: SensCalState = {
      ...initialSensCalState(),
      phase: 'spinning',
      spinStartedAtMs: 1000,
      nowMs: 1000 + SENS_CAL.paceSecondsPerTurn * 4 * 1000
    }
    expect(paceTurns(s)).toBeCloseTo(4, 6)
  })

  it('never asks for more than the requested revolutions', () => {
    const s: SensCalState = {
      ...initialSensCalState(),
      phase: 'spinning',
      spinStartedAtMs: 0,
      nowMs: 10 * 60 * 1000
    }
    expect(paceTurns(s)).toBe(s.revolutions)
  })

  it('counts down the spin budget and turns urgent near the end', () => {
    const base: SensCalState = {
      ...initialSensCalState(),
      phase: 'spinning',
      spinStartedAtMs: 0
    }
    expect(secondsLeft({ ...base, nowMs: 0 })).toBeCloseTo(SENS_CAL.spinTimeoutMs / 1000, 6)
    expect(isUrgent({ ...base, nowMs: 10000 })).toBe(false)
    expect(
      isUrgent({ ...base, nowMs: SENS_CAL.spinTimeoutMs - SENS_CAL.urgentSecondsLeft * 1000 })
    ).toBe(true)
    expect(secondsLeft({ ...base, nowMs: SENS_CAL.spinTimeoutMs + 5000 })).toBe(0)
  })
})

describe('verifySpin', () => {
  it('passes a spin that matches the truth', () => {
    const { acc } = spin({ totalDeg: 3600, dps: 360 })
    const result = verifySpin(acc, 10)
    expect(result.pass).toBe(true)
    expect(Math.abs(result.degPerTurn)).toBeLessThan(SENS_CAL.verifyPassDegPerTurn)
    expect(result.impliedScale).toBeCloseTo(1, 3)
  })

  it('fails a spin with a residual over the threshold, and reports deg/turn', () => {
    // 1% long over 10 turns = 36° of residual = 3.6°/turn.
    const acc = { ...emptyAccumulator(), totalDeg: 3600 * 1.01 }
    const result = verifySpin(acc, 10)
    expect(result.degPerTurn).toBeCloseTo(3.6, 6)
    expect(result.pass).toBe(false)
    expect(result.withinClamp).toBe(true)
  })

  it('treats a miscounted spin as out of clamp, not as a tiny error', () => {
    // Eight turns measured against ten expected: the user lost count.
    const result = verifySpin({ ...emptyAccumulator(), totalDeg: 8 * 360 }, 10)
    expect(result.withinClamp).toBe(false)
    expect(result.pass).toBe(false)
  })

  it('ignores the spin direction', () => {
    const result = verifySpin({ ...emptyAccumulator(), totalDeg: -3600 }, 10)
    expect(result.pass).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Firmware report (Phase 1b, Task F3)
// ---------------------------------------------------------------------------

import { SENS_CAL_PHASE, SENS_CAL_RESULT } from '../src/shared/config'
import {
  awaitingVerdict,
  firmwareScale,
  firmwareTurns,
  parseSensCalReport,
  prepareSensCal,
  reportFresh
} from '../src/shared/sens-cal'

/** The receiver's console echo of one report, log prefix included. */
function reportLine({
  slot = 0,
  phase,
  result = SENS_CAL_RESULT.none,
  axis = 2,
  seq = 0,
  scaleQ12 = 0,
  progress = 0
}: {
  slot?: number
  phase: number
  result?: number
  axis?: number
  seq?: number
  scaleQ12?: number
  progress?: number
}): string {
  return `[00:01:02.345,678] <inf> esb_event: Sens cal tracker ${slot}: phase ${phase} result ${result} axis ${axis} seq ${seq} scale ${scaleQ12} progress ${progress}`
}

function report(s: SensCalState, atMs: number, r: Parameters<typeof reportLine>[0]): SensCalState {
  return reduceSensCal(s, { type: 'console', line: reportLine(r), atMs })
}

describe('parseSensCalReport', () => {
  it('parses the receiver echo, prefix and all', () => {
    const r = parseSensCalReport(
      reportLine({ slot: 3, phase: 5, result: 1, axis: 0, seq: 7, scaleQ12: 4113, progress: 3598 })
    )
    expect(r).toEqual({
      slot: 3,
      phase: SENS_CAL_PHASE.done,
      result: SENS_CAL_RESULT.ok,
      axis: 'x',
      seq: 7,
      scale: 4113 / 4096,
      progressDeg: 3598
    })
  })

  it('reports no scale when the tracker sent zero', () => {
    expect(parseSensCalReport(reportLine({ phase: 4 }))?.scale).toBeUndefined()
  })

  it('ignores every other console line', () => {
    expect(parseSensCalReport(ACK)).toBeNull()
    expect(parseSensCalReport('Sens cal tracker 0: phase x')).toBeNull()
  })
})

describe('report-driven run', () => {
  const sent = (): SensCalState =>
    reduceSensCal(initialSensCalState(), {
      type: 'sent',
      axis: 'z',
      revolutions: 10,
      slot: 0,
      atMs: 0
    })

  it('follows the tracker through hold-still, armed, and recording', () => {
    let s = report(sent(), 100, { phase: SENS_CAL_PHASE.holdStill })
    expect(s.phase).toBe('bias')
    expect(reportFresh(s)).toBe(true)

    // Without the tracker saying so, the bias window would have expired by now.
    s = reduceSensCal(s, { type: 'tick', atMs: 100 + SENS_CAL.biasWindowMs + 500 })
    expect(s.phase).toBe('bias')

    s = report(s, 2000, { phase: SENS_CAL_PHASE.armed })
    expect(s.phase).toBe('ready-to-spin')

    s = report(s, 2500, { phase: SENS_CAL_PHASE.recording, progress: 40 })
    expect(s.phase).toBe('spinning')
    expect(s.spinStartedAtMs).toBe(2500)
    expect(firmwareTurns(s)).toBeCloseTo(40 / 360)
  })

  it('stands in for the receiver ack', () => {
    const s = report(sent(), ACK_TIMEOUT_MS + 1000, { phase: SENS_CAL_PHASE.holdStill })
    expect(s.phase).toBe('bias')
  })

  it('never drags the machine backwards', () => {
    let s = report(sent(), 100, { phase: SENS_CAL_PHASE.armed })
    const { samples } = spin({ totalDeg: 360, dps: 360, startMs: 200 })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    expect(s.phase).toBe('spinning')
    const started = s.spinStartedAtMs
    // The 2 Hz report is still on "armed" — it must not restart the spin.
    s = report(s, 600, { phase: SENS_CAL_PHASE.armed })
    expect(s.phase).toBe('spinning')
    expect(s.spinStartedAtMs).toBe(started)
    expect(turnsCompleted(s)).toBeGreaterThan(0.9)
  })

  it('waits for the verdict instead of completing on its own dwell', () => {
    let s = report(sent(), 100, { phase: SENS_CAL_PHASE.recording })
    const { samples, endMs } = spin({ totalDeg: 3600, dps: 360, startMs: 200 })
    for (const sample of samples) {
      s = reduceSensCal(s, { type: 'rotation', quat: sample.quat, atMs: sample.atMs })
    }
    const last = samples[samples.length - 1].quat
    let atMs = endMs
    while (atMs < endMs + 4000) {
      atMs += 30
      s = reduceSensCal(s, { type: 'rotation', quat: last, atMs })
      if (atMs % 500 < 30) s = report(s, atMs, { phase: SENS_CAL_PHASE.recording, progress: 3600 })
    }
    expect(s.phase).toBe('stopping')
    expect(awaitingVerdict(s)).toBe(true)

    s = report(s, atMs, {
      phase: SENS_CAL_PHASE.done,
      result: SENS_CAL_RESULT.ok,
      seq: 1,
      scaleQ12: 4113,
      progress: 3598
    })
    expect(s.phase).toBe('complete')
    expect(s.result).toBe(SENS_CAL_RESULT.ok)
    expect(firmwareScale(s)).toBeCloseTo(4113 / 4096)
  })

  it('lets a late rejection override a spin that looked fine', () => {
    let s = report(sent(), 100, { phase: SENS_CAL_PHASE.recording })
    s = report(s, 30000, {
      phase: SENS_CAL_PHASE.done,
      result: SENS_CAL_RESULT.offAxis,
      seq: 1,
      scaleQ12: 4100
    })
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('firmware')
    expect(s.result).toBe(SENS_CAL_RESULT.offAxis)
    expect(s.cause).toBe('off-axis')
    // The scale is still reported so the user can see how far off it was.
    expect(firmwareScale(s)).toBeCloseTo(4100 / 4096)
  })

  it('names a miscount when the scale was out of range', () => {
    const s = report(report(sent(), 100, { phase: SENS_CAL_PHASE.recording }), 200, {
      phase: SENS_CAL_PHASE.done,
      result: SENS_CAL_RESULT.scaleRange,
      seq: 1
    })
    expect(s.cause).toBe('miscount')
  })

  it('uses the tracker count for the stop criterion', () => {
    const s = report(report(sent(), 100, { phase: SENS_CAL_PHASE.recording }), 200, {
      phase: SENS_CAL_PHASE.recording,
      progress: 3300
    })
    expect(turnsCompleted(s)).toBe(0)
    expect(hasEnoughAngle(s)).toBe(true)
  })

  it('ignores reports from another slot', () => {
    const s = report(sent(), 100, { slot: 4, phase: SENS_CAL_PHASE.holdStill })
    expect(s.phase).toBe('sending')
    expect(s.report).toBeUndefined()
  })

  it('ignores the previous run lingering on the console', () => {
    // A verdict from the last run is still being repeated when the next one starts.
    const prev = report(report(sent(), 100, { phase: SENS_CAL_PHASE.recording }), 200, {
      phase: SENS_CAL_PHASE.done,
      result: SENS_CAL_RESULT.ok,
      seq: 3,
      scaleQ12: 4096
    })
    expect(prev.phase).toBe('complete')

    let s = reduceSensCal(prepareSensCal(prev, 'x'), {
      type: 'sent',
      axis: 'x',
      revolutions: 10,
      slot: 0,
      atMs: 1000
    })
    expect(s.staleDoneSeq).toBe(3)
    s = report(s, 1100, { phase: SENS_CAL_PHASE.done, result: SENS_CAL_RESULT.ok, seq: 3 })
    expect(s.phase).toBe('sending')

    // In-progress reports of the new run still carry the old seq — that is fine.
    s = report(s, 1600, { phase: SENS_CAL_PHASE.holdStill, seq: 3 })
    expect(s.phase).toBe('bias')
    // A fresh verdict has a new seq and applies.
    s = report(s, 2000, { phase: SENS_CAL_PHASE.done, result: SENS_CAL_RESULT.notStill, seq: 4 })
    expect(s.phase).toBe('failed')
    expect(s.cause).toBe('not-still')
  })

  it('falls back to its own timeouts when the report goes quiet', () => {
    let s = report(sent(), 100, { phase: SENS_CAL_PHASE.armed })
    expect(s.phase).toBe('ready-to-spin')
    // Reports keep coming: the local start timeout is not applied.
    let atMs = 100
    while (atMs < 100 + SENS_CAL.startTimeoutMs + 2000) {
      atMs += 500
      s = report(s, atMs, { phase: SENS_CAL_PHASE.armed })
    }
    expect(s.phase).toBe('ready-to-spin')

    // Silence: after the stale window the local clock rules again.
    s = reduceSensCal(s, { type: 'tick', atMs: atMs + SENS_CAL.reportStaleMs + 1 })
    expect(reportFresh(s)).toBe(false)
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('no-spin')
  })
})
