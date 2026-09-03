import { useEffect, useRef, useState } from 'react'
import { PAIRING_PRESSES } from '@shared/config'
import type { ReceiverPort } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'

type Phase = 'connecting' | 'choosing' | 'none' | 'pairing' | 'stopped' | 'error'

interface PairedTracker {
  id: string
  address: string
}

const TIMEOUT_MS = 20000

export function PairingFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  // Pairing mode is global state (the top-corner indicator can turn it on or
  // cancel it too), so go through the store rather than window.api directly.
  const pairingActive = useAppStore((s) => s.pairing.active)
  const enterPairingMode = useAppStore((s) => s.startPairing)
  const exitPairingMode = useAppStore((s) => s.stopPairing)

  const [phase, setPhase] = useState<Phase>('connecting')
  const [ports, setPorts] = useState<ReceiverPort[]>([])
  const [paired, setPaired] = useState<PairedTracker[]>([])
  const [timedOut, setTimedOut] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  /** Receiver this flow is pairing to, so a cancelled session can restart. */
  const [activePath, setActivePath] = useState<string | null>(null)

  const startPairing = async (path: string): Promise<void> => {
    setActivePath(path)
    setPhase('pairing')
    await enterPairingMode(path)
    const { error } = useAppStore.getState().pairing
    if (error) {
      setErrorMsg(error)
      setPhase('error')
    }
  }

  const dispatchPorts = (found: ReceiverPort[]): void => {
    setPorts(found)
    if (found.length === 1) startPairing(found[0].path)
    else if (found.length === 0) setPhase('none')
    else setPhase('choosing')
  }

  const search = async (): Promise<void> => {
    setPhase('connecting')
    dispatchPorts(await window.api.receiver.list())
  }

  // Stream pairing events for the whole lifetime of the flow.
  useEffect(() => {
    const off = window.api.receiver.onPairingEvent((e) => {
      if (e.type === 'paired') {
        setPaired((prev) =>
          prev.some((p) => p.address === e.address)
            ? prev
            : [...prev, { id: e.id, address: e.address }]
        )
      } else if (e.type === 'error') {
        setErrorMsg(e.message)
        setPhase('error')
      }
    })
    return off
  }, [])

  // Connect on mount; always release the port on unmount.
  useEffect(() => {
    let cancelled = false
    window.api.receiver.list().then((found) => {
      if (!cancelled) dispatchPorts(found)
    })
    return () => {
      cancelled = true
      window.api.receiver.stopPairing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pairing mode can be cancelled from the top-corner indicator while this
  // flow is open. Watch for the on→off edge (not merely "not active", which is
  // also true in the moment between starting and the receiver reporting in).
  const wasActive = useRef(false)
  useEffect(() => {
    if (pairingActive) {
      wasActive.current = true
    } else if (wasActive.current) {
      wasActive.current = false
      setPhase((p) => (p === 'pairing' ? 'stopped' : p))
    }
  }, [pairingActive])

  // Show a help hint if nothing pairs for a while. Resets whenever a tracker
  // pairs (paired.length changes) or we (re)enter the pairing phase.
  useEffect(() => {
    if (phase !== 'pairing') return
    setTimedOut(false)
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [phase, paired.length])

  // Always take the receiver out of pairing mode before leaving the flow.
  // Used by both the "Done" button and the back button so the receiver never
  // stays in pairing mode after the user navigates away. Awaiting stopPairing
  // before onExit() also guarantees the exit command is flushed (and the port
  // released) before the component unmounts, instead of relying on the
  // fire-and-forget cleanup below.
  const exit = async (): Promise<void> => {
    await exitPairingMode()
    onExit()
  }

  const footer = phase === 'pairing' ? <Button onClick={exit}>{t('pair.done')}</Button> : undefined

  return (
    <FlowShell title={t('pair.title')} onExit={exit} footer={footer}>
      {phase === 'connecting' && <Hint status="running" text={t('pair.connect.searching')} />}

      {phase === 'choosing' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{t('pair.connect.choose')}</p>
          {ports.map((p) => (
            <div
              key={p.path}
              className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
            >
              <span className="text-sm text-slate-100">{p.label}</span>
              <Button variant="secondary" onClick={() => startPairing(p.path)}>
                {t('pair.connect.use')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {phase === 'none' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            <strong>{t('pair.connect.none.title')}</strong>
            <p className="mt-1">{t('pair.connect.none.body')}</p>
          </div>
          <Button variant="secondary" onClick={search}>
            {t('pair.connect.retry')}
          </Button>
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <strong>{t('pair.error.title')}</strong>
          <p className="mt-1">{errorMsg}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={search}>
              {t('pair.connect.retry')}
            </Button>
          </div>
        </div>
      )}

      {phase === 'stopped' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-sm">
            <strong className="text-slate-100">{t('pair.stopped.title')}</strong>
            <p className="mt-1 text-slate-400">{t('pair.stopped.body')}</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => (activePath ? startPairing(activePath) : search())}
          >
            {t('pair.stopped.resume')}
          </Button>
        </div>
      )}

      {phase === 'pairing' && (
        <div className="space-y-3">
          {/* Latest success banner */}
          {paired.length > 0 && (
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              <strong>{t('pair.paired.title')}</strong>
              <p className="mt-1">{t('pair.paired.count', { count: paired.length })}</p>
            </div>
          )}

          {/* Instruction to (keep) pairing */}
          <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-100">{t('pair.listen.title')}</span>
              <StatusBadge status="running" label={t('pair.listen.waiting')} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {t('pair.listen.instruction', { presses: PAIRING_PRESSES })}
            </p>
          </div>

          {timedOut && (
            <p className="text-xs text-amber-300">
              {t('pair.listen.timeout', { presses: PAIRING_PRESSES })}
            </p>
          )}

          {/* Paired list */}
          {paired.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {paired.map((p, i) => (
                <div
                  key={p.address}
                  className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-100">Tracker {i + 1}</span>
                  <span className="font-mono text-xs text-slate-500">{p.address}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500">{t('pair.firmware.note')}</p>
        </div>
      )}
    </FlowShell>
  )
}

function Hint({ status, text }: { status: 'running'; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
      <StatusBadge status={status} label={text} />
    </div>
  )
}
