import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight,
  ArrowHelper,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  BufferGeometry,
  Line,
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
import type { Quaternion as QuatObject, SensCalPlacement } from '@shared/types'

/**
 * Live 3D orientation preview for one tracker.
 *
 * Derived from SlimeVR-Server's `IMUVisualizerWidget` (gui/src/components/
 * widgets/IMUVisualizerWidget.tsx), MIT licensed — Copyright (c) SlimeVR
 * contributors. The scene layout (camera, lights, wireframe ground plane, RAF
 * render loop) and the quaternion handling follow it: a rotation is applied
 * to the model group component-for-component, `group.quaternion.set(x, y, z,
 * w)`, with no axis swap or sign flip.
 *
 * What is drawn is the *physical* tracker: a slab lying flat with its button
 * on top at identity. Fed a raw SlimeVR rotation that means nothing in
 * particular — the server's mounting and reset fixes put the IMU's frame
 * wherever they like — so the calibration flow feeds it the pose relative to
 * a captured "flat, button up" reference instead (`@shared/tracker-frame`),
 * and then the slab on screen matches the case in the hand. Frame: X along
 * the long side, Y through the button face, Z along the short side.
 */

const CANVAS_HEIGHT = 200
const GROUND_COLOR = '#4444aa'

/** Body directions, in the model's frame. */
const AXIS_VECTORS = {
  long: new Vector3(1, 0, 0),
  up: new Vector3(0, 1, 0),
  short: new Vector3(0, 0, 1)
}
type BodyAxis = keyof typeof AXIS_VECTORS

const AXIS_COLORS: Record<BodyAxis, number> = {
  long: 0xff5f6d,
  up: 0x5fe08b,
  short: 0x6aa8ff
}

/** The body direction that stands vertical in each placement. */
const VERTICAL_AXIS: Record<SensCalPlacement, BodyAxis> = {
  flat: 'up',
  'long-edge': 'short',
  'short-edge': 'long'
}

interface PreviewContext {
  /** Apply a new orientation. Cheap: no scene rebuild. */
  update: (quat: QuatObject) => void
  /** Emphasise the body direction a placement stands vertical. */
  setHighlight: (placement: SensCalPlacement | null) => void
  /** Show or hide the world-up spin axis through the model. */
  setSpinAxis: (visible: boolean) => void
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

  // The case: a slab, long along X, thin along Y, with the button on top so
  // "flat, button up" is unmistakable and a flipped tracker reads as flipped.
  const bodyGeometry = new BoxGeometry(2.6, 0.7, 2.0)
  const bodyMaterial = new MeshStandardMaterial({
    color: 0x2b3348,
    roughness: 0.55,
    metalness: 0.1
  })
  trackerGroup.add(new Mesh(bodyGeometry, bodyMaterial))

  const edgeGeometry = new EdgesGeometry(bodyGeometry)
  const edgeMaterial = new LineBasicMaterial({ color: 0x8aa0c8 })
  trackerGroup.add(new LineSegments(edgeGeometry, edgeMaterial))

  // The button: off-centre along the long side, so heading is visible too.
  const buttonGeometry = new CylinderGeometry(0.3, 0.3, 0.14, 24)
  const buttonMaterial = new MeshStandardMaterial({ color: 0x7c5cff, roughness: 0.4 })
  const button = new Mesh(buttonGeometry, buttonMaterial)
  button.position.set(0.7, 0.42, 0)
  trackerGroup.add(button)

  // A small pad on the button face's far end, so the two ends differ.
  const padGeometry = new PlaneGeometry(0.5, 0.25)
  const padMaterial = new MeshBasicMaterial({ color: 0x5fe08b, side: DoubleSide })
  const pad = new Mesh(padGeometry, padMaterial)
  pad.position.set(-0.85, 0.36, 0)
  pad.rotation.x = -Math.PI / 2
  trackerGroup.add(pad)

  // Body-direction arrows, drawn in the tracker's own frame so they turn with it.
  const arrows: Record<BodyAxis, ArrowHelper> = {
    long: new ArrowHelper(AXIS_VECTORS.long, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.long),
    up: new ArrowHelper(AXIS_VECTORS.up, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.up),
    short: new ArrowHelper(AXIS_VECTORS.short, new Vector3(0, 0, 0), 2.2, AXIS_COLORS.short)
  }
  for (const arrow of Object.values(arrows)) trackerGroup.add(arrow)

  // The spin axis: world up through the model, fixed in the scene, so the
  // user can see the slab turning about it rather than tumbling.
  const axisGeometry = new BufferGeometry().setFromPoints([
    new Vector3(0, -3, 0),
    new Vector3(0, 3.4, 0)
  ])
  const axisMaterial = new LineDashedMaterial({
    color: 0xfbbf24,
    dashSize: 0.25,
    gapSize: 0.15,
    transparent: true,
    opacity: 0.9
  })
  const spinAxis = new Line(axisGeometry, axisMaterial)
  spinAxis.computeLineDistances()
  spinAxis.visible = false
  scene.add(spinAxis)

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

  const setHighlight = (placement: SensCalPlacement | null): void => {
    const vertical = placement ? VERTICAL_AXIS[placement] : null
    for (const key of Object.keys(arrows) as BodyAxis[]) {
      const active = vertical === null || key === vertical
      arrows[key].setLength(active ? (vertical ? 3.2 : 2.2) : 1.4)
      arrows[key].setColor(new Color(active ? AXIS_COLORS[key] : 0x475069))
    }
  }

  const setSpinAxis = (visible: boolean): void => {
    spinAxis.visible = visible
  }

  const dispose = (): void => {
    if (animationId !== null) cancelAnimationFrame(animationId)
    for (const arrow of Object.values(arrows)) arrow.dispose()
    bodyGeometry.dispose()
    bodyMaterial.dispose()
    edgeGeometry.dispose()
    edgeMaterial.dispose()
    buttonGeometry.dispose()
    buttonMaterial.dispose()
    padGeometry.dispose()
    padMaterial.dispose()
    axisGeometry.dispose()
    axisMaterial.dispose()
    groundGeometry.dispose()
    groundMaterial.dispose()
    scene.clear()
    // Electron keeps WebGL contexts alive across view switches otherwise.
    renderer.dispose()
    renderer.forceContextLoss()
  }

  return { update, setHighlight, setSpinAxis, dispose }
}

interface Props {
  /**
   * Orientation to show; undefined while unknown. Pass the pose relative to
   * the captured reference (`trackerPose`) once one exists — a raw SlimeVR
   * rotation only shows *that* the tracker moves, not how it is lying.
   */
  rotation?: QuatObject
  /** Emphasise the body direction this placement stands vertical. */
  highlightPlacement?: SensCalPlacement | null
  /** Draw the world-up spin axis through the model. */
  showSpinAxis?: boolean
  /** Shown in place of the canvas when WebGL is unavailable. */
  fallbackText?: string
}

/**
 * Renders the tracker's live orientation. Falls back to a plain message if the
 * WebGL context cannot be created (remote desktop, no GPU) rather than taking
 * the flow down with it.
 */
export function TrackerPreview({
  rotation,
  highlightPlacement = null,
  showSpinAxis = false,
  fallbackText
}: Props) {
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
    contextRef.current?.setHighlight(highlightPlacement)
  }, [highlightPlacement])

  useEffect(() => {
    contextRef.current?.setSpinAxis(showSpinAxis)
  }, [showSpinAxis])

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
