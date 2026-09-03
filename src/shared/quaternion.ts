// Quaternion helpers shared by the sensitivity-calibration maths and the
// tracker reference frame. Pure functions on the `{x, y, z, w}` shape SlimeVR
// Server reports; nothing here knows about three.js.

import type { Quaternion } from './types'

export const RAD_TO_DEG = 180 / Math.PI
export const DEG_TO_RAD = Math.PI / 180

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 }

/** World up in SlimeVR Server's frame (Y-up). */
export const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 }

export function conjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
}

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  }
}

export function normalize(q: Quaternion): Quaternion {
  const n = Math.hypot(q.x, q.y, q.z, q.w)
  if (n < 1e-12) return IDENTITY
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n }
}

/** Rotation of `deg` degrees about a unit axis. */
export function fromAxisAngle(axis: Vec3, deg: number): Quaternion {
  const half = (deg * DEG_TO_RAD) / 2
  const s = Math.sin(half)
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) }
}

/** Rotation of `deg` degrees about world up (a yaw). */
export function yaw(deg: number): Quaternion {
  return fromAxisAngle(WORLD_UP, deg)
}

/** Rotate a vector by a quaternion: `q · v · q⁻¹`. */
export function rotateVector(q: Quaternion, v: Vec3): Vec3 {
  const p: Quaternion = { x: v.x, y: v.y, z: v.z, w: 0 }
  const r = multiply(multiply(q, p), conjugate(q))
  return { x: r.x, y: r.y, z: r.z }
}

/** Angle of the rotation a quaternion represents, in degrees, always ≥ 0. */
export function angleDeg(q: Quaternion): number {
  const sin = Math.hypot(q.x, q.y, q.z)
  const w = q.w < 0 ? -q.w : q.w
  return 2 * Math.atan2(sin, w) * RAD_TO_DEG
}
