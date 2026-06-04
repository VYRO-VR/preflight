import { useEffect, useState } from 'react'
import type {
  FirmwareCatalog,
  FirmwareMatch,
  FirmwareAsset,
  ReceiverFlashMethod,
  ReceiverInfo,
  ReceiverPort,
  FlashResult
} from '@shared/types'
import { matchFirmware } from '@shared/firmware-match'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { CheckRow } from '../components/CheckRow'
import { FirmwarePicker } from '../components/FirmwarePicker'

type Phase = 'connecting' | 'choosing' | 'none' | 'reading' | 'ready' | 'flashing' | 'result'

const DRIVE_POLL_MS = 2000
const DRIVE_TIMEOUT_MS = 40000

// .uf2 receivers flash by drive-copy; .hex/.zip go through nrfutil (DFU).
function methodForAsset(asset: FirmwareAsset | undefined): ReceiverFlashMethod {
  return asset && /\.uf2$/i.test(asset.name) ? 'uf2' : 'dfu-zip'
}

export function ReceiverUpdateFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  const live = useAppStore((s) => s.liveState)

  const [phase, setPhase] = useState<Phase>('connecting')
  const [ports, setPorts] = useState<ReceiverPort[]>([])
  const [selected, setSelected] = useState<ReceiverPort | null>(null)
  const [info, setInfo] = useState<ReceiverInfo | null>(null)
  const [match, setMatch] = useState<FirmwareMatch | null>(null)
  const [catalog, setCatalog] = useState<FirmwareCatalog | null>(null)
  const [asset, setAsset] = useState<FirmwareAsset | undefined>()
  const [nrfutilOk, setNrfutilOk] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<FlashResult | null>(null)

  const readInfo = async (port: ReceiverPort): Promise<void> => {
    setSelected(port)
    setPhase('reading')
    const received = await window.api.receiver.readInfo(port.path)
    setInfo(received)
    setMatch(matchFirmware(received, live.trackers.map((tr) => tr.firmwareVersion)))
    setPhase('ready')
  }

  const dispatchPorts = (found: ReceiverPort[]): void => {
    setPorts(found)
    if (found.length === 1) readInfo(found[0])
    else if (found.length === 0) setPhase('none')
    else setPhase('choosing')
  }

  const search = async (): Promise<void> => {
    setPhase('connecting')
    dispatchPorts(await window.api.receiver.list())
  }

  useEffect(() => {
    window.api.firmware.getCatalog().then(setCatalog)
    window.api.firmware.nrfutilAvailable().then(setNrfutilOk)
    window.api.receiver.list().then(dispatchPorts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const waitForBootloaderDrive = async (): Promise<string | null> => {
    const deadline = Date.now() + DRIVE_TIMEOUT_MS
    while (Date.now() < deadline) {
      const drives = await window.api.firmware.detectBootloaderDrives()
      if (drives.length > 0) return drives[0].drive
      await new Promise((r) => setTimeout(r, DRIVE_POLL_MS))
    }
    return null
  }

  const update = async (): Promise<void> => {
    const method = methodForAsset(asset)
    if (!selected || !asset) return
    setPhase('flashing')
    setResult(null)

    setProgress('Putting the receiver into update mode…')
    await window.api.receiver.enterDfu(selected.path)

    let res: FlashResult
    if (method === 'uf2') {
      setProgress('Waiting for the receiver to appear as a drive…')
      const drive = await waitForBootloaderDrive()
      res = drive
        ? await window.api.firmware.autoFlash({
            assetUrl: asset.downloadUrl,
            assetName: asset.name,
            targetDrive: drive
          })
        : { ok: false, message: t('receiver.update.nodrive') }
    } else {
      setProgress('Flashing with nrfutil…')
      res = await window.api.firmware.flashReceiverDfu({
        assetUrl: asset.downloadUrl,
        assetName: asset.name
      })
    }
    setResult(res)
    setPhase('result')
  }

  const method = methodForAsset(asset)
  const canUpdate = Boolean(asset) && (method !== 'dfu-zip' || nrfutilOk)

  return (
    <FlowShell title={t('receiver.update.title')} onExit={onExit}>
      {phase === 'connecting' && (
        <StatusBadge status="running" label={t('receiver.update.searching')} />
      )}

      {phase === 'choosing' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{t('receiver.update.choose')}</p>
          {ports.map((p) => (
            <div
              key={p.path}
              className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
            >
              <span className="text-sm text-slate-100">{p.label}</span>
              <Button variant="secondary" onClick={() => readInfo(p)}>
                {t('receiver.update.use')}
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

      {phase === 'reading' && (
        <StatusBadge status="running" label={t('receiver.update.reading')} />
      )}

      {phase === 'ready' && match && (
        <div className="space-y-3">
          <CheckRow
            label={t('receiver.update.receiverfw')}
            status="pass"
            value={info?.firmwareVersion ?? info?.buildDate ?? t('receiver.update.unknownfw')}
          />
          <CheckRow
            label={t('receiver.update.status')}
            status={match.status === 'match' ? 'pass' : match.status === 'mismatch' ? 'warn' : 'pending'}
            value={
              match.status === 'match'
                ? t('receiver.update.uptodate')
                : match.status === 'mismatch'
                  ? t('receiver.update.mismatch')
                  : t('receiver.update.cantcompare')
            }
            detail={
              match.status === 'mismatch'
                ? t('receiver.update.mismatch.detail', {
                    receiver: match.receiverBuildDate ?? '?',
                    trackers: match.trackerBuildDate ?? '?'
                  })
                : undefined
            }
          />

          {match.status !== 'match' && (
            <div className="space-y-3 rounded-lg border border-surface-border bg-surface-raised p-4">
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                {t('step.firmware.warning')}
              </div>

              {/* Pick the receiver board + options → exact file. The flash
                  method (UF2 drive vs hex/DFU) follows the chosen file's type. */}
              <FirmwarePicker
                assets={catalog?.recommended?.assets ?? []}
                kind="receiver"
                detectFrom={info?.raw}
                onChange={(a) => setAsset(a)}
              />

              {!asset && <p className="text-sm text-slate-500">{t('receiver.update.noasset')}</p>}
              {method === 'dfu-zip' && !nrfutilOk && (
                <p className="text-sm text-rose-300">{t('receiver.update.nonrfutil')}</p>
              )}

              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>{t('receiver.update.ack')}</span>
              </label>

              <Button variant="danger" disabled={!canUpdate || !acknowledged} onClick={update}>
                {t('receiver.update.flash')}
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === 'flashing' && (
        <div className="space-y-2">
          <StatusBadge status="running" label={t('receiver.update.flashing')} />
          {progress && <p className="text-sm text-slate-400">{progress}</p>}
          <p className="text-xs text-amber-300">{t('receiver.update.dontunplug')}</p>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="space-y-3">
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-700/50 bg-rose-950/30 text-rose-200'
            }`}
          >
            {result.message}
          </div>
          <Button variant="secondary" onClick={onExit}>
            {t('pair.done')}
          </Button>
        </div>
      )}
    </FlowShell>
  )
}
