import { describe, expect, it } from 'vitest'
import { bulkFlashEventOutcome } from '@shared/flash-outcome'
import type { BulkFlashEvent } from '@shared/types'

const log = (code: Extract<BulkFlashEvent, { type: 'log' }>['code']): BulkFlashEvent => ({
  type: 'log',
  level: 'error',
  code
})

describe('bulkFlashEventOutcome', () => {
  it('chimes for every board flashed', () => {
    expect(bulkFlashEventOutcome({ type: 'flashed', count: 3, elapsedMs: 900 })).toBe('success')
  })

  it('screams for errors that stop the loop or a failed recovery', () => {
    for (const code of [
      'recover-failed',
      'nrfutil-missing',
      'device-plugin-missing',
      'hex-missing'
    ] as const) {
      expect(bulkFlashEventOutcome(log(code))).toBe('failure')
    }
  })

  it('stays quiet for normal loop chatter', () => {
    for (const code of ['ready', 'protected', 'recovered', 'removed', 'stuck-hint'] as const) {
      expect(bulkFlashEventOutcome(log(code))).toBeNull()
    }
    expect(bulkFlashEventOutcome({ type: 'phase', phase: 'waiting' })).toBeNull()
    expect(bulkFlashEventOutcome({ type: 'stopped', count: 2 })).toBeNull()
  })
})
