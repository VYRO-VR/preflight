// Pure firmware build-comparison helpers, shared by the main process (reads the
// receiver over serial) and the renderer (shows match status + gates updates).

import { FIRMWARE_BUILD_DATE_REGEX } from './config'
import type { FirmwareMatch, ReceiverInfo } from './types'

/** The build-date token in a firmware string, or the trimmed string itself. */
export function firmwareBuildToken(firmware?: string): string | undefined {
  if (!firmware) return undefined
  return FIRMWARE_BUILD_DATE_REGEX.exec(firmware)?.[0] ?? firmware.trim()
}

/**
 * Compare a receiver's firmware build against the trackers'. A mismatch is
 * reported when every tracker shares a build token that differs from the
 * receiver's. When either side lacks a comparable token, the result is
 * 'unknown' rather than a false alarm.
 */
export function matchFirmware(
  receiver: ReceiverInfo,
  trackerFirmwares: (string | undefined)[]
): FirmwareMatch {
  const receiverToken = receiver.buildDate ?? firmwareBuildToken(receiver.firmwareVersion)
  const trackerTokens = Array.from(
    new Set(trackerFirmwares.map(firmwareBuildToken).filter((t): t is string => Boolean(t)))
  )

  if (!receiverToken || trackerTokens.length === 0) {
    return { status: 'unknown', receiverBuildDate: receiverToken }
  }

  const allMatch = trackerTokens.every((t) => t === receiverToken)
  return {
    status: allMatch ? 'match' : 'mismatch',
    receiverBuildDate: receiverToken,
    trackerBuildDate: trackerTokens[0]
  }
}
