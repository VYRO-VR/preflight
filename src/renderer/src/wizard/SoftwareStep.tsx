import { useEffect, useState } from 'react'
import { LINKS } from '@shared/config'
import type { SteamVrInfo, SlimeVrInstall } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { CheckRow } from '../components/CheckRow'
import { Button } from '../components/Button'

export function SoftwareStep() {
  const t = useAppStore((s) => s.t)
  // SlimeVR "running" is detected by a live connection to its server, which
  // works for both the Steam and standalone builds regardless of install path.
  const live = useAppStore((s) => s.liveState)
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
    // Keep retrying the SlimeVR connection while the user launches it.
    window.api.slimevr.connect()
  }, [])

  const open = (url: string) => window.api.docs.openExternal(url)

  return (
    <StepShell title={t('step.software.title')}>
      <CheckRow
        label={t('step.software.steamvr')}
        status={loading ? 'running' : steamvr?.installed ? 'pass' : 'warn'}
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
        status={live.connected ? 'pass' : 'fail'}
        value={
          live.connected
            ? `${t('step.software.running')}${
                live.serverVersion ? ` · ${live.serverVersion}` : ''
              }`
            : t('step.software.notrunning')
        }
        detail={
          live.connected
            ? slimevr?.installPath
            : t('step.software.slimevr.hint')
        }
        action={
          !live.connected ? (
            <Button variant="secondary" onClick={() => open(LINKS.slimevrDownload)}>
              {t('step.software.getslimevr')}
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
