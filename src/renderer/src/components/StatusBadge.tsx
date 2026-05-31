import type { CheckStatus } from '@shared/types'

const STYLES: Record<CheckStatus, { dot: string; text: string; label: string }> = {
  pass: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Ready' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Attention' },
  fail: { dot: 'bg-rose-500', text: 'text-rose-300', label: 'Action needed' },
  running: { dot: 'bg-brand-400 animate-pulse', text: 'text-brand-300', label: 'Checking…' },
  pending: { dot: 'bg-slate-500', text: 'text-slate-400', label: 'Not checked' }
}

export function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {label ?? s.label}
    </span>
  )
}
