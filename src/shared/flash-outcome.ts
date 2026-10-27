import type { BulkFlashEvent, BulkFlashLogCode } from './types'

export type FlashOutcome = 'success' | 'failure'

/**
 * Log codes from the bulk-flash loop that mean the run cannot continue or a
 * recovery failed. A failed program attempt while no board is on the pins is
 * the normal idle state and never produces an event, so it is deliberately
 * not here — only these explicit errors count as a failed flash.
 */
const FAILURE_CODES: ReadonlySet<BulkFlashLogCode> = new Set([
  'recover-failed',
  'nrfutil-missing',
  'device-plugin-missing',
  'hex-missing'
])

/** Which sound, if any, a bulk-flash event should trigger. */
export function bulkFlashEventOutcome(event: BulkFlashEvent): FlashOutcome | null {
  if (event.type === 'flashed') return 'success'
  if (event.type === 'log' && FAILURE_CODES.has(event.code)) return 'failure'
  return null
}
