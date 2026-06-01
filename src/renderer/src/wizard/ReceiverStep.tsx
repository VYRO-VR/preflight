import { useEffect, useState } from 'react'
import type { UsbDeviceMatch } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function ReceiverStep() {
  const t = useAppStore((s) => s.t)
  const cableAcknowledged = useAppStore((s) => s.cableAcknowledged)
  const setCableAcknowledged = useAppStore((s) => s.setCableAcknowledged)
  const [match, setMatch] = useState<UsbDeviceMatch | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setMatch(await window.api.usb.detectReceiver())
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Poll while the user plugs the dongle in.
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <StepShell title={t('step.receiver.title')} description={t('step.receiver.body')}>
      {/* The extension cable is required — the user must confirm to continue. */}
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
          cableAcknowledged
            ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-100'
            : 'border-amber-700/50 bg-amber-950/30 text-amber-200'
        }`}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0"
          checked={cableAcknowledged}
          onChange={(e) => setCableAcknowledged(e.target.checked)}
        />
        <span>
          <strong>{t('step.receiver.cable.title')}</strong> {t('step.receiver.cable.body')}
        </span>
      </label>

      <CheckRow
        label={t('step.receiver.detected')}
        // Detection is best-effort: a non-match is a warning, not a failure,
        // because receivers vary widely and SlimeVR is the real authority.
        status={loading && !match ? 'running' : match?.detected ? 'pass' : 'warn'}
        value={
          match?.detected
            ? [match.description, match.comPort].filter(Boolean).join(' · ')
            : t('step.receiver.notdetected')
        }
        detail={match?.detected ? undefined : t('step.receiver.notdetected.hint')}
      />
      <div className="pt-2">
        <Button variant="secondary" onClick={load}>
          {t('nav.recheck')}
        </Button>
      </div>
    </StepShell>
  )
}
