import { useEffect, useState } from 'react'
import { SUPPORTED } from '@shared/config'
import type { SystemInfo, CheckStatus } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function SystemStep() {
  const t = useAppStore((s) => s.t)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setInfo(await window.api.system.getInfo())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const running: CheckStatus = 'running'

  return (
    <StepShell title={t('step.system.title')}>
      <CheckRow
        label={t('step.system.os')}
        status={loading ? running : info && /windows/i.test(info.osName) ? 'pass' : 'warn'}
        value={info?.osName}
        detail={!info || /windows/i.test(info?.osName ?? '') ? undefined : 'Windows is recommended.'}
      />
      <CheckRow
        label={t('step.system.arch')}
        status={loading ? running : info?.is64Bit ? 'pass' : 'fail'}
        value={info?.arch}
      />
      <CheckRow
        label={t('step.system.memory')}
        status={loading ? running : (info?.totalMemoryGb ?? 0) >= SUPPORTED.minMemoryGb ? 'pass' : 'warn'}
        value={info ? `${info.totalMemoryGb} GB` : undefined}
      />
      <div className="pt-2">
        <Button variant="secondary" onClick={load} disabled={loading}>
          {t('nav.recheck')}
        </Button>
      </div>
    </StepShell>
  )
}
