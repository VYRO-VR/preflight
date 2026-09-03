import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer } from 'ws'
import { SlimeVrClient } from '../src/main/services/slimevr'
import type { SlimeVrLiveState } from '../src/shared/types'

let server: WebSocketServer | null = null

afterEach(() => {
  server?.close()
  server = null
})

function waitFor(
  client: SlimeVrClient,
  predicate: (s: SlimeVrLiveState) => boolean
): Promise<SlimeVrLiveState> {
  return new Promise((resolve) => {
    client.on('state', (s: SlimeVrLiveState) => {
      if (predicate(s)) resolve(s)
    })
  })
}

describe('SlimeVrClient', () => {
  it('connects and decodes a JSON tracker frame', async () => {
    server = new WebSocketServer({ port: 0 })
    const port = (server.address() as { port: number }).port

    server.on('connection', (ws) => {
      ws.send(
        JSON.stringify({
          serverVersion: '0.13.0',
          trackers: [
            {
              id: 't1',
              name: 'LeftFoot',
              status: 'ok',
              batteryLevel: 0.8,
              firmwareVersion: '0.4.0'
            }
          ]
        })
      )
    })

    const client = new SlimeVrClient(`ws://127.0.0.1:${port}`)
    const settled = waitFor(client, (s) => s.trackers.length > 0)
    client.connect()

    const state = await settled
    expect(state.connected).toBe(true)
    expect(state.serverVersion).toBe('0.13.0')
    expect(state.trackers[0].name).toBe('LeftFoot')
    client.disconnect()
  })
})
