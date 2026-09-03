import { useCallback, useEffect, useRef, useState } from 'react'
import { SENS_CAL } from '@shared/config'
import { matchSlotToTracker } from '@shared/receiver-slots'
import {
  emptyAccumulator,
  hasEnoughAngle,
  initialSensCalState,
  isUrgent,
  offAxisLevel,
  paceTurns,
  pushRotation,
  reduceSensCal,
  secondsLeft,
  turnsCompleted,
  turnsMeasured,
  verifySpin,
  type SensCalState,
  type TurnAccumulator,
  type VerificationResult
} from '@shared/sens-cal'
import type { ReceiverPort, ReceiverSlot, SensCalAxis, TrackerInfo } from '@shared/types'
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
 * The tracker firmware can measure its own gyro scale factor (`sens auto`),
 * but only if the user spins it a known number of turns, about one axis, fast
 * enough, without tilting it — and the firmware reports nothing back over the
 * radio. So this flow does three jobs the firmware cannot: it coaches the
 * physical setup, it makes the pace achievable instead of merely reporting
 * failure afterwards, and it measures the result itself with a verification
 * spin. See `@shared/sens-cal` for the phase machine and the maths.
 */

type Stage =
  | 'connecting'
  | 'choose-port'
  | 'no-port'
  | 'error'
  | 'pick'
  | 'confirm'
  | 'place'
  | 'practice'
  | 'run'
  | 'failed'
  | 'verify'
  | 'axis-result'
  | 'done'

type AxisOutcome = 'pending' | 'passed' | 'failed' | 'skipped'

/** How often the phase machine gets a clock tick while a run is live. */
const TICK_MS = 200

const AXES = SENS_CAL.axes

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
  const [axisIndex, setAxisIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<SensCalAxis, AxisOutcome>>({
    x: 'pending',
    y: 'pending',
    z: 'pending'
  })

  const [cal, setCal] = useState<SensCalState>(initialSensCalState())
  const [acc, setAcc] = useState<TurnAccumulator>(emptyAccumulator())
  const [practiceSeconds, setPracticeSeconds] = useState<number | null>(null)
  const [verification, setVerification] = useState<VerificationResult | null>(null)

  const axis = AXES[axisIndex]
  const tracker = trackers.find((x) => x.id === trackerId)

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
    // Always release the port when the flow closes; a calibration already
    // running on a tracker is unaffected — it belongs to the tracker.
    return () => {
      void window.api.receiver.closeConsole()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -- live rotation into the accumulator / phase machine -------------------

  const liveStages: Stage[] = ['practice', 'run', 'verify']
  const isLive = liveStages.includes(stage)

  useEffect(() => {
    if (!isLive || !trackerId) return
    const unsubscribe = useAppStore.subscribe((state) => {
      const rotation = state.liveState.trackers.find((x) => x.id === trackerId)?.rotation
      if (!rotation) return
      const atMs = performance.now()
      if (stage === 'run') {
        setCal((s) => reduceSensCal(s, { type: 'rotation', quat: rotation, atMs }))
      } else {
        setAcc((a) => pushRotation(a, rotation, atMs))
      }
    })
    return unsubscribe
  }, [isLive, stage, trackerId])

  // Timeouts have to advance even when the feed goes quiet — a stalled feed is
  // itself one of the ways a run fails.
  useEffect(() => {
    if (stage !== 'run') return
    const id = setInterval(
      () => setCal((s) => reduceSensCal(s, { type: 'tick', atMs: performance.now() })),
      TICK_MS
    )
    return () => clearInterval(id)
  }, [stage])

  // The receiver's ack is the only confirmation that the command was accepted,
  // and it can land before an effect keyed on the run stage would have
  // subscribed — so listen for the whole life of the flow. The phase machine
  // ignores console lines outside the window where they mean anything.
  useEffect(() => {
    return window.api.receiver.onConsoleEvent((event) => {
      if (event.type === 'line') {
        setCal((s) =>
          reduceSensCal(s, { type: 'console', line: event.line, atMs: performance.now() })
        )
      } else if (event.type === 'error') {
        fail(event.message)
      }
    })
  }, [fail])

  // Move off the run stage when the phase machine settles.
  useEffect(() => {
    if (stage !== 'run') return
    if (cal.phase === 'complete') setStage('verify')
    else if (cal.phase === 'failed') setStage('failed')
  }, [stage, cal.phase])

  // Practice: time one full turn so the user learns the cadence before a run.
  const practiceStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (stage !== 'practice') return
    if (practiceStartRef.current === null) {
      if (acc.rateDps >= SENS_CAL.startRateDps) practiceStartRef.current = performance.now()
      return
    }
    if (turnsMeasured(acc) >= 1) {
      setPracticeSeconds((performance.now() - practiceStartRef.current) / 1000)
      practiceStartRef.current = null
      setAcc(emptyAccumulator())
    }
  }, [stage, acc])

  // -- actions --------------------------------------------------------------

  const pickTracker = (candidate: TrackerInfo): void => {
    setTrackerId(candidate.id)
    const match = slots
      .map((s) => matchSlotToTracker(s, trackers))
      .find((m) => m.confident && m.trackerId === candidate.id)
    setSlot(match ? match.slot : null)
    setStage('confirm')
  }

  const startRun = async (): Promise<void> => {
    if (slot === null) return
    setCal(initialSensCalState(axis, SENS_CAL.revolutions))
    setStage('run')
    try {
      await window.api.receiver.startSensCal({ slot, axis, revolutions: SENS_CAL.revolutions })
      setCal((s) =>
        reduceSensCal(s, {
          type: 'sent',
          axis,
          revolutions: SENS_CAL.revolutions,
          atMs: performance.now()
        })
      )
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
  }

  const finishAxis = (outcome: AxisOutcome): void => {
    setOutcomes((o) => ({ ...o, [axis]: outcome }))
    setStage('axis-result')
  }

  const nextAxis = (): void => {
    setVerification(null)
    setPracticeSeconds(null)
    setAcc(emptyAccumulator())
    if (axisIndex + 1 < AXES.length) {
      setAxisIndex(axisIndex + 1)
      setStage('place')
    } else {
      setStage('done')
    }
  }

  const redoAxis = (): void => {
    setVerification(null)
    setAcc(emptyAccumulator())
    setOutcomes((o) => ({ ...o, [axis]: 'pending' }))
    setStage('place')
  }

  // -- render ---------------------------------------------------------------

  const axisTitleKey = `senscal.axis.${axis}.title` as TranslationKey
  const axisBodyKey = `senscal.axis.${axis}.body` as TranslationKey

  const footer =
    stage === 'run' ? (
      <Button
        variant="ghost"
        onClick={() => {
          setCal((s) => reduceSensCal(s, { type: 'abort', atMs: performance.now() }))
        }}
      >
        {t('senscal.run.cancel')}
      </Button>
    ) : undefined

  return (
    <FlowShell
      title={t('senscal.title')}
      description={t('senscal.subtitle')}
      onExit={onExit}
      footer={footer}
    >
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
          <TrackerPreview rotation={tracker.rotation} fallbackText={t('senscal.preview.nowebgl')} />

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
            <Button disabled={slot === null} onClick={() => setStage('place')}>
              {t('senscal.confirm.yes')}
            </Button>
            <Button variant="ghost" onClick={() => setStage('pick')}>
              {t('senscal.confirm.no')}
            </Button>
          </div>
        </div>
      )}

      {(stage === 'place' || stage === 'practice') && (
        <div className="space-y-3">
          <AxisHeading
            title={t(axisTitleKey)}
            body={t(axisBodyKey)}
            progress={t('senscal.axis.progress', { index: axisIndex + 1, total: AXES.length })}
          />
          <TrackerPreview
            rotation={tracker?.rotation}
            highlightAxis={axis}
            fallbackText={t('senscal.preview.nowebgl')}
          />

          <Notice tone="info" title={t('senscal.place.title')}>
            <p>{t('senscal.place.edge')}</p>
            <p className="mt-2 text-slate-400">{t('senscal.place.why')}</p>
            <p className="mt-2">{t('senscal.place.flat')}</p>
          </Notice>

          {stage === 'practice' && (
            <Notice tone="info" title={t('senscal.practice.title')}>
              <p>
                {t('senscal.practice.body', { budget: Math.round(SENS_CAL.spinTimeoutMs / 1000) })}
              </p>
              <p className="mt-2 text-slate-400">
                {t('senscal.practice.target', { seconds: SENS_CAL.paceSecondsPerTurn })}
              </p>
              {practiceSeconds === null ? (
                <p className="mt-2 text-slate-400">{t('senscal.practice.waiting')}</p>
              ) : (
                <>
                  <p className="mt-2 text-slate-100">
                    {t('senscal.practice.measured', { seconds: practiceSeconds.toFixed(1) })}
                  </p>
                  <p
                    className={`mt-1 ${
                      practiceSeconds <= SENS_CAL.paceSecondsPerTurn
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }`}
                  >
                    {practiceSeconds <= SENS_CAL.paceSecondsPerTurn
                      ? t('senscal.practice.good')
                      : t('senscal.practice.slow')}
                  </p>
                </>
              )}
            </Notice>
          )}

          <div className="flex gap-3">
            {stage === 'place' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setPracticeSeconds(null)
                  practiceStartRef.current = null
                  setAcc(emptyAccumulator())
                  setStage('practice')
                }}
              >
                {t('senscal.place.practice')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setStage('place')}>
                {t('senscal.practice.done')}
              </Button>
            )}
            <Button onClick={startRun}>{t('senscal.place.start')}</Button>
          </div>
        </div>
      )}

      {stage === 'run' && <RunPanel state={cal} rotation={tracker?.rotation} />}

      {stage === 'failed' && (
        <Notice tone="error" title={t('senscal.fail.title')}>
          <p>{t(`senscal.fail.${failureKey(cal)}` as TranslationKey)}</p>
          <p className="mt-2 text-slate-300">
            {t(`senscal.fail.cause.${cal.cause ?? 'unknown'}` as TranslationKey, {
              budget: Math.round(SENS_CAL.spinTimeoutMs / 1000)
            })}
          </p>
          <div className="mt-3 flex gap-3">
            <Button onClick={redoAxis}>{t('senscal.fail.retry')}</Button>
            <Button variant="ghost" onClick={() => finishAxis('skipped')}>
              {t('senscal.fail.skip')}
            </Button>
          </div>
        </Notice>
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
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setAcc(emptyAccumulator())}>
              {t('senscal.verify.start')}
            </Button>
            <Button
              onClick={() => {
                const result = verifySpin(acc, SENS_CAL.revolutions)
                setVerification(result)
                if (result.withinClamp) finishAxis(result.pass ? 'passed' : 'failed')
              }}
            >
              {t('senscal.verify.finish')}
            </Button>
            <Button variant="ghost" onClick={() => finishAxis('skipped')}>
              {t('senscal.verify.skip')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'axis-result' && (
        <div className="space-y-3">
          {verification && <VerificationNotice result={verification} />}
          <div className="flex gap-3">
            <Button onClick={nextAxis}>
              {axisIndex + 1 < AXES.length ? t('senscal.result.next') : t('senscal.result.finish')}
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
          {AXES.map((a) => (
            <Row
              key={a}
              label={t('senscal.done.axis', { axis: a.toUpperCase() })}
              hint={t(`senscal.done.${outcomeKey(outcomes[a])}` as TranslationKey)}
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
 * The live run: the firmware's phase mirrored on screen, the turn counter, a
 * pace marker, and the countdown against the spin budget. The pace marker is
 * the part that stops a run failing — under-spinning does not produce a bad
 * calibration, it hangs for a minute and then reports a timeout.
 */
function RunPanel({
  state,
  rotation
}: {
  state: SensCalState
  rotation?: TrackerInfo['rotation']
}) {
  const t = useAppStore((s) => s.t)
  const turns = turnsCompleted(state)
  const pace = paceTurns(state)
  const behind = state.phase === 'spinning' && turns + 0.3 < pace
  const left = secondsLeft(state)
  const urgent = isUrgent(state)
  const offAxis = offAxisLevel(state)
  const phaseKey = `senscal.phase.${phaseSlug(state)}` as TranslationKey

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-4">
        <div className="text-sm font-medium text-brand-200">{t(phaseKey)}</div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="text-4xl font-semibold tabular-nums text-slate-50">
            {t('senscal.run.turns', {
              turns: turns.toFixed(1),
              target: state.revolutions
            })}
          </div>
          {(state.phase === 'spinning' || state.phase === 'stopping') && (
            <div
              className={`text-2xl font-semibold tabular-nums ${
                urgent ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              {t('senscal.run.timeleft', { seconds: Math.ceil(left) })}
            </div>
          )}
        </div>

        {/* Progress, with the pace marker sitting where the user should be. */}
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-border">
          <div
            className="h-full bg-brand-500 transition-[width] duration-150"
            style={{ width: `${Math.min(100, (turns / state.revolutions) * 100)}%` }}
          />
          {pace > 0 && (
            <div
              className="absolute top-0 h-full w-0.5 bg-amber-300"
              style={{ left: `${Math.min(100, (pace / state.revolutions) * 100)}%` }}
            />
          )}
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <span className={behind ? 'text-amber-300' : 'text-slate-500'}>
            {behind ? t('senscal.run.behind') : t('senscal.run.pace', { pace: pace.toFixed(1) })}
          </span>
          {hasEnoughAngle(state) && (
            <span className="text-emerald-300">{t('senscal.phase.stopping')}</span>
          )}
        </div>

        {offAxis !== 'ok' && (
          <p
            className={`mt-2 text-sm ${offAxis === 'reject' ? 'text-rose-300' : 'text-amber-300'}`}
          >
            {offAxis === 'reject' ? t('senscal.run.offaxis.reject') : t('senscal.run.offaxis.warn')}
          </p>
        )}
      </div>

      <TrackerPreview
        rotation={rotation}
        highlightAxis={state.axis}
        fallbackText={t('senscal.preview.nowebgl')}
      />
    </div>
  )
}

function VerificationNotice({ result }: { result: VerificationResult }) {
  const t = useAppStore((s) => s.t)
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

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function AxisHeading({
  title,
  body,
  progress
}: {
  title: string
  body: string
  progress: string
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{progress}</div>
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

/** Phase → translation-key suffix. */
function phaseSlug(state: SensCalState): string {
  switch (state.phase) {
    case 'ready-to-spin':
      return 'ready'
    case 'bias':
      return 'bias'
    case 'spinning':
      return 'spinning'
    case 'stopping':
      return 'stopping'
    case 'complete':
      return 'complete'
    default:
      return 'sending'
  }
}

/** Failure → translation-key suffix. */
function failureKey(state: SensCalState): string {
  switch (state.failure) {
    case 'rejected':
      return 'rejected'
    case 'no-ack':
      return 'noack'
    case 'no-spin':
      return 'nospin'
    case 'aborted':
      return 'aborted'
    default:
      return 'timeout'
  }
}

function outcomeKey(outcome: AxisOutcome): string {
  return outcome === 'passed' ? 'passed' : outcome === 'skipped' ? 'skipped' : 'failed'
}
