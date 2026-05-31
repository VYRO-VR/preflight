import { PRODUCTS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { StatusBadge } from '../components/StatusBadge'

function batteryColor(level?: number): string {
  if (level === undefined) return 'text-slate-500'
  if (level > 0.5) return 'text-emerald-300'
  if (level > 0.2) return 'text-amber-300'
  return 'text-rose-300'
}

export function TrackersStep() {
  const t = useAppStore((s) => s.t)
  const live = useAppStore((s) => s.liveState)
  const productId = useAppStore((s) => s.selectedProduct)
  const expected = PRODUCTS.find((p) => p.id === productId)?.trackerCount ?? 0

  const online = live.trackers.filter((tr) => tr.status === 'ok').length

  return (
    <StepShell title={t('step.trackers.title')} description={t('step.trackers.body')}>
      <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
        <span className="text-sm font-medium text-slate-100">
          {live.connected
            ? t('step.trackers.online', { online, expected })
            : t('step.trackers.waiting')}
        </span>
        <StatusBadge
          status={!live.connected ? 'running' : online >= expected && expected > 0 ? 'pass' : 'warn'}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {live.trackers.map((tr) => (
          <div
            key={tr.id}
            className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">{tr.name}</span>
              <StatusBadge status={tr.status === 'ok' ? 'pass' : 'warn'} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
              {tr.bodyPart && <span>{tr.bodyPart}</span>}
              {tr.batteryLevel !== undefined && (
                <span className={batteryColor(tr.batteryLevel)}>
                  {Math.round(tr.batteryLevel * 100)}%
                </span>
              )}
              {tr.rssi !== undefined && <span>{tr.rssi} dBm</span>}
              {tr.firmwareVersion && <span>fw {tr.firmwareVersion}</span>}
            </div>
          </div>
        ))}
      </div>

      {live.connected && live.trackers.length === 0 && (
        <p className="text-sm text-slate-500">
          Connected to SlimeVR Server. If your trackers are powered on they will be listed in the
          SlimeVR Server window — per-tracker battery and signal readouts will appear here once the
          live data feed lands in an upcoming build. Press each tracker once to power it on.
        </p>
      )}
    </StepShell>
  )
}
