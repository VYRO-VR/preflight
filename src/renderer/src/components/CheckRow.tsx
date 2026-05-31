import type { CheckStatus } from '@shared/types'
import { StatusBadge } from './StatusBadge'

interface CheckRowProps {
  label: string
  status: CheckStatus
  value?: string
  detail?: string
  action?: React.ReactNode
}

export function CheckRow({ label, status, value, detail, action }: CheckRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-surface-border bg-surface-raised px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-100">{label}</span>
          <StatusBadge status={status} />
        </div>
        {value && <p className="mt-0.5 text-sm text-slate-300">{value}</p>}
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
