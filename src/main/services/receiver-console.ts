import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { RECEIVER_CONSOLE, RECEIVER_SERIAL } from '@shared/config'
import type {
  ReceiverConsoleEvent,
  ReceiverConsoleState,
  ReceiverSlot,
  SensCalRequest
} from '@shared/types'
import { parseSlotList } from '@shared/receiver-slots'

/** How long `list` output is collected before it is parsed. */
const LIST_COLLECT_MS = 800

/**
 * A long-lived session on the receiver's serial console, for commands other
 * than pairing — today, the guided sensitivity calibration.
 *
 * There is deliberately one of these rather than an ad-hoc port open per
 * command: the console CDC is exclusive, so a second owner would fight
 * `ReceiverPairingClient` for it, and a calibration run needs the port held
 * open across the whole exchange (send the command, then watch for the
 * receiver's ack). Pairing and calibration are mutually exclusive; `ipc.ts`
 * owns both clients and enforces that.
 *
 * Unlike pairing, closing this session sends nothing to the receiver — there
 * is no mode to leave. A calibration already running on a tracker keeps
 * running; it is the tracker's business, not the receiver's.
 */
export class ReceiverConsoleClient extends EventEmitter {
  private port: SerialPort | null = null
  private buffer = ''
  /** Path of the open port, or the last one used. */
  private lastPath: string | null = null

  /** Type-safe event subscription (the only event we emit is `event`). */
  override on(event: 'event', listener: (e: ReceiverConsoleEvent) => void): this {
    return super.on(event, listener)
  }

  private send(e: ReceiverConsoleEvent): void {
    this.emit('event', e)
  }

  getState(): ReceiverConsoleState {
    return { open: this.port !== null, path: this.lastPath }
  }

  async open(path: string): Promise<void> {
    if (this.port && this.lastPath === path) return
    await this.close()
    this.lastPath = path
    this.buffer = ''
    this.send({ type: 'status', status: 'opening' })

    const port = new SerialPort({ path, baudRate: RECEIVER_SERIAL.baudRate, autoOpen: false })
    this.port = port
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
    } catch (err) {
      // The port never opened, so there is nothing to close — just make sure
      // state and listeners agree that no session is running.
      this.port = null
      this.send({ type: 'status', status: 'closed' })
      throw err
    }

    port.on('data', (buf: Buffer) => this.ingest(buf.toString('utf-8')))
    port.on('error', (err: Error) => this.send({ type: 'error', message: err.message }))
    this.send({ type: 'status', status: 'open' })
  }

  async close(): Promise<void> {
    const port = this.port
    this.port = null
    if (!port) return
    try {
      if (port.isOpen) await new Promise<void>((resolve) => port.close(() => resolve()))
    } catch {
      // best-effort close
    }
    this.send({ type: 'status', status: 'closed' })
  }

  /**
   * Write a command and wait for it to reach the wire. Commands carry their
   * own trailing newline (they come from `@shared/config`).
   */
  async write(command: string): Promise<void> {
    const port = this.port
    if (!port?.isOpen) throw new Error('Receiver console is not open')
    await new Promise<void>((resolve, reject) => {
      port.write(command, (err) => (err ? reject(err) : port.drain(() => resolve())))
    })
  }

  /**
   * Run `list` and return the paired slots. The receiver answers immediately
   * but has no end-of-output marker, so output is collected for a fixed window
   * and then parsed — the line index within it is the slot id.
   */
  async listSlots(): Promise<ReceiverSlot[]> {
    let collected = ''
    const collect = (e: ReceiverConsoleEvent): void => {
      if (e.type === 'line') collected += `${e.line}\n`
    }
    this.on('event', collect)
    try {
      await this.write(RECEIVER_CONSOLE.listCmd)
      await delay(LIST_COLLECT_MS)
    } finally {
      this.off('event', collect)
    }
    return parseSlotList(collected)
  }

  /**
   * Start a gyro sensitivity calibration on one tracker. Resolving means the
   * command reached the receiver, not that the run succeeded — the receiver's
   * ack, and then the tracker's own progress and verdict, arrive as console
   * lines that `@shared/sens-cal` folds into its phase machine.
   */
  async startSensCal(req: SensCalRequest): Promise<void> {
    await this.write(RECEIVER_CONSOLE.sensAutoCmd(req.slot, req.axis, req.revolutions))
  }

  /** Line-buffer inbound serial text; serial data arrives in arbitrary chunks. */
  private ingest(chunk: string): void {
    this.buffer += chunk
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, '').trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (line) this.send({ type: 'line', line })
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
