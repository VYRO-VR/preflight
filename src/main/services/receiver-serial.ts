import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { RECEIVER_SERIAL, RECEIVER_USB_IDS } from '@shared/config'
import type { PairingEvent, ReceiverInfo, ReceiverPort } from '@shared/types'
import { PairingParser, parseReceiverInfo } from './receiver-protocol'

/** Parse a hex USB id ("1209", "0x1209", "520F") to a number for comparison. */
function hex(value?: string): number | null {
  if (!value) return null
  const n = parseInt(value.replace(/^0x/i, ''), 16)
  return Number.isNaN(n) ? null : n
}

const KNOWN_IDS = RECEIVER_USB_IDS.map((id) => ({
  vendorId: hex(id.vendorId),
  productId: hex(id.productId),
  label: id.label,
  flashMethod: id.flashMethod
}))

/**
 * Enumerate receivers on serial ports. Uses serialport's cross-platform
 * `list()` (which also yields the port path directly) and keeps only ports
 * whose VID/PID match a known receiver from the config.
 */
export async function listReceivers(): Promise<ReceiverPort[]> {
  const ports = await SerialPort.list()
  const out: ReceiverPort[] = []
  for (const p of ports) {
    const vid = hex(p.vendorId)
    const pid = hex(p.productId)
    const known = KNOWN_IDS.find((k) => k.vendorId === vid && k.productId === pid)
    if (!known) continue
    out.push({
      path: p.path,
      label: `${known.label} (${p.path})`,
      vendorId: p.vendorId,
      productId: p.productId,
      flashMethod: known.flashMethod
    })
  }
  return out
}

/** Open the port briefly, run a command, and collect console output. */
async function withPort<T>(
  path: string,
  fn: (port: SerialPort, collected: () => string) => Promise<T>
): Promise<T> {
  const port = new SerialPort({ path, baudRate: RECEIVER_SERIAL.baudRate, autoOpen: false })
  let buffer = ''
  port.on('data', (buf: Buffer) => (buffer += buf.toString('utf-8')))
  await new Promise<void>((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())))
  try {
    return await fn(port, () => buffer)
  } finally {
    if (port.isOpen) await new Promise<void>((resolve) => port.close(() => resolve()))
  }
}

/** Ask the receiver for its firmware info over the serial console. */
export async function readReceiverInfo(path: string): Promise<ReceiverInfo> {
  return withPort(path, async (port, collected) => {
    port.write(RECEIVER_SERIAL.infoCmd)
    await delay(1500)
    return parseReceiverInfo(collected())
  })
}

/** Reboot the receiver into its DFU bootloader. */
export async function enterReceiverDfu(path: string): Promise<void> {
  await withPort(path, async (port) => {
    await new Promise<void>((resolve) =>
      port.write(RECEIVER_SERIAL.dfuCmd, () => port.drain(() => resolve()))
    )
    // Give the device a moment to act on the command before the port closes.
    await delay(300)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Drives a pairing session over the receiver's serial console: opens the port,
 * enters pairing mode, and emits a `PairingEvent` for each console line (most
 * importantly `paired` when a tracker is accepted). A single instance is owned
 * by the IPC layer and reused across sessions.
 */
export class ReceiverPairingClient extends EventEmitter {
  private port: SerialPort | null = null
  private parser = new PairingParser()

  /** Type-safe event subscription (the only event we emit is `event`). */
  override on(event: 'event', listener: (e: PairingEvent) => void): this {
    return super.on(event, listener)
  }

  private send(e: PairingEvent): void {
    this.emit('event', e)
  }

  async startPairing(path: string): Promise<void> {
    await this.stopPairing()
    this.parser = new PairingParser()
    this.send({ type: 'status', status: 'opening' })

    const port = new SerialPort({ path, baudRate: RECEIVER_SERIAL.baudRate, autoOpen: false })
    this.port = port

    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()))
    })

    port.on('data', (buf: Buffer) => {
      for (const e of this.parser.push(buf.toString('utf-8'))) this.send(e)
    })
    port.on('error', (err: Error) => this.send({ type: 'error', message: err.message }))

    port.write(RECEIVER_SERIAL.enterPairingCmd)
    this.send({ type: 'status', status: 'listening' })
  }

  async stopPairing(): Promise<void> {
    const port = this.port
    this.port = null
    if (!port) return
    try {
      if (port.isOpen) {
        // Take the receiver out of pairing mode, and flush the command before
        // closing — otherwise the write can be dropped and pairing mode stays
        // on after the user leaves the flow.
        await new Promise<void>((resolve) => {
          port.write(RECEIVER_SERIAL.exitPairingCmd, () => port.drain(() => resolve()))
        })
        await new Promise<void>((resolve) => port.close(() => resolve()))
      }
    } catch {
      // best-effort close
    }
    this.send({ type: 'status', status: 'stopped' })
  }
}
