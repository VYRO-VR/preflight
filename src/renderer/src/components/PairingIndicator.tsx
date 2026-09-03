import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReceiverPort } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'

/**
 * Always-visible chrome in the window's top corner showing whether the
 * receiver is currently in pairing mode: a blue dot that pulses while it is,
 * doubling as the button that turns pairing mode on or cancels it.
 *
 * Pairing state is global (the main process owns one serial session), so this
 * stays in sync with the pairing flow — starting or cancelling here is
 * reflected there, and vice versa.
 */
export function PairingIndicator() {
  const t = useAppStore((s) => s.t)
  const pairing = useAppStore((s) => s.pairing)
  const startPairing = useAppStore((s) => s.startPairing)
  const stopPairing = useAppStore((s) => s.stopPairing)
  const clearPairingError = useAppStore((s) => s.clearPairingError)

  // The picker only opens when the receiver is ambiguous (none, or several).
  const [ports, setPorts] = useState<ReceiverPort[] | null>(null)
  const [searching, setSearching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const open = ports !== null
  const close = useCallback(() => setPorts(null), [])

  // Dismiss the picker on an outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  /** Look for receivers; pair straight away when there's exactly one. */
  const search = async (): Promise<void> => {
    setSearching(true)
    try {
      const found = await window.api.receiver.list()
      if (found.length === 1) {
        close()
        await startPairing(found[0].path)
      } else {
        setPorts(found)
      }
    } finally {
      setSearching(false)
    }
  }

  const toggle = async (): Promise<void> => {
    if (pairing.active) {
      close()
      await stopPairing()
    } else if (open) {
      close()
    } else {
      await search()
    }
  }

  const busy = pairing.busy || searching
  const label = busy
    ? t('pairing.indicator.working')
    : pairing.active
      ? t('pairing.indicator.on')
      : t('pairing.indicator.off')

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-expanded={open}
        aria-label={pairing.active ? t('pairing.indicator.stop') : t('pairing.indicator.start')}
        title={pairing.active ? t('pairing.indicator.stop') : t('pairing.indicator.start')}
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
          pairing.active
            ? 'border-brand-500/60 bg-brand-600/15 text-brand-200 hover:bg-brand-600/25'
            : 'border-surface-border bg-surface text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
      >
        <PairingDot active={pairing.active} busy={busy} />
        <span>{label}</span>
      </button>

      {/* Live region so the state change is announced, not just coloured. */}
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>

      {(open || pairing.error) && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 space-y-3 rounded-lg border border-surface-border bg-surface-raised p-4 shadow-xl">
          {pairing.error && (
            <div className="rounded border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
              <div className="flex items-start justify-between gap-2">
                <strong>{t('pair.error.title')}</strong>
                <button
                  type="button"
                  onClick={clearPairingError}
                  aria-label={t('pairing.indicator.dismiss')}
                  className="shrink-0 text-rose-300 hover:text-rose-100"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 break-words">{pairing.error}</p>
            </div>
          )}

          {open && ports.length === 0 && (
            <div className="space-y-2 text-xs">
              <strong className="text-amber-200">{t('pair.connect.none.title')}</strong>
              <p className="text-slate-400">{t('pair.connect.none.body')}</p>
              <Button variant="secondary" onClick={search}>
                {t('pair.connect.retry')}
              </Button>
            </div>
          )}

          {open && ports.length > 1 && (
            <div className="space-y-2 text-xs">
              <p className="text-slate-300">{t('pair.connect.choose')}</p>
              {ports.map((p) => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => {
                    close()
                    startPairing(p.path)
                  }}
                  className="block w-full rounded border border-surface-border px-3 py-2 text-left text-slate-200 hover:border-brand-500 hover:bg-brand-600/10"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Blue dot with a pulsing halo while the receiver is in pairing mode. */
function PairingDot({ active, busy }: { active: boolean; busy: boolean }) {
  if (!active) {
    return (
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full bg-slate-600 ${busy ? 'animate-pulse' : ''}`}
      />
    )
  }
  return (
    <span aria-hidden className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
    </span>
  )
}
