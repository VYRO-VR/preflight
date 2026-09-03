// The tracker's *physical* reference frame, recovered from a single pose.
//
// SlimeVR Server's rotation for a tracker is not the IMU's own orientation:
// the server left-multiplies yaw fixes (yaw reset, full reset's gyro fix) and
// right-multiplies a full 3D attachment fix plus the mounting orientation.
// Which of those are in effect depends on what the user has done in SlimeVR
// this session, so nothing in the feed says which way the physical case is
// facing — which is why the preview and the physical tracker disagreed.
//
// The fix is a reference pose. With the tracker laid flat, button up, we
// capture its rotation `R_ref` and thereafter show `P = R · R_ref⁻¹`. The
// server's right-multiplied fixes cancel exactly, and its left-multiplied
// fixes are pure yaws, which only change the heading. So `P` is the tracker's
// rotation relative to "flat, button up" in a world frame whose up really is
// gravity, whatever SlimeVR has been told about the tracker.
//
// One degree of freedom remains: the heading the tracker had when the
// reference was captured. It is pinned the first time the tracker is stood on
// its long edge — that pose tells us which horizontal direction the short
// side runs — after which the model's long and short sides match the case.
//
// Frame convention used by the preview model and the placements below:
// tracker X runs along the long side, Y is the button-face normal (up when
// flat), Z runs along the short side.

import { SENS_CAL } from './config'
import type { Quaternion, SensCalPlacement } from './types'
import {
  DEG_TO_RAD,
  RAD_TO_DEG,
  WORLD_UP,
  conjugate,
  multiply,
  normalize,
  rotateVector,
  yaw,
  type Vec3
} from './quaternion'

export interface TrackerFrame {
  /** Right-multiplied correction: tracker pose = feed rotation · fix. */
  fix: Quaternion
  /** Whether the heading has been pinned from an edge placement yet. */
  headingPinned: boolean
}

/** What the feed says the tracker is doing, relative to the reference. */
export type PlacementReading =
  | 'flat'
  /** Flat, but the button face is down. */
  | 'flat-inverted'
  | 'long-edge'
  | 'short-edge'
  /** Stood on some edge; which one is unknown until the heading is pinned. */
  | 'edge'
  | 'tilted'

/** Capture the reference: the tracker is flat with the button facing up now. */
export function captureReference(rotation: Quaternion): TrackerFrame {
  return { fix: conjugate(normalize(rotation)), headingPinned: false }
}

/** The tracker's pose relative to the reference. */
export function trackerPose(frame: TrackerFrame, rotation: Quaternion): Quaternion {
  return multiply(rotation, frame.fix)
}

/** World up expressed in the tracker's own frame — which side is facing up. */
export function trackerUp(pose: Quaternion): Vec3 {
  return rotateVector(conjugate(pose), WORLD_UP)
}

/**
 * Classify the current pose. `toleranceDeg` is how far from exactly flat or
 * exactly vertical still counts — a desk is level and a book is square, so
 * the tolerance only has to absorb feed noise and the case's rounded edges.
 */
export function readPlacement(
  frame: TrackerFrame,
  rotation: Quaternion,
  toleranceDeg: number = SENS_CAL.placementToleranceDeg
): PlacementReading {
  const u = trackerUp(trackerPose(frame, rotation))
  const cos = Math.cos(toleranceDeg * DEG_TO_RAD)
  const sin = Math.sin(toleranceDeg * DEG_TO_RAD)

  if (u.y >= cos) return 'flat'
  if (u.y <= -cos) return 'flat-inverted'
  if (Math.abs(u.y) > sin) return 'tilted'
  if (!frame.headingPinned) return 'edge'
  if (Math.abs(u.z) >= cos) return 'long-edge'
  if (Math.abs(u.x) >= cos) return 'short-edge'
  return 'edge'
}

/**
 * Whether a reading satisfies the placement a calibration step asks for.
 * Before the heading is pinned, any edge counts as the long edge — that is
 * the pose the heading gets pinned from, so the user is trusted to have
 * followed the instruction; after it, the short edge is checked for real.
 */
export function placementMatches(reading: PlacementReading, wanted: SensCalPlacement): boolean {
  switch (wanted) {
    case 'flat':
      return reading === 'flat'
    case 'long-edge':
      return reading === 'long-edge' || reading === 'edge'
    case 'short-edge':
      return reading === 'short-edge'
  }
}

/**
 * Pin the heading from a pose in which the tracker is stood on its long edge.
 * The direction that is now vertical is the short side, so the frame is
 * yawed until that direction lands on tracker Z. Returns the frame unchanged
 * if the tracker is not actually on an edge.
 */
export function pinHeading(frame: TrackerFrame, rotation: Quaternion): TrackerFrame {
  const u = trackerUp(trackerPose(frame, rotation))
  const horizontal = Math.hypot(u.x, u.z)
  if (horizontal < 1e-6) return frame
  // Angle of the vertical direction in the tracker's horizontal plane,
  // measured from +Z toward +X; a yaw of the fix by that angle moves it
  // onto +Z.
  const phiDeg = Math.atan2(u.x, u.z) * RAD_TO_DEG
  return { fix: normalize(multiply(frame.fix, yaw(phiDeg))), headingPinned: true }
}
