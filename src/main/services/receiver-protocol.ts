// Pure, dependency-free parsing of the receiver's serial console. Kept separate
// from `receiver-serial.ts` (which owns the native serialport I/O) so the
// protocol can be unit-tested in plain Node without opening a real port.
//
// This file covers the pairing session and the `info` banner. Parsing of the
// `list` command, and the slot-to-tracker matching built on it, live in
// `@shared/receiver-slots` instead — the calibration flow in the renderer
// needs the same matching, and the renderer cannot import from `main/`.

import { RECEIVER_SERIAL, FIRMWARE_BUILD_DATE_REGEX } from '@shared/config'
import type { PairingEvent, ReceiverInfo } from '@shared/types'

/**
 * Line-buffers raw serial text and turns completed lines into pairing events.
 * Serial data arrives in arbitrary chunks, so a line may be split across pushes
 * or several lines may arrive at once — `push` handles both.
 */
export class PairingParser {
  private buffer = ''

  push(chunk: string): PairingEvent[] {
    this.buffer += chunk
    const events: PairingEvent[] = []
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, '').trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (line) events.push(parseLine(line))
    }
    return events
  }
}

/** Classify a single console line. */
export function parseLine(line: string): PairingEvent {
  const m = RECEIVER_SERIAL.addedDeviceRegex.exec(line)
  if (m) return { type: 'paired', id: m[1], address: m[2], line }
  return { type: 'log', line }
}

/**
 * Parse the receiver's `info` console output into firmware info. The firmware
 * prints a banner like
 *   `<name> 1.2.0+3 (Commit v1.2.0-4-gf750a5b, Build 2026-07-18 15:56:12)`
 * followed by `Board:` / `Target:` lines — pull the version, source commit,
 * build timestamp, and board target out so the app can compare the receiver
 * against the latest release.
 */
export function parseReceiverInfo(raw: string): ReceiverInfo {
  const version = RECEIVER_SERIAL.versionRegex.exec(raw)?.[1]
  const commit = RECEIVER_SERIAL.commitRegex.exec(raw)?.[1]
  const buildDate =
    RECEIVER_SERIAL.buildDateRegex.exec(raw)?.[1] ?? FIRMWARE_BUILD_DATE_REGEX.exec(raw)?.[0]
  const board = RECEIVER_SERIAL.boardRegex.exec(raw)?.[1]
  return { firmwareVersion: version, commit, buildDate, board, raw }
}
