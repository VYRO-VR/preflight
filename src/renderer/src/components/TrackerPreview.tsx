import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight,
  ArrowHelper,
  BoxGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SpotLight,
  Vector3,
  WebGLRenderer
} from 'three'
import type { Quaternion as QuatObject } from '@shared/types'

/**
 * Live 3D orientation preview for one tracker.
 *
 * Derived from SlimeVR-Server's `IMUVisualizerWidget` (gui/src/components/
 * widgets/IMUVisualizerWidget.tsx), MIT licensed — Copyright (c) SlimeVR
 * contributors. The scene layout (camera, lights, wireframe ground plane, RAF
 * render loop) and, importantly, the quaternion handling follow it: a SlimeVR
 * rotation is applied to the model group component-for-component,
 * `group.quaternion.set(x, y, z, w)`, with no axis swap or sign flip. The
 * upstream widget carries its correction on the *model* instead
 * (`modelGroup.rotation.x = π/2`, to stand a Z-up GLTF up in three.js's Y-up
 * world); this file does the same to its box.
 *
 * The upstream widget draws a GLTF tracker model plus accel/mag arrows. This
 * one draws a primitive box with body-axis arrows so the flows that need an
 * identity check are not blocked on a VYRO model — swap the box for a GLTF
 * behind this same component API when the asset lands.
 */

const CANVAS_HEIGHT = 200
const GROUND_COLOR = '#4444aa'

/** Body axis of the tracker, matching the firmware's `sens auto <x|y|z>`. */
export type TrackerAxis = 'x' | 'y' | 'z'

/** Unit vectors for the tracker's own axes, in the model's local frame. */
const AXIS_VECTORS: Record<TrackerAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1)
}

const AXIS_COLORS: Record<TrackerAxis, number> = {
  x: 0xff5f6d,
  y: 0x5fe08b,
  z: 0x6aa8ff
}

interface PreviewContext {
  /** Apply a new orientation. Cheap: no scene rebuild. */
  update: (quat: QuatObject) => void
  /** Highlight one body axis (the axis a calibration spin is about). */
  setHighlight: (axis: TrackerAxis | null) => void
  /** Cancel the RAF loop and release the WebGL context. */
  dispose: () => void
}

function createPreview(canvas: HTMLCanvasElement): PreviewContext {
  const scene = new Scene()

  const width = canvas.clientWidth || 320
  const camera = new PerspectiveCamera(60, width / CANVAS_HEIGHT, 0.1, 1000)
  camera.position.set(4.5, 3, 7)
  camera.lookAt(0, 0, 0)

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(width, CANVAS_HEIGHT, false)

  scene.add(new AmbientLight(0xffffff, 1.6))
  const spot = new SpotLight(0xffffff, 900)
  spot.position.set(12, 18, 14)
  spot.angle = 0.5
  spot.penumbra = 1
  scene.add(spot)

  // The tracker group carries the reported orientation.
  const trackerGroup = new Group()
  scene.add(trackerGroup)

  // A stand-in for the tracker body: a flat slab, wider than it is tall, with
  // a highlighted top face so "flat on the desk" vs "on edge" reads at a
  // glance. `rotation.x = π/2` mirrors the upstream widget's model
  // correction — the box is modelled Z-up, three.js is Y-up.
  const modelGroup = new Group()
  modelGroup.rotation.x = Math.PI / 2
  trackerGroup.add(modelGroup)

  const bodyGeometry = new BoxGeometry(2.6, 2.0, 0.7)
  const bodyMaterial = new MeshStandardMaterial({
    color: 0x2b3348,
    roughness: 0.55,
    metalness: 0.1
  })
  const body = new Mesh(bodyGeometry, bodyMaterial)
  modelGroup.add(body)

  const edgeGeometry = new EdgesGeometry(bodyGeometry)
  const edgeMaterial = new LineBasicMaterial({ color: 0x8aa0c8 })
  modelGroup.add(new LineSegments(edgeGeometry, edgeMaterial))

  // A marker on the +Z face so rotation about Z is visible, not just implied.
  const faceGeometry = new PlaneGeometry(1.1, 0.35)
  const faceMaterial = new MeshBasicMaterial({ color: 0x7c5cff, side: DoubleSide })
  const face = new Mesh(faceGeometry, faceMaterial)
  face.position.set(0, 0.55, 0.36)
  modelGroup.add(face)

  // Body-axis arrows, drawn in the tracker's own frame so they turn with it.
  const arrows: Record<TrackerAxis, ArrowHelper> = {
    x: new ArrowHelper(AXIS_VECTORS.x, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.x),
    y: new ArrowHelper(AXIS_VECTORS.y, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.y),
    z: new ArrowHelper(AXIS_VECTORS.z, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.z)
  }
  for (const arrow of Object.values(arrows)) modelGroup.add(arrow)

  // Wireframe ground, so the tracker's tilt has something to be tilted against.
  const groundGeometry = new PlaneGeometry(30, 30, 12, 12)
  const groundMaterial = new MeshBasicMaterial({
    wireframe: true,
    color: new Color(GROUND_COLOR),
    transparent: true,
    opacity: 0.18,
    side: DoubleSide
  })
  const ground = new Mesh(groundGeometry, groundMaterial)
  ground.position.set(0, -2.6, 0)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  let animationId: number | null = null
  const animate = (): void => {
    animationId = requestAnimationFrame(animate)
    // Keep the drawing buffer matched to the element as the window resizes.
    const w = canvas.clientWidth
    if (w > 0 && Math.abs(renderer.domElement.width / window.devicePixelRatio - w) > 1) {
      renderer.setSize(w, CANVAS_HEIGHT, false)
      camera.aspect = w / CANVAS_HEIGHT
      camera.updateProjectionMatrix()
    }
    renderer.render(scene, camera)
  }
  animate()

  // Smoothed so a 30 ms feed does not look like a slideshow; the preview is a
  // confidence check, never a measurement (the turn counter reads the raw feed).
  const target = new Quaternion()
  const update = (quat: QuatObject): void => {
    target.set(quat.x, quat.y, quat.z, quat.w)
    trackerGroup.quaternion.slerp(target, 0.5)
  }

  const setHighlight = (axis: TrackerAxis | null): void => {
    for (const key of Object.keys(arrows) as TrackerAxis[]) {
      const active = axis === null || key === axis
      arrows[key].setLength(active ? (axis ? 3.2 : 2.2) : 1.4)
      arrows[key].setColor(new Color(active ? AXIS_COLORS[key] : 0x475069))
    }
  }

  const dispose = (): void => {
    if (animationId !== null) cancelAnimationFrame(animationId)
    for (const arrow of Object.values(arrows)) arrow.dispose()
    bodyGeometry.dispose()
    bodyMaterial.dispose()
    edgeGeometry.dispose()
    edgeMaterial.dispose()
    faceGeometry.dispose()
    faceMaterial.dispose()
    groundGeometry.dispose()
    groundMaterial.dispose()
    scene.clear()
    // Electron keeps WebGL contexts alive across view switches otherwise.
    renderer.dispose()
    renderer.forceContextLoss()
  }

  return { update, setHighlight, dispose }
}

interface Props {
  /** Latest orientation from the live feed; undefined while unknown. */
  rotation?: QuatObject
  /** Emphasise one body axis (the axis a calibration spin is about). */
  highlightAxis?: TrackerAxis | null
  /** Shown in place of the canvas when WebGL is unavailable. */
  fallbackText?: string
}

/**
 * Renders the tracker's live orientation. Falls back to a plain message if the
 * WebGL context cannot be created (remote desktop, no GPU) rather than taking
 * the flow down with it.
 */
export function TrackerPreview({ rotation, highlightAxis = null, fallbackText }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<PreviewContext | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      contextRef.current = createPreview(canvas)
    } catch {
      setFailed(true)
      return
    }
    return () => {
      contextRef.current?.dispose()
      contextRef.current = null
    }
  }, [])

  useEffect(() => {
    if (rotation) contextRef.current?.update(rotation)
  }, [rotation])

  useEffect(() => {
    contextRef.current?.setHighlight(highlightAxis)
  }, [highlightAxis])

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-surface-border bg-surface-raised px-4 text-sm text-slate-400"
        style={{ height: CANVAS_HEIGHT }}
      >
        {fallbackText}
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-surface-border bg-surface-raised"
      style={{ height: CANVAS_HEIGHT }}
    />
  )
}
