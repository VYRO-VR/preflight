import { useEffect, useState } from 'react'
import type { UsbDeviceMatch } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function ReceiverStep() {
  const t = useAppStore((s) => s.t)
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
      <CheckRow
        label={t('step.receiver.detected')}
        status={loading && !match ? 'running' : match?.detected ? 'pass' : 'fail'}
        value={
          match?.detected
            ? [match.description, match.comPort].filter(Boolean).join(' · ')
            : t('step.receiver.missing')
        }
        detail={
          match?.detected ? undefined : 'Plug the receiver directly into a USB port via the extension cable.'
        }
      />
      <div className="pt-2">
        <Button variant="secondary" onClick={load}>
          {t('nav.recheck')}
        </Button>
      </div>
    </StepShell>
  )
}
