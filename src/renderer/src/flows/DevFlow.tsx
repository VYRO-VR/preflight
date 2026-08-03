import { useEffect, useRef, useState } from 'react'
import type { BulkFlashLogCode, BulkFlashPhase, CheckStatus } from '@shared/types'
import type { TranslationKey } from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'

type LogLevel = 'info' | 'success' | 'error'

/**
 * Log entries store the translation key + vars (not the rendered string) so
 * the log survives a language switch, and raw nrfutil output stays confined
 * to the dimmed `detail` line under an error.
 */
interface LogEntry {
  time: string
  level: LogLevel
  key: TranslationKey
  vars?: Record<string, string | number>
  detail?: string
}

const MAX_LOG_ENTRIES = 500

// Exhaustive maps: a new code/phase in shared/types.ts fails typecheck here
// until its translation key exists in en.ts.
const MSG_KEY: Record<BulkFlashLogCode, TranslationKey> = {
  ready: 'dev.msg.ready',
  protected: 'dev.msg.protected',
  recovered: 'dev.msg.recovered',
  'recover-failed': 'dev.msg.recoverfailed',
  removed: 'dev.msg.removed',
  'stuck-hint': 'dev.msg.stuckhint',
  'nrfutil-missing': 'dev.msg.nonrfutil',
  'device-plugin-missing': 'dev.msg.nodeviceplugin',
  'hex-missing': 'dev.msg.nohex'
}

const PHASE_KEY: Record<BulkFlashPhase, TranslationKey> = {
  idle: 'dev.phase.idle',
  setup: 'dev.phase.setup',
  waiting: 'dev.phase.waiting',
  flashing: 'dev.phase.flashing',
  recovering: 'dev.phase.recovering',
  cooldown: 'dev.phase.cooldown',
  remove: 'dev.phase.remove'
}

const PHASE_STATUS: Record<BulkFlashPhase, CheckStatus> = {
  idle: 'pending',
  setup: 'running',
  waiting: 'running',
  flashing: 'running',
  recovering: 'running',
  cooldown: 'warn',
  remove: 'warn'
}

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: 'text-slate-400',
  success: 'text-emerald-300',
  error: 'text-rose-300'
}

const sectionClass = 'space-y-3 rounded-lg border border-surface-border bg-surface-raised p-4'

export function DevFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  const [phase, setPhase] = useState<BulkFlashPhase>('idle')
  const [count, setCount] = useState(0)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const append = (entry: Omit<LogEntry, 'time'>): void =>
      setLog((prev) =>
        [...prev, { time: new Date().toLocaleTimeString([], { hour12: false }), ...entry }].slice(
          -MAX_LOG_ENTRIES
        )
      )
    const off = window.api.dev.onBulkFlashEvent((event) => {
      if (event.type === 'phase') {
        setPhase(event.phase)
      } else if (event.type === 'log') {
        append({ level: event.level, key: MSG_KEY[event.code], detail: event.detail })
      } else if (event.type === 'flashed') {
        setCount(event.count)
        append({
          level: 'success',
          key: 'dev.msg.ok',
          vars: { count: event.count, seconds: (event.elapsedMs / 1000).toFixed(1) }
        })
      } else {
        setCount(event.count)
        setRunning(false)
        append({ level: 'info', key: 'dev.msg.stopped', vars: { count: event.count } })
      }
    })
    return () => {
      off()
      // Never leave the loop (and its J-Link traffic) running behind an
      // unmounted panel.
      void window.api.dev.bulkFlashStop()
    }
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  const start = (): void => {
    setLog([])
    setCount(0)
    setRunning(true)
    void window.api.dev.bulkFlashStart()
  }

  const exit = async (): Promise<void> => {
    // Flush the stop through IPC before unmounting, like PairingFlow does.
    await window.api.dev.bulkFlashStop()
    onExit()
  }

  return (
    <FlowShell title={t('dev.title')} description={t('dev.subtitle')} onExit={() => void exit()}>
      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{t('dev.bulkflash.title')}</h2>
            <p className="mt-1 max-w-xl text-xs text-slate-400">{t('dev.bulkflash.body')}</p>
          </div>
          <div className="flex items-baseline gap-2 pl-4">
            <span className="text-4xl font-semibold tabular-nums text-emerald-400">{count}</span>
            <span className="text-xs text-slate-400">{t('dev.bulkflash.count')}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {running ? (
            <Button variant="danger" onClick={() => void window.api.dev.bulkFlashStop()}>
              {t('dev.bulkflash.stop')}
            </Button>
          ) : (
            <Button onClick={start}>{t('dev.bulkflash.start')}</Button>
          )}
          <StatusBadge status={PHASE_STATUS[phase]} label={t(PHASE_KEY[phase])} />
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold text-slate-200">{t('dev.bulkflash.log')}</h2>
        <pre
          ref={logRef}
          className="max-h-72 min-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-slate-400"
        >
          {log.length === 0 && (
            <span className="text-slate-600">{t('dev.bulkflash.log.empty')}</span>
          )}
          {log.map((entry, i) => (
            <div key={i} className={LEVEL_CLASS[entry.level]}>
              <span className="text-slate-600">[{entry.time}] </span>
              {t(entry.key, entry.vars)}
              {entry.detail && <div className="pl-16 text-slate-600">{entry.detail}</div>}
            </div>
          ))}
        </pre>
      </section>
    </FlowShell>
  )
}
