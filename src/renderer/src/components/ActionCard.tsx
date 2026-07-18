import type { ReactNode } from 'react'

interface ActionCardProps {
  icon: ReactNode
  title: string
  body: string
  onClick: () => void
  /** 'featured' renders a large highlighted card, 'compact' a slim row. */
  variant?: 'featured' | 'compact'
}

/** Clickable card used on the home screen for the primary tasks. */
export function ActionCard({ icon, title, body, onClick, variant }: ActionCardProps) {
  if (variant === 'featured') {
    return (
      <button
        onClick={onClick}
        className="group flex w-full flex-col items-start gap-4 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-600/25 to-surface-raised px-6 py-6 text-left transition-colors hover:border-brand-400 hover:from-brand-600/35"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-600/30 text-3xl text-brand-200">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-slate-50">{title}</span>
          <span className="mt-1 block text-sm text-slate-300">{body}</span>
        </span>
      </button>
    )
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-left transition-colors hover:border-brand-500/60 hover:bg-brand-600/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600/20 text-lg text-brand-300">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-50">{title}</span>
          <span className="block text-xs text-slate-400">{body}</span>
        </span>
      </button>
    )
  }

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
