import { useCallback, useEffect, useRef, useState } from 'react'
import { SENS_CAL } from '@shared/config'
import { matchSlotToTracker } from '@shared/receiver-slots'
import {
  emptyAccumulator,
  emptyCorrections,
  formatSensValue,
  initialSendState,
  isStill,
  measureSpin,
  offAxisLevel,
  pushRotation,
  reduceSend,
  scaleFromCorrection,
  sensSetValues,
  turnsMeasured,
  verifySpin,
  type SendState,
  type SensCorrections,
  type SpinMeasurement,
  type TurnAccumulator,
  type VerificationResult
} from '@shared/sens-cal'
import {
  captureReference,
  pinHeading,
  placementMatches,
  readPlacement,
  trackerPose,
  type PlacementReading,
  type TrackerFrame
} from '@shared/tracker-frame'
import type {
  Quaternion,
  ReceiverPort,
  ReceiverSlot,
  SensCalAxis,
  SensCalPlacement,
  TrackerInfo
} from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { useLiveFeedRate } from '../hooks/useLiveFeedRate'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { TrackerPreview } from '../components/TrackerPreview'
import type { TranslationKey } from '../i18n'

/**
 * Guided gyro sensitivity calibration.
 *
 * Per gyro axis: the user stands the tracker so that axis is vertical, spins
 * it a known number of turns against a repeatable edge, and puts it back.
 * The app measures how far the tracker thought it turned, shows the error,
 * and writes the correction to the tracker through the receiver. There is no
 * pace to keep and no timeout — the firmware's own timed `sens auto` run is
 * not used. See `@shared/sens-cal` for the maths and the ack fold.
 *
 * Before any of that, the tracker is laid flat with the button up so the
 * preview can be shown in the tracker's *physical* frame
 * (`@shared/tracker-frame`); the same reference lets each placement be
 * checked live before a spin starts.
 */

type Stage =
  | 'connecting'
  | 'choose-port'
  | 'no-port'
  | 'error'
  | 'pick'
  | 'confirm'
  | 'reference'
  | 'place'
  | 'zeroing'
  | 'spin'
  | 'measured'
  | 'applying'
  | 'send-failed'
  | 'verify'
  | 'axis-result'
  | 'done'

type AxisOutcome = 'pending' | 'applied' | 'verified' | 'unverified' | 'skipped'

/** Why a `sens` write is in flight, so the ack knows where to go next. */
type SendPurpose = 'zero' | 'apply'

/** How often the send fold gets a clock tick while a write is in flight. */
const TICK_MS = 200

const PLACEMENTS = SENS_CAL.placements

export function SensCalFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  const trackers = useAppStore((s) => s.liveState.trackers)
  // Orientation drives the counter and the preview, so ask for the fast feed
  // for as long as this flow is open.
  useLiveFeedRate()

  const [stage, setStage] = useState<Stage>('connecting')
  const [ports, setPorts] = useState<ReceiverPort[]>([])
  const [slots, setSlots] = useState<ReceiverSlot[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const [trackerId, setTrackerId] = useState<string | null>(null)
  const [slot, setSlot] = useState<number | null>(null)
  const [frame, setFrame] = useState<TrackerFrame | null>(null)
  const [placementIndex, setPlacementIndex] = useState(0)
  const [corrections, setCorrections] = useState<SensCorrections>(emptyCorrections())
  const [outcomes, setOutcomes] = useState<Record<SensCalAxis, AxisOutcome>>({
    x: 'pending',
    y: 'pending',
    z: 'pending'
  })

  const [acc, setAcc] = useState<TurnAccumulator>(emptyAccumulator())
  const [send, setSend] = useState<SendState>(initialSendState())
  const [sendPurpose, setSendPurpose] = useState<SendPurpose>('zero')
  const [measurement, setMeasurement] = useState<SpinMeasurement | null>(null)
  const [verification, setVerification] = useState<VerificationResult | null>(null)

  const { placement, axis } = PLACEMENTS[placementIndex]
  const tracker = trackers.find((x) => x.id === trackerId)
  const rotation = tracker?.rotation
  const pose = frame && rotation ? trackerPose(frame, rotation) : rotation
  const reading: PlacementReading | null = frame && rotation ? readPlacement(frame, rotation) : null

  const fail = useCallback((message: string): void => {
    setErrorMsg(message)
    setStage('error')
  }, [])

  // -- connect ------------------------------------------------------------

  const openPort = useCallback(
    async (path: string): Promise<void> => {
      setStage('connecting')
      try {
        await window.api.receiver.openConsole(path)
        setSlots(await window.api.receiver.listSlots())
        setStage('pick')
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e))
      }
    },
    [fail]
  )

  const search = useCallback(async (): Promise<void> => {
    setStage('connecting')
    const found = await window.api.receiver.list()
    setPorts(found)
    if (found.length === 1) void openPort(found[0].path)
    else setStage(found.length === 0 ? 'no-port' : 'choose-port')
  }, [openPort])

  useEffect(() => {
    void search()
    // Always release the port when the flow closes. Corrections already
    // written are on the tracker's flash; nothing is left half-done.
    return () => {
      void window.api.receiver.closeConsole()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -- live rotation into the accumulator ------------------------------------

  const liveStages: Stage[] = ['reference', 'place', 'spin', 'verify']
  const isLive = liveStages.includes(stage)

  useEffect(() => {
    if (!isLive || !trackerId) return
    const unsubscribe = useAppStore.subscribe((state) => {
      const quat = state.liveState.trackers.find((x) => x.id === trackerId)?.rotation
      if (!quat) return
      // The main process's arrival stamp, so renderer lag never reads as a
      // feed gap; a store change that carries no new sample repeats the stamp
      // and the accumulator ignores it.
      setAcc((a) => pushRotation(a, quat, state.liveState.atMs ?? performance.now()))
    })
    return unsubscribe
  }, [isLive, trackerId])

  // Reference capture: once the tracker has held still long enough, the pose
  // it is holding *is* "flat, button up".
  const stillSinceRef = useRef<number | null>(null)
  useEffect(() => {
    if (stage !== 'reference' || frame) return
    if (!isStill(acc) || !acc.lastQuat) {
      stillSinceRef.current = null
      return
    }
    const now = performance.now()
    if (stillSinceRef.current === null) {
      stillSinceRef.current = now
      return
    }
    if (now - stillSinceRef.current >= SENS_CAL.stillDwellMs) {
      setFrame(captureReference(acc.lastQuat))
    }
  }, [stage, acc, frame])

  // -- send / ack ------------------------------------------------------------

  // The receiver's ack is the only confirmation that the command was queued,
  // and it can land before an effect keyed on the sending stage would have
  // subscribed — so listen for the whole life of the flow. The fold ignores
  // console lines while nothing is in flight.
  useEffect(() => {
    return window.api.receiver.onConsoleEvent((event) => {
      if (event.type === 'line') {
        setSend((s) =>
          reduceSend(s, { type: 'console', line: event.line, atMs: performance.now() })
        )
      } else if (event.type === 'error') {
        fail(event.message)
      }
    })
  }, [fail])

  const sending = stage === 'zeroing' || stage === 'applying'
  useEffect(() => {
    if (!sending) return
    const id = setInterval(
      () => setSend((s) => reduceSend(s, { type: 'tick', atMs: performance.now() })),
      TICK_MS
    )
    return () => clearInterval(id)
  }, [sending])

  useEffect(() => {
    if (!sending) return
    if (send.phase === 'acked') {
      setAcc(emptyAccumulator())
      if (sendPurpose === 'zero') {
        setStage('spin')
      } else {
        setOutcomes((o) => ({ ...o, [axis]: 'applied' }))
        setVerification(null)
        setStage('verify')
      }
    } else if (send.phase === 'failed') {
      setStage('send-failed')
    }
  }, [sending, send.phase, sendPurpose, axis])

  const writeSens = async (
    purpose: SendPurpose,
    values: [number, number, number]
  ): Promise<void> => {
    if (slot === null) return
    setSendPurpose(purpose)
    setStage(purpose === 'zero' ? 'zeroing' : 'applying')
    try {
      await window.api.receiver.setSens({ slot, values })
      setSend((s) => reduceSend(s, { type: 'sent', slot, values, atMs: performance.now() }))
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
  }

  // -- actions --------------------------------------------------------------

  const pickTracker = (candidate: TrackerInfo): void => {
    setTrackerId(candidate.id)
    const match = slots
      .map((s) => matchSlotToTracker(s, trackers))
      .find((m) => m.confident && m.trackerId === candidate.id)
    setSlot(match ? match.slot : null)
    setStage('confirm')
  }

  const startReference = (): void => {
    setFrame(null)
    stillSinceRef.current = null
    setAcc(emptyAccumulator())
    setStage('reference')
  }

  const startSpin = (): void => {
    // The long edge is the pose the preview's heading is pinned from: from
    // here on the slab's long and short sides match the case.
    if (placement === 'long-edge' && frame && !frame.headingPinned && rotation) {
      setFrame(pinHeading(frame, rotation))
    }
    // Measure against no correction on this axis — the value written before
    // (or whatever the tracker shipped with) would otherwise be measured in.
    void writeSens('zero', sensSetValues(corrections, axis))
  }

  const finishSpin = (): void => {
    setMeasurement(measureSpin(acc, SENS_CAL.revolutions))
    setStage('measured')
  }

  const applyMeasurement = (): void => {
    if (!measurement) return
    const next = { ...corrections, [axis]: measurement.correctionDeg }
    setCorrections(next)
    void writeSens('apply', sensSetValues(next))
  }

  const retrySend = (): void => {
    void writeSens(
      sendPurpose,
      sendPurpose === 'zero' ? sensSetValues(corrections, axis) : sensSetValues(corrections)
    )
  }

  const nextPlacement = (): void => {
    setMeasurement(null)
    setVerification(null)
    setAcc(emptyAccumulator())
    if (placementIndex + 1 < PLACEMENTS.length) {
      setPlacementIndex(placementIndex + 1)
      setStage('place')
    } else {
      setStage('done')
    }
  }

  const skipAxis = (): void => {
    setOutcomes((o) => ({ ...o, [axis]: 'skipped' }))
    setCorrections((c) => ({ ...c, [axis]: null }))
    nextPlacement()
  }

  const redoAxis = (): void => {
    setMeasurement(null)
    setVerification(null)
    setAcc(emptyAccumulator())
    setOutcomes((o) => ({ ...o, [axis]: 'pending' }))
    setStage('place')
  }

  // -- render ---------------------------------------------------------------

  const placementTitleKey = `senscal.placement.${placement}.title` as TranslationKey
  const placementBodyKey = `senscal.placement.${placement}.body` as TranslationKey
  const placementOk = reading !== null && placementMatches(reading, placement)

  return (
    <FlowShell title={t('senscal.title')} description={t('senscal.subtitle')} onExit={onExit}>
      {stage === 'connecting' && (
        <StatusBadge status="running" label={t('senscal.connect.searching')} />
      )}

      {stage === 'choose-port' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{t('senscal.connect.choose')}</p>
          {ports.map((p) => (
            <Row key={p.path} label={p.label}>
              <Button variant="secondary" onClick={() => openPort(p.path)}>
                {t('senscal.connect.use')}
              </Button>
            </Row>
          ))}
        </div>
      )}

      {stage === 'no-port' && (
        <Notice tone="warn" title={t('senscal.connect.none.title')}>
          <p>{t('senscal.connect.none.body')}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={search}>
              {t('senscal.connect.retry')}
            </Button>
          </div>
        </Notice>
      )}

      {stage === 'error' && (
        <Notice tone="error" title={t('senscal.error.title')}>
          <p>{errorMsg}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={search}>
              {t('senscal.error.retry')}
            </Button>
          </div>
        </Notice>
      )}

      {stage === 'pick' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{t('senscal.pick.body')}</p>
          <p className="text-xs text-slate-500">
            {t('senscal.pick.slots', { count: slots.length })}
          </p>
          {trackers.length === 0 && (
            <p className="text-sm text-amber-300">{t('senscal.pick.none')}</p>
          )}
          {trackers.map((candidate) => {
            const match = slots
              .map((s) => matchSlotToTracker(s, trackers))
              .find((m) => m.confident && m.trackerId === candidate.id)
            return (
              <Row
                key={candidate.id}
                label={
                  candidate.bodyPart ? `${candidate.name} — ${candidate.bodyPart}` : candidate.name
                }
                hint={
                  match
                    ? t('senscal.pick.suggested', { slot: match.slot })
                    : t('senscal.pick.unmatched')
                }
              >
                <Button variant="secondary" onClick={() => pickTracker(candidate)}>
                  {t('senscal.pick.select')}
                </Button>
              </Row>
            )
          })}
        </div>
      )}

      {stage === 'confirm' && tracker && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            {t('senscal.confirm.body', { name: tracker.name })}
          </p>
          <TrackerPreview rotation={rotation} fallbackText={t('senscal.preview.nowebgl')} />

          {/* The slot is inferred, never known. When the guess is missing the
              user picks it, and either way nothing is sent until they confirm. */}
          {slot === null ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-300">{t('senscal.pick.unmatched')}</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <Button key={s.slot} variant="secondary" onClick={() => setSlot(s.slot)}>
                    {s.slot} · {s.address}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t('senscal.confirm.slot', { slot })}</p>
          )}

          <div className="flex gap-3">
            <Button disabled={slot === null} onClick={startReference}>
              {t('senscal.confirm.yes')}
            </Button>
            <Button variant="ghost" onClick={() => setStage('pick')}>
              {t('senscal.confirm.no')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'reference' && (
        <div className="space-y-3">
          <Heading title={t('senscal.reference.title')} body={t('senscal.reference.body')} />
          <TrackerPreview rotation={pose} fallbackText={t('senscal.preview.nowebgl')} />
          {frame ? (
            <Notice tone="success" title={t('senscal.reference.title')}>
              <p>{t('senscal.reference.captured')}</p>
            </Notice>
          ) : (
            <StatusBadge status="running" label={t('senscal.reference.waiting')} />
          )}
          <div className="flex gap-3">
            <Button disabled={!frame} onClick={() => setStage('place')}>
              {t('senscal.reference.continue')}
            </Button>
            {frame && (
              <Button variant="ghost" onClick={startReference}>
                {t('senscal.reference.retake')}
              </Button>
            )}
          </div>
        </div>
      )}

      {stage === 'place' && (
        <div className="space-y-3">
          <Heading
            title={t(placementTitleKey)}
            body={t(placementBodyKey)}
            progress={t('senscal.axis.progress', {
              index: placementIndex + 1,
              total: PLACEMENTS.length,
              axis: axis.toUpperCase()
            })}
          />
          <TrackerPreview
            rotation={pose}
            highlightPlacement={placement}
            showSpinAxis
            fallbackText={t('senscal.preview.nowebgl')}
          />
          <ReadingLine reading={reading} ok={placementOk} />

          <Notice tone="info" title={t('senscal.place.title')}>
            <p>{t('senscal.place.edge')}</p>
            <p className="mt-2 text-slate-400">
              {t('senscal.place.why', { turns: SENS_CAL.revolutions })}
            </p>
            <p className="mt-2">{t('senscal.place.flat')}</p>
          </Notice>

          <div className="flex gap-3">
            <Button disabled={!placementOk} onClick={startSpin}>
              {t('senscal.place.start')}
            </Button>
            <Button variant="ghost" onClick={startReference}>
              {t('senscal.reference.retake')}
            </Button>
          </div>
        </div>
      )}

      {sending && (
        <StatusBadge
          status="running"
          label={stage === 'zeroing' ? t('senscal.send.zeroing') : t('senscal.send.applying')}
        />
      )}

      {stage === 'send-failed' && (
        <Notice tone="error" title={t('senscal.send.fail.title')}>
          <p>
            {send.failure === 'rejected'
              ? t('senscal.send.fail.rejected')
              : t('senscal.send.fail.noack')}
          </p>
          <div className="mt-3 flex gap-3">
            <Button onClick={retrySend}>{t('senscal.send.retry')}</Button>
            <Button
              variant="ghost"
              onClick={() => setStage(sendPurpose === 'zero' ? 'place' : 'measured')}
            >
              {t('senscal.send.back')}
            </Button>
          </div>
        </Notice>
      )}

      {stage === 'spin' && (
        <SpinPanel
          acc={acc}
          pose={pose}
          placement={placement}
          onDone={finishSpin}
          onRestart={() => setAcc(emptyAccumulator())}
          onCancel={() => setStage('place')}
        />
      )}

      {stage === 'measured' && measurement && (
        <div className="space-y-3">
          <MeasurementNotice result={measurement} axis={axis} />
          <div className="flex flex-wrap gap-3">
            {measurement.verdict === 'ok' && (
              <Button onClick={applyMeasurement}>{t('senscal.measured.apply')}</Button>
            )}
            <Button
              variant={measurement.verdict === 'ok' ? 'secondary' : 'primary'}
              onClick={() => {
                setMeasurement(null)
                setStage('place')
              }}
            >
              {t('senscal.measured.again')}
            </Button>
            <Button variant="ghost" onClick={skipAxis}>
              {t('senscal.measured.skip')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'verify' && (
        <div className="space-y-3">
          <Notice tone="info" title={t('senscal.verify.title')}>
            <p>{t('senscal.verify.body', { turns: SENS_CAL.revolutions })}</p>
          </Notice>
          <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-4">
            <div className="text-3xl font-semibold tabular-nums text-slate-50">
              {t('senscal.verify.turns', { turns: turnsMeasured(acc).toFixed(1) })}
            </div>
          </div>
          {verification && <VerificationNotice result={verification} />}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setAcc(emptyAccumulator())}>
              {t('senscal.verify.start')}
            </Button>
            <Button
              onClick={() => {
                const result = verifySpin(acc, SENS_CAL.revolutions)
                setVerification(result)
                if (result.withinClamp && result.gaps === 0) {
                  setOutcomes((o) => ({ ...o, [axis]: result.pass ? 'verified' : 'unverified' }))
                  setStage('axis-result')
                }
              }}
            >
              {t('senscal.verify.finish')}
            </Button>
            <Button variant="ghost" onClick={nextPlacement}>
              {t('senscal.verify.skip')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'axis-result' && (
        <div className="space-y-3">
          {verification && <VerificationNotice result={verification} />}
          <div className="flex gap-3">
            <Button onClick={nextPlacement}>
              {placementIndex + 1 < PLACEMENTS.length
                ? t('senscal.result.next')
                : t('senscal.result.finish')}
            </Button>
            <Button variant="ghost" onClick={redoAxis}>
              {t('senscal.result.rerun')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="space-y-3">
          <Notice tone="info" title={t('senscal.done.title')}>
            <p>{t('senscal.done.body')}</p>
          </Notice>
          {PLACEMENTS.map(({ axis: a }) => (
            <Row
              key={a}
              label={t('senscal.done.axis', { axis: a.toUpperCase() })}
              hint={outcomeText(t, outcomes[a], corrections[a])}
            />
          ))}
          <Button onClick={onExit}>{t('senscal.done.close')}</Button>
        </div>
      )}
    </FlowShell>
  )
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

/**
 * The live spin: the turn counter, the tilt coaching, and a Done button that
 * only unlocks on the last turn — the count is checked properly afterwards,
 * this just stops an early press.
 */
function SpinPanel({
  acc,
  pose,
  placement,
  onDone,
  onRestart,
  onCancel
}: {
  acc: TurnAccumulator
  pose?: Quaternion
  placement: SensCalPlacement
  onDone: () => void
  onRestart: () => void
  onCancel: () => void
}) {
  const t = useAppStore((s) => s.t)
  const target = SENS_CAL.revolutions
  const turns = turnsMeasured(acc)
  const offAxis = offAxisLevel(acc)
  const onLastTurn = turns >= target - 0.75
  const gapped = acc.gaps > 0

  return (
    <div className="space-y-3">
      <Heading
        title={t('senscal.spin.title', { turns: target })}
        body={t('senscal.spin.body', { turns: target })}
      />
      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="text-4xl font-semibold tabular-nums text-slate-50">
            {t('senscal.spin.turns', { turns: turns.toFixed(1), target })}
          </div>
          <div className="text-sm text-slate-400">
            {onLastTurn
              ? t('senscal.spin.ready')
              : t('senscal.spin.remaining', { turns: Math.max(0, target - turns).toFixed(1) })}
          </div>
        </div>

        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-border">
          <div
            className="h-full bg-brand-500 transition-[width] duration-150"
            style={{ width: `${Math.min(100, (turns / target) * 100)}%` }}
          />
        </div>

        {gapped ? (
          <p className="mt-2 text-sm text-rose-300">{t('senscal.spin.gap')}</p>
        ) : (
          offAxis !== 'ok' && (
            <p
              className={`mt-2 text-sm ${
                offAxis === 'reject' ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              {offAxis === 'reject'
                ? t('senscal.spin.offaxis.reject')
                : t('senscal.spin.offaxis.warn')}
            </p>
          )
        )}
      </div>

      <TrackerPreview
        rotation={pose}
        highlightPlacement={placement}
        showSpinAxis
        fallbackText={t('senscal.preview.nowebgl')}
      />

      <div className="flex flex-wrap gap-3">
        <Button disabled={!onLastTurn || gapped} onClick={onDone}>
          {t('senscal.spin.done')}
        </Button>
        <Button variant="secondary" onClick={onRestart}>
          {t('senscal.spin.restart')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('senscal.spin.cancel')}
        </Button>
      </div>
    </div>
  )
}

function MeasurementNotice({ result, axis }: { result: SpinMeasurement; axis: SensCalAxis }) {
  const t = useAppStore((s) => s.t)
  const turns = (result.measuredDeg / 360).toFixed(2)
  const target = (result.expectedDeg / 360).toFixed(0)

  if (result.verdict === 'gaps') {
    return (
      <Notice tone="warn" title={t('senscal.measured.title')}>
        <p>{t('senscal.measured.gaps')}</p>
      </Notice>
    )
  }
  if (result.verdict === 'miscount') {
    return (
      <Notice tone="warn" title={t('senscal.measured.title')}>
        <p>{t('senscal.measured.miscount', { turns, target })}</p>
      </Notice>
    )
  }

  const pct = Math.abs((1 - result.impliedScale) * 100).toFixed(2)
  const direction = result.impliedScale < 1 ? t('senscal.measured.low') : t('senscal.measured.high')
  return (
    <Notice tone="success" title={t('senscal.measured.title')}>
      <p>
        {t('senscal.measured.body', {
          target,
          turns,
          pct,
          direction,
          deg: Math.abs(result.errorDegPerTurn).toFixed(2)
        })}
      </p>
      <p className="mt-2 text-slate-100">
        {t('senscal.measured.correction', {
          value: formatSensValue(result.correctionDeg),
          axis: axis.toUpperCase(),
          scale: scaleFromCorrection(result.correctionDeg).toFixed(4)
        })}
      </p>
      {result.offAxis !== 'ok' && (
        <p className="mt-2 text-amber-200">{t('senscal.measured.offaxis')}</p>
      )}
    </Notice>
  )
}

function VerificationNotice({ result }: { result: VerificationResult }) {
  const t = useAppStore((s) => s.t)
  if (result.gaps > 0) {
    return (
      <Notice tone="warn" title={t('senscal.verify.title')}>
        <p>{t('senscal.verify.gap')}</p>
      </Notice>
    )
  }
  if (!result.withinClamp) {
    return (
      <Notice tone="warn" title={t('senscal.verify.title')}>
        <p>
          {t('senscal.verify.miscount', {
            turns: (result.measuredDeg / 360).toFixed(1),
            target: (result.expectedDeg / 360).toFixed(0)
          })}
        </p>
      </Notice>
    )
  }
  const deg = Math.abs(result.degPerTurn).toFixed(2)
  return (
    <Notice tone={result.pass ? 'success' : 'warn'} title={t('senscal.verify.title')}>
      <p>{result.pass ? t('senscal.verify.pass', { deg }) : t('senscal.verify.fail', { deg })}</p>
    </Notice>
  )
}

/** The live placement reading under the preview, coloured by whether it fits. */
function ReadingLine({ reading, ok }: { reading: PlacementReading | null; ok: boolean }) {
  const t = useAppStore((s) => s.t)
  const label = reading
    ? t(`senscal.reading.${reading}` as TranslationKey)
    : t('senscal.reading.none')
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>
        {ok ? t('senscal.reading.ok') : t('senscal.reading.wrong')}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Heading({ title, body, progress }: { title: string; body: string; progress?: string }) {
  return (
    <div>
      {progress && (
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {progress}
        </div>
      )}
      <h2 className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{body}</p>
    </div>
  )
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm text-slate-100">{label}</div>
        {hint && <div className="truncate text-xs text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

const TONES = {
  info: 'border-surface-border bg-surface-raised text-slate-300',
  success: 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200',
  warn: 'border-amber-700/50 bg-amber-950/30 text-amber-200',
  error: 'border-rose-700/50 bg-rose-950/30 text-rose-200'
}

function Notice({
  tone,
  title,
  children
}: {
  tone: keyof typeof TONES
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>
      <strong className="block text-slate-100">{title}</strong>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** Summary line for one axis on the done screen. */
function outcomeText(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  outcome: AxisOutcome,
  correction: number | null
): string {
  if (outcome === 'skipped' || outcome === 'pending' || correction === null) {
    return t('senscal.done.skipped')
  }
  const value = formatSensValue(correction)
  switch (outcome) {
    case 'verified':
      return t('senscal.done.verified', { value })
    case 'unverified':
      return t('senscal.done.unverified', { value })
    default:
      return t('senscal.done.applied', { value })
  }
}
