import { useEffect, useState } from 'react'
import { DFU_PRESSES, LINKS } from '@shared/config'
import type { FirmwareCatalog, BootloaderDrive, FlashResult } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { Button } from '../components/Button'

const dfuPresses = DFU_PRESSES

export function FirmwareStep() {
  const t = useAppStore((s) => s.t)
  const live = useAppStore((s) => s.liveState)
  const [catalog, setCatalog] = useState<FirmwareCatalog | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [drives, setDrives] = useState<BootloaderDrive[]>([])
  const [flashing, setFlashing] = useState(false)
  const [result, setResult] = useState<FlashResult | null>(null)

  useEffect(() => {
    window.api.firmware.getCatalog().then(setCatalog)
  }, [])

  useEffect(() => {
    if (!showAdvanced) return
    const poll = () => window.api.firmware.detectBootloaderDrives().then(setDrives)
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [showAdvanced])

  const recommended = catalog?.recommended
  const asset = recommended?.assets[0]

  const open = (url: string) => window.api.docs.openExternal(url)

  const onFlash = async (drive: string) => {
    if (!asset) return
    setFlashing(true)
    setResult(null)
    const res = await window.api.firmware.autoFlash({
      assetUrl: asset.downloadUrl,
      assetName: asset.name,
      targetDrive: drive
    })
    setResult(res)
    setFlashing(false)
  }

  return (
    <StepShell title={t('step.firmware.title')}>
      {/* Soft-brick warning is always visible. */}
      <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
        {t('step.firmware.warning')}
      </div>

      {!catalog || !catalog.configured ? (
        <p className="text-sm text-slate-400">
          {t('step.firmware.notconfigured')}
          {catalog?.error ? ` (${catalog.error})` : ''}
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
            <div className="text-xs uppercase text-slate-500">{t('step.firmware.recommended')}</div>
            <div className="mt-0.5 text-base font-semibold text-slate-100">
              {recommended?.name} <span className="text-brand-300">({recommended?.tag})</span>
            </div>
            {live.trackers.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                {live.trackers.map((tr) => (
                  <li key={tr.id}>
                    {tr.name}: fw {tr.firmwareVersion ?? 'unknown'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Guided (default) path */}
          <div className="space-y-2 rounded-lg border border-surface-border bg-surface-raised p-4">
            <div className="text-sm font-semibold text-slate-100">{t('step.firmware.guided')}</div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
              <li>Connect the tracker to your PC with a data USB cable.</li>
              <li>Press the button {dfuPresses}× to enter DFU mode (a removable drive appears).</li>
              <li>Download the recommended firmware file below.</li>
              <li>Copy the .uf2 onto the tracker drive — it reboots automatically.</li>
            </ol>
            {asset && (
              <Button variant="primary" onClick={() => open(asset.downloadUrl)}>
                Download {asset.name}
              </Button>
            )}
          </div>

          {/* Advanced auto-flash (opt-in) */}
          <div className="space-y-3 rounded-lg border border-surface-border bg-surface-raised p-4">
            <button
              className="text-sm font-semibold text-brand-300 hover:text-brand-200"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▾ ' : '▸ '}
              {t('step.firmware.advanced')}
            </button>

            {showAdvanced && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  <span>I understand updating may soft-brick the tracker and accept the risk.</span>
                </label>

                {acknowledged &&
                  (drives.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('step.firmware.nodrive')}</p>
                  ) : (
                    <div className="space-y-2">
                      {drives.map((d) => (
                        <div
                          key={d.drive}
                          className="flex items-center justify-between rounded border border-surface-border px-3 py-2"
                        >
                          <span className="text-sm text-slate-200">
                            {d.drive} <span className="text-slate-500">({d.volumeLabel})</span>
                          </span>
                          <Button
                            variant="danger"
                            disabled={flashing || !asset}
                            onClick={() => onFlash(d.drive)}
                          >
                            {flashing ? 'Flashing…' : t('step.firmware.flash', { drive: d.drive })}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}

                {result && (
                  <p className={`text-sm ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {result.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <button
        className="text-xs text-slate-500 hover:text-slate-300"
        onClick={() => open(LINKS.firmwareRepo)}
      >
        View all firmware releases →
      </button>
    </StepShell>
  )
}
