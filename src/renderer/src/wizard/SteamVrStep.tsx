import { useEffect, useState } from 'react'
import { LINKS } from '@shared/config'
import type { SteamVrInfo } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function SteamVrStep() {
  const t = useAppStore((s) => s.t)
  const [info, setInfo] = useState<SteamVrInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setInfo(await window.api.steamvr.getInfo())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <StepShell title={t('step.steamvr.title')}>
      <CheckRow
        label={t('step.steamvr.driver')}
        status={loading ? 'running' : info?.slimevrDriverRegistered ? 'pass' : 'fail'}
        value={
          info?.slimevrDriverRegistered ? t('step.steamvr.registered') : t('step.steamvr.missing')
        }
        detail={
          info?.slimevrDriverRegistered
            ? undefined
            : 'Open SlimeVR Server → Settings → SteamVR and enable the driver, then re-check.'
        }
      />
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={load} disabled={loading}>
          {t('nav.recheck')}
        </Button>
        <Button variant="ghost" onClick={() => window.api.docs.openExternal(LINKS.slimevrDocs)}>
          {t('links.docs')}
        </Button>
      </div>
    </StepShell>
  )
}
