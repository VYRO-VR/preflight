// Receiver slot identity: reading the receiver's `list` output, and the
// best-effort link from a slot to a tracker in the SlimeVR live feed.
//
// Shared rather than main-only because the calibration flow in the renderer
// needs the same matching to suggest a slot, and this is pure logic.

import { RECEIVER_CONSOLE } from './config'
import type { ReceiverSlot, TrackerInfo, TrackerSlotMatch } from './types'

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
