import type { ReactNode } from 'react'

interface ActionCardProps {
  icon: ReactNode
  title: string
  body: string
  onClick: () => void
}

/** Large clickable card used on the home screen for the primary tasks. */
export function ActionCard({ icon, title, body, onClick }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border border-surface-border bg-surface-raised px-5 py-5 text-left transition-colors hover:border-brand-500/60 hover:bg-brand-600/10"
    >
      <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600/20 text-2xl text-brand-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-slate-50">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-400">{body}</span>
      </span>
    </button>
  )
}
