import { useEffect, useState } from 'react'
import type { UsbDeviceMatch } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

/**
 * Light troubleshooting: reuses the app's existing detection (USB receiver +
 * the live SlimeVR feed) and presents the usual fixes as a quick checklist.
 */
export function TroubleshootFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  const live = useAppStore((s) => s.liveState)
  const [receiver, setReceiver] = useState<UsbDeviceMatch | null>(null)
  const [loading, setLoading] = useState(true)

  const check = async (): Promise<void> => {
    setLoading(true)
    setReceiver(await window.api.usb.detectReceiver())
    setLoading(false)
  }

  useEffect(() => {
    check()
  }, [])

  const online = live.trackers.filter((tr) => tr.status === 'ok').length

  return (
    <FlowShell
      title={t('troubleshoot.title')}
      description={t('troubleshoot.intro')}
      onExit={onExit}
    >
      <CheckRow
        label={t('troubleshoot.receiver')}
        status={loading && !receiver ? 'running' : receiver?.detected ? 'pass' : 'warn'}
        value={receiver?.detected ? receiver.description : undefined}
        detail={receiver?.detected ? undefined : t('troubleshoot.receiver.fail')}
      />
      <CheckRow
        label={t('troubleshoot.server')}
        status={live.connected ? 'pass' : 'fail'}
        detail={live.connected ? undefined : t('troubleshoot.server.fail')}
      />
      <CheckRow
        label={t('troubleshoot.trackers')}
        status={online > 0 ? 'pass' : 'warn'}
        value={online > 0 ? String(online) : undefined}
        detail={online > 0 ? undefined : t('troubleshoot.trackers.fail')}
      />

      <div className="pt-2">
        <Button variant="secondary" onClick={check}>
          {t('troubleshoot.recheck')}
        </Button>
      </div>
    </FlowShell>
  )
}
