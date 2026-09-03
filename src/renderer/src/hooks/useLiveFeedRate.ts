import { useEffect } from 'react'
import { SLIMEVR_FEED_RATE_MS } from '@shared/config'

/**
 * Raise the SolarXR feed rate while the calling view is mounted, and restore
 * the idle rate on unmount.
 *
 * The feed is app-wide and every update crosses the IPC boundary, so the fast
 * rate is only worth paying for on screens that animate orientation (the 3D
 * preview, the sensitivity-calibration turn counter). Nesting is safe: the
 * innermost mount sets the rate, and the last unmount restores idle.
 */
export function useLiveFeedRate(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    void window.api.slimevr.setFeedRate(SLIMEVR_FEED_RATE_MS.live)
    return () => {
      void window.api.slimevr.setFeedRate(SLIMEVR_FEED_RATE_MS.idle)
    }
  }, [enabled])
}
