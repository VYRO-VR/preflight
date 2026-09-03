// SolarXR data-feed encoder/decoder.
//
// SlimeVR Server speaks the SolarXR (flatbuffers) protocol on its WebSocket.
// To receive tracker state we send a StartDataFeed message describing which
// fields we want, then decode the DataFeedUpdate frames the server streams
// back. Battery / RSSI / firmware live on the *device*; body part / status
// live on each *tracker* under that device.
//
// NOTE: built against solarxr-protocol; validate against a running SlimeVR
// Server, as it cannot be exercised without one.

import * as flatbuffers from 'flatbuffers'
import {
  MessageBundle,
  MessageBundleT,
  DataFeedMessageHeaderT,
  DataFeedMessage,
  StartDataFeedT,
  DataFeedConfigT,
  DeviceDataMaskT,
  TrackerDataMaskT,
  DataFeedUpdate,
  BodyPart,
  TrackerStatus,
  Quat
} from 'solarxr-protocol'
import { SLIMEVR_FEED_RATE_MS } from '@shared/config'
import type { Quaternion, TrackerInfo } from '@shared/types'

/**
 * Build the StartDataFeed request bundle. We ask for tracker info, status, and
 * rotation, plus device-level data (which carries battery, RSSI, and
 * firmware), throttled to one update per `minimumTimeSinceLastMs`.
 *
 * Re-sending this message replaces the feed config for the connection, which
 * is how `SlimeVrClient.setFeedRate` switches between the idle rate and the
 * fast rate a 3D preview or the sensitivity-calibration flow needs.
 */
export function buildStartDataFeed(
  minimumTimeSinceLastMs: number = SLIMEVR_FEED_RATE_MS.idle
): Uint8Array {
  const trackerMask = new TrackerDataMaskT()
  trackerMask.info = true
  trackerMask.status = true
  // Orientation drives the 3D preview and the sens-cal turn counter.
  trackerMask.rotation = true

  const deviceMask = new DeviceDataMaskT(trackerMask, /* deviceData */ true)
  const config = new DataFeedConfigT(minimumTimeSinceLastMs, deviceMask)
  const start = new StartDataFeedT([config])
  const header = new DataFeedMessageHeaderT(DataFeedMessage.StartDataFeed, start)
  const bundle = new MessageBundleT([header])

  const builder = new flatbuffers.Builder(256)
  builder.finish(bundle.pack(builder))
  return builder.asUint8Array()
}

function mapStatus(status: TrackerStatus): TrackerInfo['status'] {
  switch (status) {
    case TrackerStatus.OK:
      return 'ok'
    case TrackerStatus.BUSY:
      return 'busy'
    case TrackerStatus.ERROR:
      return 'error'
    case TrackerStatus.DISCONNECTED:
    case TrackerStatus.TIMED_OUT:
      return 'disconnected'
    default:
      return 'unknown'
  }
}

function prettyBodyPart(part: BodyPart): string | undefined {
  // BodyPart.NONE is 0, so a falsy check covers the "unassigned" case.
  if (!part) return undefined
  const name = BodyPart[part]
  if (!name) return undefined
  const pretty = name
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  // Use VYRO's terminology: thigh / ankle rather than upper/lower leg.
  return pretty.replace('Upper Leg', 'Thigh').replace('Lower Leg', 'Ankle')
}

/**
 * Read a tracker's orientation quaternion, if the server sent one. SolarXR
 * `Quat` is a struct, so it is only present when rotation was requested in the
 * data mask — `rotation()` returns null otherwise.
 */
function readQuaternion(tracker: { rotation(): Quat | null }): Quaternion | undefined {
  const q = tracker.rotation()
  if (!q) return undefined
  return { x: q.x(), y: q.y(), z: q.z(), w: q.w() }
}

/**
 * Decode a binary frame. Returns the tracker list if the frame is a
 * DataFeedUpdate, or null for any other frame / non-SolarXR data.
 */
export function decodeDataFeed(data: Uint8Array): TrackerInfo[] | null {
  let bundle: MessageBundle
  try {
    bundle = MessageBundle.getRootAsMessageBundle(new flatbuffers.ByteBuffer(data))
  } catch {
    return null
  }

  const trackers: TrackerInfo[] = []
  let sawUpdate = false

  for (let i = 0; i < bundle.dataFeedMsgsLength(); i++) {
    const header = bundle.dataFeedMsgs(i)
    if (!header || header.messageType() !== DataFeedMessage.DataFeedUpdate) continue
    sawUpdate = true

    const update = header.message(new DataFeedUpdate())
    if (!update) continue

    for (let d = 0; d < update.devicesLength(); d++) {
      const device = update.devices(d)
      if (!device) continue

      const hw = device.hardwareStatus()
      const info = device.hardwareInfo()
      const deviceId = device.id()?.id() ?? d
      // battery_pct_estimate is a uint8 percentage (0–100); normalise to 0–1.
      const batteryPct = hw?.batteryPctEstimate()
      const batteryLevel =
        batteryPct != null ? Math.min(1, Math.max(0, batteryPct / 100)) : undefined
      const batteryVoltage = hw?.batteryVoltage() ?? undefined
      const rssi = hw?.rssi() ?? undefined
      const firmwareVersion = info?.firmwareVersion() ?? undefined

      for (let t = 0; t < device.trackersLength(); t++) {
        const tracker = device.trackers(t)
        if (!tracker) continue
        const tInfo = tracker.info()
        const trackerNum = tracker.trackerId()?.trackerNum() ?? t
        const name =
          tInfo?.customName() || tInfo?.displayName() || `Tracker ${deviceId}:${trackerNum}`

        trackers.push({
          id: `${deviceId}:${trackerNum}`,
          name,
          rotation: readQuaternion(tracker),
          bodyPart: tInfo ? prettyBodyPart(tInfo.bodyPart()) : undefined,
          batteryLevel: batteryLevel ?? undefined,
          batteryVoltage: batteryVoltage ?? undefined,
          rssi: rssi ?? undefined,
          firmwareVersion,
          status: mapStatus(tracker.status())
        })
      }
    }
  }

  return sawUpdate ? trackers : null
}
