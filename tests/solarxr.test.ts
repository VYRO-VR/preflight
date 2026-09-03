import { describe, it, expect } from 'vitest'
import * as flatbuffers from 'flatbuffers'
import {
  MessageBundleT,
  DataFeedMessageHeaderT,
  DataFeedMessage,
  DataFeedUpdateT,
  DeviceDataT,
  DeviceIdT,
  HardwareStatusT,
  HardwareInfoT,
  TrackerDataT,
  TrackerInfoT,
  TrackerIdT,
  QuatT,
  BodyPart,
  TrackerStatus
} from 'solarxr-protocol'
import { buildStartDataFeed, decodeDataFeed } from '../src/main/services/solarxr'

/** Encode a DataFeedUpdate bundle the way a real SlimeVR Server would. */
function encodeUpdate({ rotation = true }: { rotation?: boolean } = {}): Uint8Array {
  const hwInfo = new HardwareInfoT()
  hwInfo.firmwareVersion = '0.5.0'

  const hwStatus = new HardwareStatusT()
  hwStatus.rssi = -55
  hwStatus.batteryVoltage = 3.9
  hwStatus.batteryPctEstimate = 83 // uint8 percentage

  const trackerInfo = new TrackerInfoT()
  trackerInfo.bodyPart = BodyPart.LEFT_LOWER_LEG
  trackerInfo.customName = 'LeftAnkle'

  const tracker = new TrackerDataT()
  tracker.trackerId = new TrackerIdT(new DeviceIdT(7), 1)
  tracker.info = trackerInfo
  tracker.status = TrackerStatus.OK
  // 90° about Y, the sort of value the turn counter and preview consume.
  if (rotation) tracker.rotation = new QuatT(0, Math.SQRT1_2, 0, Math.SQRT1_2)

  const device = new DeviceDataT()
  device.id = new DeviceIdT(7)
  device.hardwareInfo = hwInfo
  device.hardwareStatus = hwStatus
  device.trackers = [tracker]

  const header = new DataFeedMessageHeaderT(
    DataFeedMessage.DataFeedUpdate,
    new DataFeedUpdateT([device])
  )
  const bundle = new MessageBundleT([header])

  const builder = new flatbuffers.Builder(256)
  builder.finish(bundle.pack(builder))
  return builder.asUint8Array()
}

describe('buildStartDataFeed', () => {
  it('produces a non-empty flatbuffers payload', () => {
    const bytes = buildStartDataFeed()
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })
})

describe('decodeDataFeed', () => {
  it('extracts tracker state from a DataFeedUpdate', () => {
    const trackers = decodeDataFeed(encodeUpdate())
    expect(trackers).not.toBeNull()
    expect(trackers).toHaveLength(1)
    const t = trackers![0]
    expect(t.id).toBe('7:1')
    expect(t.name).toBe('LeftAnkle')
    expect(t.bodyPart).toBe('Left Ankle')
    expect(t.status).toBe('ok')
    expect(t.rssi).toBe(-55)
    expect(t.firmwareVersion).toBe('0.5.0')
    expect(t.batteryLevel).toBeCloseTo(0.83, 5)
  })

  it('round-trips the rotation quaternion', () => {
    const t = decodeDataFeed(encodeUpdate())![0]
    expect(t.rotation).toBeDefined()
    expect(t.rotation!.x).toBeCloseTo(0, 6)
    expect(t.rotation!.y).toBeCloseTo(Math.SQRT1_2, 6)
    expect(t.rotation!.z).toBeCloseTo(0, 6)
    expect(t.rotation!.w).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('leaves rotation undefined when the server sends none', () => {
    const t = decodeDataFeed(encodeUpdate({ rotation: false }))![0]
    expect(t.rotation).toBeUndefined()
  })

  it('returns null for non-SolarXR / non-update data', () => {
    expect(decodeDataFeed(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})
