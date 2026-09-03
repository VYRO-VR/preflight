import { describe, it, expect } from 'vitest'
import { RECEIVER_CONSOLE, SENS_CAL } from '../src/shared/config'
import {
  ACK_TIMEOUT_MS,
  correctionDegrees,
  emptyAccumulator,
  emptyCorrections,
  formatSensValue,
  initialSendState,
  isStill,
  measureSpin,
  offAxisLevel,
  offAxisRatio,
  pushRotation,
  reduceSend,
  rotationDelta,
  scaleFromCorrection,
  sensSetValues,
  turnsMeasured,
  verifySpin,
  type SendEvent,
  type SendState,
  type TurnAccumulator
} from '../src/shared/sens-cal'
import { fromAxisAngle, multiply, yaw } from '../src/shared/quaternion'
import type { Quaternion } from '../src/shared/types'

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
  startDeg = 0,
  tiltDeg = 0,
  acc = emptyAccumulator()
}: {
  totalDeg: number
  dps: number
  stepMs?: number
  startMs?: number
  /** Yaw the spin starts from, when it continues an earlier one. */
  startDeg?: number
  tiltDeg?: number
  acc?: TurnAccumulator
}): { acc: TurnAccumulator; endMs: number; samples: { quat: Quaternion; atMs: number }[] } {
  const tilt = fromAxisAngle({ x: 1, y: 0, z: 0 }, tiltDeg)
  const samples: { quat: Quaternion; atMs: number }[] = []
  const durationMs = (Math.abs(totalDeg) / dps) * 1000
  let out = acc
  // Always land the last sample exactly on the end of the spin, so the fixture
  // delivers the full angle rather than one step short of it.
  for (let ms = 0; ms <= durationMs; ms = Math.min(ms + stepMs, durationMs)) {
    const progressed = (ms / durationMs) * totalDeg
    const quat = multiply(yaw(startDeg + progressed), tilt)
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
    const x = { x: 1, y: 0, z: 0 }
    const d = rotationDelta(fromAxisAngle(x, 0), fromAxisAngle(x, 8), 30)
    expect(d.aboutUpDeg).toBeCloseTo(0, 6)
    expect(d.offAxisDeg).toBeCloseTo(8, 6)
  })
})

describe('turn accumulator', () => {
  it('counts ten turns of a flat spin', () => {
    const { acc } = spin({ totalDeg: 3600, dps: 360 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
    expect(offAxisRatio(acc)).toBeCloseTo(0, 4)
    expect(acc.gaps).toBe(0)
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

  it('is unaffected by a constant server-side fix on either side', () => {
    // SlimeVR's yaw resets left-multiply a yaw; its attachment/mounting fixes
    // right-multiply an arbitrary rotation. Neither may change the count.
    const left = yaw(37)
    const right = fromAxisAngle({ x: 0.6, y: 0.48, z: 0.64 }, 71)
    let acc = emptyAccumulator()
    for (const { quat, atMs } of spin({ totalDeg: 3600, dps: 360 }).samples) {
      acc = pushRotation(acc, multiply(multiply(left, quat), right), atMs)
    }
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
    expect(offAxisRatio(acc)).toBeCloseTo(0, 4)
  })

  it('tracks the spin rate and total motion rate', () => {
    const { acc } = spin({ totalDeg: 1080, dps: 360 })
    expect(acc.rateDps).toBeGreaterThan(300)
    expect(acc.rateDps).toBeLessThan(400)
    expect(acc.motionDps).toBeGreaterThan(300)
    expect(isStill(acc)).toBe(false)
  })

  it('reads as still when the pose stops changing', () => {
    let { acc } = spin({ totalDeg: 360, dps: 360 })
    const last = acc.lastQuat!
    let atMs = acc.lastAtMs!
    for (let i = 0; i < 40; i++) acc = pushRotation(acc, last, (atMs += 30))
    expect(isStill(acc)).toBe(true)
  })

  it('flags wobble as off-axis motion', () => {
    let acc = emptyAccumulator()
    let atMs = 0
    // Alternate a yaw step with a tilt step: half the motion is off-axis.
    for (let i = 0; i < 20; i++) {
      const tilt = fromAxisAngle({ x: 1, y: 0, z: 0 }, i % 2 === 0 ? 0 : 6)
      acc = pushRotation(acc, multiply(yaw(i * 6), tilt), (atMs += 30))
    }
    expect(offAxisRatio(acc)).toBeGreaterThan(SENS_CAL.offAxisWarnRatio)
    expect(offAxisLevel(acc)).not.toBe('ok')
  })

  it('re-seeds instead of integrating across a feed stall, and counts the gap', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(170), 5000) // a 5 s gap: the feed dropped out
    expect(acc.totalDeg).toBe(0)
    expect(acc.rateDps).toBe(0)
    expect(acc.gaps).toBe(1)
  })

  it('re-seeds on an early gap long enough for a spin to alias', () => {
    // Before the rate is primed there is nothing to predict from: 300 ms is
    // short enough to look like a live sample, but a fast spin can cover more
    // than 180° in it — and past 180° a step reads as the shorter rotation
    // the other way, silently subtracting turns from the count.
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(216), 300)
    expect(acc.totalDeg).toBe(0)
    expect(acc.gaps).toBe(1)
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
    expect(acc.gaps).toBe(0)
  })

  it('keeps counting from the new reference after a re-seed', () => {
    let acc = pushRotation(emptyAccumulator(), yaw(0), 0)
    acc = pushRotation(acc, yaw(216), 300) // dropped samples: re-seeds here
    acc = pushRotation(acc, yaw(246), 330)
    expect(acc.totalDeg).toBeCloseTo(30, 6)
  })

  it('ignores a repeated notification at the same instant', () => {
    let { acc } = spin({ totalDeg: 360, dps: 360 })
    const before = acc
    acc = pushRotation(acc, acc.lastQuat!, acc.lastAtMs!)
    expect(acc).toBe(before)
    expect(acc.gaps).toBe(0)
  })

  it('bridges a mid-spin stall by predicting the rotation from the spin rate', () => {
    // 1 turn/s, then the feed goes quiet for 700 ms while the spin carries on:
    // 252° of real rotation, which the shortest arc would read as -108°.
    const { acc: spun, endMs } = spin({ totalDeg: 1080, dps: 360 })
    const acc = pushRotation(spun, yaw(1080 + 252), endMs + 700)
    expect(acc.totalDeg).toBeCloseTo(1332, 3)
    expect(acc.gaps).toBe(0)
    // And the count carries on correctly afterwards.
    const rest = spin({
      totalDeg: 3600 - 1332,
      dps: 360,
      startMs: endMs + 730,
      startDeg: 1332,
      acc
    })
    expect(turnsMeasured(rest.acc)).toBeCloseTo(10, 2)
    expect(rest.acc.gaps).toBe(0)
  })

  it('bridges a stall of more than a whole turn when the rate predicts it', () => {
    const { acc: spun, endMs } = spin({ totalDeg: 1080, dps: 360 })
    const acc = pushRotation(spun, yaw(1080 + 400), endMs + 1100) // 400° in 1.1 s
    expect(acc.totalDeg).toBeCloseTo(1480, 3)
    expect(acc.gaps).toBe(0)
  })

  it('gives up on a stall too long to bridge', () => {
    const { acc: spun, endMs } = spin({ totalDeg: 1080, dps: 360 })
    const acc = pushRotation(spun, yaw(1080 + 100), endMs + 2000)
    expect(acc.gaps).toBe(1)
    expect(acc.totalDeg).toBeCloseTo(1080, 3)
  })

  it('does not count a stall at rest as a gap', () => {
    let { acc } = spin({ totalDeg: 360, dps: 360 })
    const last = acc.lastQuat!
    let atMs = acc.lastAtMs!
    for (let i = 0; i < 40; i++) acc = pushRotation(acc, last, (atMs += 30))
    expect(isStill(acc)).toBe(true)
    acc = pushRotation(acc, last, atMs + 5000) // the tracker dozed off
    expect(acc.gaps).toBe(0)
    expect(acc.totalDeg).toBeCloseTo(360, 3)
  })

  it('counts a stall at rest as a gap if the tracker moved meanwhile', () => {
    let { acc } = spin({ totalDeg: 360, dps: 360 })
    const last = acc.lastQuat!
    let atMs = acc.lastAtMs!
    for (let i = 0; i < 40; i++) acc = pushRotation(acc, last, (atMs += 30))
    acc = pushRotation(acc, yaw(360 + 150), atMs + 5000)
    expect(acc.gaps).toBe(1)
  })

  it('rejects a jump the spin cannot explain, such as a reset in SlimeVR', () => {
    const { acc: spun, endMs } = spin({ totalDeg: 1080, dps: 360 })
    // Expected ~11° in 30 ms; a 170° jump is neither that nor a whole turn off.
    const acc = pushRotation(spun, yaw(1080 + 170), endMs + 30)
    expect(acc.gaps).toBe(1)
    expect(acc.totalDeg).toBeCloseTo(1080, 3)
  })

  it('keeps counting at the idle feed rate, in case the rate change is lost', () => {
    const { acc } = spin({ totalDeg: 3600, dps: 360, stepMs: 200 })
    expect(turnsMeasured(acc)).toBeCloseTo(10, 2)
    expect(acc.gaps).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Measurement → firmware value
// ---------------------------------------------------------------------------

describe('correctionDegrees', () => {
  const rev = SENS_CAL.firmwareRevolutions

  it('is zero for a gyro that reads the truth', () => {
    expect(correctionDegrees(3600, 10)).toBeCloseTo(0, 9)
  })

  it('asks the firmware for a scale that cancels the measured error', () => {
    // A gyro reading 1% low: the firmware must multiply by 1/0.99.
    const deg = correctionDegrees(3600 * 0.99, 10)
    expect(deg).toBeCloseTo(0.01 * 360 * rev, 6)
    expect(scaleFromCorrection(deg)).toBeCloseTo(1 / 0.99, 9)
  })

  it('goes negative for a gyro that reads high', () => {
    const deg = correctionDegrees(3600 * 1.02, 10)
    expect(deg).toBeLessThan(0)
    expect(scaleFromCorrection(deg)).toBeCloseTo(1 / 1.02, 9)
  })

  it('is expressed over the firmware turn count, not the spin turn count', () => {
    // Same gyro, twice the turns spun: the value must not change.
    expect(correctionDegrees(3600 * 0.995, 10)).toBeCloseTo(correctionDegrees(7200 * 0.995, 20), 9)
  })
})

describe('measureSpin', () => {
  it('accepts a clean ten-turn spin', () => {
    const { acc } = spin({ totalDeg: 3600 * 0.996, dps: 360 })
    const m = measureSpin(acc, 10)
    expect(m.verdict).toBe('ok')
    expect(m.impliedScale).toBeCloseTo(0.996, 3)
    expect(m.errorDegPerTurn).toBeCloseTo(-1.44, 1)
    expect(m.correctionDeg).toBeCloseTo(correctionDegrees(3600 * 0.996, 10), 3)
  })

  it('refuses a spin the feed dropped out of', () => {
    let { acc } = spin({ totalDeg: 1800, dps: 360 })
    acc = pushRotation(acc, acc.lastQuat!, acc.lastAtMs! + 2000) // stall
    const rest = spin({ totalDeg: 1800, dps: 360, startMs: acc.lastAtMs! + 30, acc })
    const m = measureSpin(rest.acc, 10)
    expect(m.gaps).toBe(1)
    expect(m.verdict).toBe('gaps')
  })

  it('refuses a miscounted spin rather than sending a huge correction', () => {
    // Eight turns against ten expected is a 20% "error": no gyro is that bad.
    const m = measureSpin({ ...emptyAccumulator(), totalDeg: 8 * 360 }, 10)
    expect(m.withinClamp).toBe(false)
    expect(m.verdict).toBe('miscount')
  })

  it('rejects a half-turn miscount over ten turns', () => {
    for (const turns of [9.5, 10.5]) {
      expect(measureSpin({ ...emptyAccumulator(), totalDeg: turns * 360 }, 10).verdict).toBe(
        'miscount'
      )
    }
  })

  it('never produces a value the receiver cannot carry inside the clamp', () => {
    for (const scale of [SENS_CAL.minScale, SENS_CAL.maxScale]) {
      const m = measureSpin({ ...emptyAccumulator(), totalDeg: 3600 * scale }, 10)
      expect(Math.abs(m.correctionDeg)).toBeLessThanOrEqual(SENS_CAL.maxValueDeg)
    }
  })
})

describe('correction triple', () => {
  it('sends 0 for axes that have not been calibrated', () => {
    expect(sensSetValues(emptyCorrections())).toEqual([0, 0, 0])
  })

  it('places each axis in x,y,z order', () => {
    expect(sensSetValues({ x: 1.5, y: null, z: -2 })).toEqual([1.5, 0, -2])
  })

  it('can zero one axis on the wire without forgetting it', () => {
    const corrections = { x: 1.5, y: 0.5, z: -2 }
    expect(sensSetValues(corrections, 'z')).toEqual([1.5, 0.5, 0])
    expect(corrections.z).toBe(-2)
  })

  it('formats values the way the receiver echoes them', () => {
    expect(formatSensValue(1.234)).toBe('1.23')
    expect(formatSensValue(-0.001)).toBe('0.00')
    expect(formatSensValue(0)).toBe('0.00')
    expect(formatSensValue(1000)).toBe(String(SENS_CAL.maxValueDeg.toFixed(2)))
  })

  it('builds the command the receiver documents', () => {
    expect(RECEIVER_CONSOLE.sensSetCmd(3, ['1.20', '-0.40', '0.00'])).toBe(
      'send 3 sens 1.20,-0.40,0.00\n'
    )
  })
})

// ---------------------------------------------------------------------------
// Send / ack fold
// ---------------------------------------------------------------------------

function run(events: SendEvent[], from: SendState = initialSendState()): SendState {
  return events.reduce(reduceSend, from)
}

const SENT: SendEvent = { type: 'sent', slot: 2, values: [1.2, -0.4, 0], atMs: 0 }

describe('send fold', () => {
  it('starts idle and moves to sending on write', () => {
    expect(initialSendState().phase).toBe('idle')
    expect(run([SENT]).phase).toBe('sending')
  })

  it('accepts the receiver ack for the same slot and values', () => {
    const s = run([
      SENT,
      { type: 'console', line: 'Sens set (1.20,-0.40,0.00) request sent to tracker 2', atMs: 40 }
    ])
    expect(s.phase).toBe('acked')
  })

  it('ignores an ack for another slot or other values', () => {
    expect(
      run([
        SENT,
        { type: 'console', line: 'Sens set (1.20,-0.40,0.00) request sent to tracker 1', atMs: 40 }
      ]).phase
    ).toBe('sending')
    expect(
      run([
        SENT,
        { type: 'console', line: 'Sens set (0.00,0.00,0.00) request sent to tracker 2', atMs: 40 }
      ]).phase
    ).toBe('sending')
  })

  it('ignores the echoed command line', () => {
    const s = run([SENT, { type: 'console', line: 'send 2 sens 1.20,-0.40,0.00', atMs: 10 }])
    expect(s.phase).toBe('sending')
  })

  it('fails on a rejection', () => {
    const s = run([SENT, { type: 'console', line: 'Invalid float value: abc', atMs: 20 }])
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('rejected')
  })

  it('fails when the receiver never acks', () => {
    const s = run([SENT, { type: 'tick', atMs: ACK_TIMEOUT_MS + 1 }])
    expect(s.phase).toBe('failed')
    expect(s.failure).toBe('no-ack')
  })

  it('does not read console lines when nothing is in flight', () => {
    const s = run([
      { type: 'console', line: 'Sens set (1.20,-0.40,0.00) request sent to tracker 2', atMs: 40 }
    ])
    expect(s.phase).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// Verification spin
// ---------------------------------------------------------------------------

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

  it('does not pass a spin the feed dropped out of', () => {
    const result = verifySpin({ ...emptyAccumulator(), totalDeg: 3600, gaps: 1 }, 10)
    expect(result.pass).toBe(false)
  })

  it('ignores the spin direction', () => {
    const result = verifySpin({ ...emptyAccumulator(), totalDeg: -3600 }, 10)
    expect(result.pass).toBe(true)
  })
})
