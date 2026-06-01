import { promises as fs } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { SLIMEVR_WS_URL } from '@shared/config'
import type { SlimeVrInstall, SlimeVrLiveState, TrackerInfo } from '@shared/types'
import { buildStartDataFeed, decodeDataFeed } from './solarxr'

/**
 * Detect a local SlimeVR Server install. The installer drops the app under
 * %LOCALAPPDATA%\Programs\SlimeVR (Tauri default) or Program Files; the
 * bundled `package.json` / version file gives us the version when present.
 */
export async function getSlimeVrInstall(): Promise<SlimeVrInstall> {
  const localAppData = process.env.LOCALAPPDATA
  const programFiles = process.env['ProgramFiles']
  const candidates = [
    localAppData && path.join(localAppData, 'Programs', 'SlimeVR'),
    programFiles && path.join(programFiles, 'SlimeVR')
  ].filter(Boolean) as string[]

  for (const dir of candidates) {
    try {
      const stat = await fs.stat(dir)
      if (stat.isDirectory()) {
        return { installed: true, installPath: dir, version: await readVersion(dir) }
      }
    } catch {
      // not here — keep looking
    }
  }
  return { installed: false }
}

async function readVersion(dir: string): Promise<string | undefined> {
  for (const file of ['version.txt', 'VERSION']) {
    try {
      const v = await fs.readFile(path.join(dir, file), 'utf-8')
      return v.trim()
    } catch {
      // ignore
    }
  }
  return undefined
}

/**
 * Live tracker feed.
 *
 * SlimeVR Server speaks the SolarXR (flatbuffers) protocol on its WebSocket.
 * Full binary decoding belongs behind `decodeMessage`; until the
 * `solarxr-protocol` types are wired in we ship a thin read-only client that
 * reports connection status and decodes any JSON the server (or our test
 * fixture) sends. Swap `decodeMessage` to add full SolarXR support without
 * touching the rest of the app.
 */
export class SlimeVrClient extends EventEmitter {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private state: SlimeVrLiveState = { connected: false, trackers: [] }
  private closedByUser = false

  constructor(private readonly url: string = SLIMEVR_WS_URL) {
    super()
  }

  getState(): SlimeVrLiveState {
    return this.state
  }

  connect(): void {
    this.closedByUser = false
    this.open()
  }

  private open(): void {
    if (this.ws) return
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => {
      this.update({ connected: true })
      // Subscribe to the tracker data feed (SolarXR). Harmless to non-SlimeVR
      // endpoints, which simply ignore the binary frame.
      try {
        this.ws?.send(buildStartDataFeed())
      } catch {
        // ignore — feed will be retried on the next reconnect
      }
    })
    this.ws.on('message', (data) => {
      const decoded = this.decodeMessage(data as Buffer)
      if (decoded) this.update(decoded)
    })
    this.ws.on('close', () => {
      this.ws = null
      this.update({ connected: false, trackers: [] })
      this.scheduleReconnect()
    })
    this.ws.on('error', () => {
      // 'close' fires after 'error'; reconnect handled there.
    })
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, 3000)
  }

  private update(patch: Partial<SlimeVrLiveState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('state', this.state)
  }

  /**
   * Decode an inbound frame into a partial live-state. Tries the JSON shape
   * used by tests/mocks first, then the binary SolarXR data feed used by a
   * real SlimeVR Server. Returns null for frames it cannot read.
   */
  private decodeMessage(data: Buffer): Partial<SlimeVrLiveState> | null {
    const json = this.tryJson(data)
    if (json) return json

    const trackers = decodeDataFeed(new Uint8Array(data))
    if (trackers) return { connected: true, trackers }

    return null
  }

  private tryJson(data: Buffer): Partial<SlimeVrLiveState> | null {
    try {
      const json = JSON.parse(data.toString('utf-8')) as {
        serverVersion?: string
        trackers?: TrackerInfo[]
      }
      if (!Array.isArray(json.trackers)) return null
      return {
        connected: true,
        serverVersion: json.serverVersion,
        trackers: json.trackers
      }
    } catch {
      return null
    }
  }

  disconnect(): void {
    this.closedByUser = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.update({ connected: false, trackers: [] })
  }
}
