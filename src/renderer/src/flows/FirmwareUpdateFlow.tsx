import { useEffect, useMemo, useState } from 'react'
import type {
  FirmwareCatalog,
  FirmwareAsset,
  ReceiverFlashMethod,
  ReceiverInfo,
  ReceiverPort,
  FlashResult,
  BootloaderDrive
} from '@shared/types'
import { matchToLatest } from '@shared/firmware-match'
import { releaseCommitFor } from '@shared/firmware-naming'
import { DFU_PRESSES, LINKS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { CheckRow } from '../components/CheckRow'
import { FirmwarePicker } from '../components/FirmwarePicker'

type ReceiverPhase = 'connecting' | 'choosing' | 'none' | 'reading' | 'ready' | 'flashing' | 'result'

const DRIVE_POLL_MS = 2000
const DRIVE_TIMEOUT_MS = 40000

// .uf2 receivers flash by drive-copy; .hex/.zip go through nrfutil (DFU).
function methodForAsset(asset: FirmwareAsset | undefined): ReceiverFlashMethod {
  return asset && /\.uf2$/i.test(asset.name) ? 'uf2' : 'dfu-zip'
}

/**
 * The Firmware Update page: shows the latest VYRO firmware release, whether
 * the connected receiver and the live trackers are up to date, and updates
 * them.
 */
export function FirmwareUpdateFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  const live = useAppStore((s) => s.liveState)

  const [catalog, setCatalog] = useState<FirmwareCatalog | null>(null)

  // --- Receiver state -------------------------------------------------------
  const [phase, setPhase] = useState<ReceiverPhase>('connecting')
  const [ports, setPorts] = useState<ReceiverPort[]>([])
  const [selected, setSelected] = useState<ReceiverPort | null>(null)
  const [info, setInfo] = useState<ReceiverInfo | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [showReceiverUpdate, setShowReceiverUpdate] = useState(false)
  const [receiverAsset, setReceiverAsset] = useState<FirmwareAsset | undefined>()
  const [nrfutilOk, setNrfutilOk] = useState(true)
  const [receiverAck, setReceiverAck] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<FlashResult | null>(null)

  // --- Tracker state --------------------------------------------------------
  const [showTrackerUpdate, setShowTrackerUpdate] = useState(false)
  const [trackerAsset, setTrackerAsset] = useState<FirmwareAsset | undefined>()
  const [trackerAck, setTrackerAck] = useState(false)
  const [drives, setDrives] = useState<BootloaderDrive[]>([])
  const [trackerFlashing, setTrackerFlashing] = useState(false)
  const [trackerResult, setTrackerResult] = useState<FlashResult | null>(null)

  const assets = useMemo(() => catalog?.recommended?.assets ?? [], [catalog])
  const latestReceiverCommit = useMemo(() => releaseCommitFor(assets, 'receiver'), [assets])
  const latestTrackerCommit = useMemo(() => releaseCommitFor(assets, 'tracker'), [assets])

  const receiverMatch = useMemo(
    () => matchToLatest(info?.commit ?? info?.firmwareVersion, latestReceiverCommit),
    [info, latestReceiverCommit]
  )

  const readInfo = async (port: ReceiverPort): Promise<void> => {
    setSelected(port)
    setPhase('reading')
    setInfo(await window.api.receiver.readInfo(port.path))
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

  // Watch for a tracker in bootloader mode while its update panel is open.
  useEffect(() => {
    if (!showTrackerUpdate) return
    const poll = () => window.api.firmware.detectBootloaderDrives().then(setDrives)
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [showTrackerUpdate])

  const waitForBootloaderDrive = async (): Promise<string | null> => {
    const deadline = Date.now() + DRIVE_TIMEOUT_MS
    while (Date.now() < deadline) {
      const found = await window.api.firmware.detectBootloaderDrives()
      if (found.length > 0) return found[0].drive
      await new Promise((r) => setTimeout(r, DRIVE_POLL_MS))
    }
    return null
  }

  const updateReceiver = async (): Promise<void> => {
    const method = methodForAsset(receiverAsset)
    if (!selected || !receiverAsset) return
    setPhase('flashing')
    setResult(null)

    setProgress(t('fwupdate.progress.dfu'))
    await window.api.receiver.enterDfu(selected.path)

    let res: FlashResult
    if (method === 'uf2') {
      setProgress(t('fwupdate.progress.drive'))
      const drive = await waitForBootloaderDrive()
      res = drive
        ? await window.api.firmware.autoFlash({
            assetUrl: receiverAsset.downloadUrl,
            assetName: receiverAsset.name,
            targetDrive: drive
          })
        : { ok: false, message: t('fwupdate.nodrive') }
    } else {
      setProgress(t('fwupdate.progress.nrfutil'))
      res = await window.api.firmware.flashReceiverDfu({
        assetUrl: receiverAsset.downloadUrl,
        assetName: receiverAsset.name
      })
    }
    setResult(res)
    setPhase('result')
  }

  const flashTracker = async (drive: string): Promise<void> => {
    if (!trackerAsset) return
    setTrackerFlashing(true)
    setTrackerResult(null)
    const res = await window.api.firmware.autoFlash({
      assetUrl: trackerAsset.downloadUrl,
      assetName: trackerAsset.name,
      targetDrive: drive
    })
    setTrackerResult(res)
    setTrackerFlashing(false)
  }

  const open = (url: string): void => void window.api.docs.openExternal(url)

  const receiverMethod = methodForAsset(receiverAsset)
  // A raw .hex can't be flashed over USB — the DFU path needs a .zip package.
  const receiverIsRawHex = Boolean(receiverAsset && /\.hex$/i.test(receiverAsset.name))
  const canUpdateReceiver =
    Boolean(receiverAsset) && !receiverIsRawHex && (receiverMethod !== 'dfu-zip' || nrfutilOk)
  const receiverNeedsUpdate = receiverMatch.status !== 'match'

  const sectionClass = 'space-y-3 rounded-lg border border-surface-border bg-surface-raised p-4'
  const sectionTitle = (label: string): JSX.Element => (
    <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</div>
  )

  // Fields shown for the receiver's installed firmware, in display order.
  const infoRows: { label: string; value?: string }[] = info
    ? [
        { label: t('fwupdate.receiver.version'), value: info.firmwareVersion },
        { label: t('fwupdate.receiver.commit'), value: info.commit },
        { label: t('fwupdate.receiver.builddate'), value: info.buildDate },
        { label: t('fwupdate.receiver.board'), value: info.board }
      ].filter((row) => Boolean(row.value))
    : []

  return (
    <FlowShell title={t('fwupdate.title')} onExit={onExit}>
      <div className="space-y-4">
        {/* ------------------------------------------------ Latest release */}
        <div className={sectionClass}>
          {sectionTitle(t('fwupdate.latest'))}
          {!catalog ? (
            <StatusBadge status="running" label={t('fwupdate.latest.loading')} />
          ) : !catalog.configured ? (
            <p className="text-sm text-amber-300">
              {t('fwupdate.latest.error')}
              {catalog.error ? ` (${catalog.error})` : ''}
            </p>
          ) : (
            <>
              <div className="text-base font-semibold text-slate-100">
                {catalog.recommended?.name}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                {latestReceiverCommit && (
                  <span>
                    {t('fwupdate.latest.receiver')}{' '}
                    <span className="font-mono text-slate-200">{latestReceiverCommit}</span>
                  </span>
                )}
                {latestTrackerCommit && (
                  <span>
                    {t('fwupdate.latest.tracker')}{' '}
                    <span className="font-mono text-slate-200">{latestTrackerCommit}</span>
                  </span>
                )}
              </div>
              <button
                className="text-xs text-slate-500 hover:text-slate-300"
                onClick={() => open(LINKS.firmwareRepo)}
              >
                {t('fwupdate.latest.view')} →
              </button>
            </>
          )}
        </div>

        {/* ------------------------------------------------------ Receiver */}
        <div className={sectionClass}>
          {sectionTitle(t('fwupdate.receiver.section'))}

          {phase === 'connecting' && (
            <StatusBadge status="running" label={t('fwupdate.receiver.searching')} />
          )}

          {phase === 'choosing' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">{t('fwupdate.receiver.choose')}</p>
              {ports.map((p) => (
                <div
                  key={p.path}
                  className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface px-4 py-3"
                >
                  <span className="text-sm text-slate-100">{p.label}</span>
                  <Button variant="secondary" onClick={() => readInfo(p)}>
                    {t('fwupdate.receiver.use')}
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
                {t('fwupdate.rescan')}
              </Button>
            </div>
          )}

          {phase === 'reading' && (
            <StatusBadge status="running" label={t('fwupdate.receiver.reading')} />
          )}

          {phase === 'ready' && info && (
            <div className="space-y-3">
              {infoRows.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {infoRows.map((row) => (
                    <div key={row.label} className="contents">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-mono text-slate-100">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                  <strong>{t('fwupdate.receiver.unknownfw')}</strong>
                  <p className="mt-1">{t('fwupdate.receiver.unknownfw.hint')}</p>
                </div>
              )}

              {/* Raw console output for support/diagnostics. */}
              {info.raw.trim() && (
                <div>
                  <button
                    className="text-xs text-slate-500 hover:text-slate-300"
                    onClick={() => setShowConsole((v) => !v)}
                  >
                    {showConsole ? '▾ ' : '▸ '}
                    {t('fwupdate.receiver.showconsole')}
                  </button>
                  {showConsole && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-surface px-3 py-2 text-xs text-slate-400">
                      {info.raw.trim()}
                    </pre>
                  )}
                </div>
              )}

              <CheckRow
                label={t('fwupdate.status')}
                status={
                  receiverMatch.status === 'match'
                    ? 'pass'
                    : receiverMatch.status === 'mismatch'
                      ? 'warn'
                      : 'pending'
                }
                value={
                  receiverMatch.status === 'match'
                    ? t('fwupdate.uptodate')
                    : receiverMatch.status === 'mismatch'
                      ? t('fwupdate.outdated')
                      : t('fwupdate.unknown')
                }
                detail={
                  receiverMatch.status === 'mismatch'
                    ? t('fwupdate.outdated.detail', {
                        current: receiverMatch.current ?? '?',
                        latest: receiverMatch.latest ?? '?'
                      })
                    : undefined
                }
              />

              <div className="flex gap-3">
                <Button variant="secondary" onClick={search}>
                  {t('fwupdate.rescan')}
                </Button>
                {!receiverNeedsUpdate && !showReceiverUpdate && (
                  <Button variant="ghost" onClick={() => setShowReceiverUpdate(true)}>
                    {t('fwupdate.reinstall')}
                  </Button>
                )}
              </div>

              {(receiverNeedsUpdate || showReceiverUpdate) && (
                <div className="space-y-3 rounded-lg border border-surface-border bg-surface p-4">
                  <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                    {t('step.firmware.warning')}
                  </div>

                  {/* Board → exact file. The flash method (UF2 drive vs
                      hex/DFU) follows the chosen file's type. */}
                  <FirmwarePicker
                    assets={assets}
                    kind="receiver"
                    detectFrom={info.board ?? info.raw}
                    onChange={setReceiverAsset}
                  />

                  {!receiverAsset && (
                    <p className="text-sm text-slate-500">{t('fwupdate.noasset')}</p>
                  )}
                  {receiverIsRawHex && (
                    <p className="text-sm text-rose-300">{t('fwupdate.hexonly')}</p>
                  )}
                  {!receiverIsRawHex && receiverMethod === 'dfu-zip' && !nrfutilOk && (
                    <p className="text-sm text-rose-300">{t('fwupdate.nonrfutil')}</p>
                  )}

                  <label className="flex items-start gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={receiverAck}
                      onChange={(e) => setReceiverAck(e.target.checked)}
                    />
                    <span>{t('fwupdate.ack')}</span>
                  </label>

                  <Button
                    variant="danger"
                    disabled={!canUpdateReceiver || !receiverAck}
                    onClick={updateReceiver}
                  >
                    {t('fwupdate.update')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {phase === 'flashing' && (
            <div className="space-y-2">
              <StatusBadge status="running" label={t('fwupdate.updating')} />
              {progress && <p className="text-sm text-slate-400">{progress}</p>}
              <p className="text-xs text-amber-300">{t('fwupdate.dontunplug')}</p>
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
              <Button variant="secondary" onClick={search}>
                {t('fwupdate.rescan')}
              </Button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ Trackers */}
        <div className={sectionClass}>
          {sectionTitle(t('fwupdate.trackers.section'))}

          {live.trackers.length === 0 ? (
            <p className="text-sm text-slate-400">{t('fwupdate.trackers.none')}</p>
          ) : (
            <div className="space-y-2">
              {live.trackers.map((tr) => {
                const m = matchToLatest(tr.firmwareVersion, latestTrackerCommit)
                return (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between gap-3 rounded border border-surface-border bg-surface px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-100">{tr.name}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {tr.firmwareVersion ?? t('fwupdate.trackers.unknownfw')}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${
                        m.status === 'match'
                          ? 'text-emerald-300'
                          : m.status === 'mismatch'
                            ? 'text-amber-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {m.status === 'match'
                        ? t('fwupdate.uptodate')
                        : m.status === 'mismatch'
                          ? t('fwupdate.outdated')
                          : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {!showTrackerUpdate ? (
            <Button variant="secondary" onClick={() => setShowTrackerUpdate(true)}>
              {t('fwupdate.trackers.update')}
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-surface-border bg-surface p-4">
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                {t('step.firmware.warning')}
              </div>

              <FirmwarePicker assets={assets} kind="tracker" onChange={setTrackerAsset} />

              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
                <li>{t('fwupdate.trackers.step.connect')}</li>
                <li>{t('fwupdate.trackers.step.dfu', { presses: DFU_PRESSES })}</li>
                <li>{t('fwupdate.trackers.step.flash')}</li>
              </ol>

              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={trackerAck}
                  onChange={(e) => setTrackerAck(e.target.checked)}
                />
                <span>{t('fwupdate.ack')}</span>
              </label>

              {trackerAck &&
                (drives.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t('fwupdate.trackers.nodrive', { presses: DFU_PRESSES })}
                  </p>
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
                          disabled={trackerFlashing || !trackerAsset}
                          onClick={() => flashTracker(d.drive)}
                        >
                          {trackerFlashing
                            ? t('fwupdate.updating')
                            : t('fwupdate.trackers.flash', { drive: d.drive })}
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}

              {trackerAsset && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => open(trackerAsset.downloadUrl)}
                >
                  {t('fw.pick.download', { name: trackerAsset.name })} →
                </button>
              )}

              {trackerResult && (
                <p
                  className={`text-sm ${trackerResult.ok ? 'text-emerald-300' : 'text-rose-300'}`}
                >
                  {trackerResult.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </FlowShell>
  )
}
