import { describe, it, expect } from 'vitest'
import {
  captureReference,
  pinHeading,
  placementMatches,
  readPlacement,
  trackerPose,
  trackerUp
} from '../src/shared/tracker-frame'
import { fromAxisAngle, multiply, normalize, yaw } from '../src/shared/quaternion'
import type { Quaternion } from '../src/shared/types'

/**
 * A stand-in for SlimeVR Server's rotation of a tracker whose IMU is mounted
 * some arbitrary way: `left · physical · right`, where `physical` is the
 * case's true rotation relative to "flat, button up" at heading `h`, `right`
 * is the (unknown) mounting/attachment fix, and `left` a server yaw fix.
 */
function feed(physical: Quaternion, h = 0): Quaternion {
  const left = yaw(23)
  const right = fromAxisAngle(normalize({ x: 0.3, y: -0.5, z: 0.8, w: 0 }), 113)
  return normalize(multiply(multiply(left, multiply(yaw(h), physical)), right))
}

/** Physical direction of the case's long side at heading `h`, horizontal. */
function longSide(h: number): { x: number; y: number; z: number } {
  const v = { x: 1, y: 0, z: 0 }
  const q = yaw(h)
  // Rotate by yaw(h) in the plane.
  const c = Math.cos((h * Math.PI) / 180)
  const s = Math.sin((h * Math.PI) / 180)
  void q
  return { x: v.x * c, y: 0, z: -v.x * s }
}

function shortSide(h: number): { x: number; y: number; z: number } {
  const c = Math.cos((h * Math.PI) / 180)
  const s = Math.sin((h * Math.PI) / 180)
  return { x: s, y: 0, z: c }
}

const IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

describe('tracker frame', () => {
  it('reads the reference pose as flat, whatever the mounting', () => {
    const frame = captureReference(feed(IDENTITY, 40))
    expect(readPlacement(frame, feed(IDENTITY, 40))).toBe('flat')
    const up = trackerUp(trackerPose(frame, feed(IDENTITY, 40)))
    expect(up.y).toBeCloseTo(1, 6)
  })

  it('reads the tracker flipped over as flat but inverted', () => {
    const h = 40
    const frame = captureReference(feed(IDENTITY, h))
    const flipped = fromAxisAngle(longSide(h), 180)
    expect(readPlacement(frame, feed(flipped, 0))).toBe('flat-inverted')
  })

  it('reads an edge as just an edge until the heading is pinned', () => {
    const h = 40
    const frame = captureReference(feed(IDENTITY, h))
    const onLongEdge = fromAxisAngle(longSide(h), 90)
    expect(readPlacement(frame, feed(onLongEdge, 0))).toBe('edge')
    expect(placementMatches('edge', 'long-edge')).toBe(true)
    expect(placementMatches('edge', 'short-edge')).toBe(false)
  })

  it('reads a half-tipped tracker as tilted', () => {
    const h = 40
    const frame = captureReference(feed(IDENTITY, h))
    const halfway = fromAxisAngle(longSide(h), 45)
    expect(readPlacement(frame, feed(halfway, 0))).toBe('tilted')
  })

  it('pins the heading from the long edge and then tells the edges apart', () => {
    const h = 40
    let frame = captureReference(feed(IDENTITY, h))
    const onLongEdge = feed(fromAxisAngle(longSide(h), 90), 0)
    frame = pinHeading(frame, onLongEdge)
    expect(frame.headingPinned).toBe(true)

    // The vertical direction is now the tracker's Z (short side)...
    const up = trackerUp(trackerPose(frame, onLongEdge))
    expect(Math.abs(up.z)).toBeCloseTo(1, 6)
    expect(readPlacement(frame, onLongEdge)).toBe('long-edge')

    // ...so standing it on the short edge makes X vertical.
    const onShortEdge = feed(fromAxisAngle(shortSide(h), 90), 0)
    const upShort = trackerUp(trackerPose(frame, onShortEdge))
    expect(Math.abs(upShort.x)).toBeCloseTo(1, 6)
    expect(readPlacement(frame, onShortEdge)).toBe('short-edge')

    // And flat still reads as flat — the pin is a pure heading change.
    expect(readPlacement(frame, feed(IDENTITY, h))).toBe('flat')
  })

  it('tolerates a slightly unlevel placement', () => {
    const frame = captureReference(feed(IDENTITY, 0))
    const nearlyFlat = fromAxisAngle(longSide(0), 8)
    expect(readPlacement(frame, feed(nearlyFlat, 0))).toBe('flat')
    const nearlyEdge = fromAxisAngle(longSide(0), 82)
    expect(readPlacement(frame, feed(nearlyEdge, 0))).toBe('edge')
  })

  it('leaves the frame alone if asked to pin from a flat pose', () => {
    const frame = captureReference(feed(IDENTITY, 0))
    const same = pinHeading(frame, feed(IDENTITY, 0))
    expect(same.headingPinned).toBe(false)
  })
})
