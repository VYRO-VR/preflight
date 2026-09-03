// Pure, dependency-free parsing of the receiver's serial console. Kept separate
// from `receiver-serial.ts` (which owns the native serialport I/O) so the
// protocol can be unit-tested in plain Node without opening a real port.

import { RECEIVER_CONSOLE, RECEIVER_SERIAL, FIRMWARE_BUILD_DATE_REGEX } from '@shared/config'
import type {
  PairingEvent,
  ReceiverInfo,
  ReceiverSlot,
  TrackerInfo,
  TrackerSlotMatch
} from '@shared/types'

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

/**
 * Parse the receiver's `list` output into paired slots.
 *
 * The receiver prints one stored device address per line, in slot order, so
 * the line index *is* the slot id that `send <id> …` takes. Anything that is
 * not a bare 12-hex-digit address (log prefixes, the echoed command, blank
 * lines) is skipped without consuming a slot number.
 */
export function parseSlotList(raw: string): ReceiverSlot[] {
  const slots: ReceiverSlot[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = RECEIVER_CONSOLE.listAddressRegex.exec(line.trim())
    if (m) slots.push({ slot: slots.length, address: m[1].toUpperCase() })
  }
  return slots
}

/**
 * Best-effort link between a receiver slot and a tracker in the SlimeVR feed.
 *
 * Nothing in the protocol connects the two: `send <id>` takes a receiver slot,
 * while the live feed identifies trackers by `deviceId:trackerNum`. The one
 * thread between them is that SlimeVR Server names an HID tracker after its
 * hardware id, so a slot's address often appears inside the tracker's name.
 *
 * That is a hint, never a fact — `confident` is true only for exactly one
 * match. The flow must still have the user confirm the tracker physically
 * (the wiggle test) before sending anything, because calibrating the wrong
 * tracker is invisible to the user.
 */
export function matchSlotToTracker(slot: ReceiverSlot, trackers: TrackerInfo[]): TrackerSlotMatch {
  const hexOf = (s: string): string => s.toUpperCase().replace(/[^0-9A-F]/g, '')
  const address = hexOf(slot.address)
  const hits = trackers.filter((t) => address.length > 0 && hexOf(t.name).includes(address))
  return {
    slot: slot.slot,
    address: slot.address,
    trackerId: hits.length === 1 ? hits[0].id : undefined,
    confident: hits.length === 1
  }
}
