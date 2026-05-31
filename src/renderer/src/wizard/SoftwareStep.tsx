import { useEffect, useState } from 'react'
import { LINKS } from '@shared/config'
import type { SteamVrInfo, SlimeVrInstall } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function SoftwareStep() {
  const t = useAppStore((s) => s.t)
  const [steamvr, setSteamvr] = useState<SteamVrInfo | null>(null)
  const [slimevr, setSlimevr] = useState<SlimeVrInstall | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [sv, sl] = await Promise.all([
      window.api.steamvr.getInfo(),
      window.api.slimevr.getInstall()
    ])
    setSteamvr(sv)
    setSlimevr(sl)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const open = (url: string) => window.api.docs.openExternal(url)

  return (
    <StepShell title={t('step.software.title')}>
      <CheckRow
        label={t('step.software.steamvr')}
        status={loading ? 'running' : steamvr?.installed ? 'pass' : 'fail'}
        value={steamvr?.installed ? t('step.software.installed') : t('step.software.missing')}
        detail={steamvr?.installPath}
        action={
          !loading && !steamvr?.installed ? (
            <Button variant="secondary" onClick={() => open(LINKS.steamvr)}>
              {t('step.software.install')}
            </Button>
          ) : undefined
        }
      />
      <CheckRow
        label={t('step.software.slimevr')}
        status={loading ? 'running' : slimevr?.installed ? 'pass' : 'fail'}
        value={
          slimevr?.installed
            ? `${t('step.software.installed')}${slimevr.version ? ` · ${slimevr.version}` : ''}`
            : t('step.software.missing')
        }
        detail={slimevr?.installPath}
        action={
          !loading && !slimevr?.installed ? (
            <Button variant="secondary" onClick={() => open(LINKS.slimevrDownload)}>
              {t('step.software.install')}
            </Button>
          ) : undefined
        }
      />
      <div className="pt-2">
        <Button variant="secondary" onClick={load} disabled={loading}>
          {t('nav.recheck')}
        </Button>
      </div>
    </StepShell>
  )
}
