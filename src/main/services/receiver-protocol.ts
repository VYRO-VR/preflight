// Pure, dependency-free parsing of the receiver's serial console. Kept separate
// from `receiver-serial.ts` (which owns the native serialport I/O) so the
// protocol can be unit-tested in plain Node without opening a real port.

import { RECEIVER_SERIAL } from '@shared/config'
import type { PairingEvent } from '@shared/types'

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
