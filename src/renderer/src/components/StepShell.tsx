import type { ReactNode } from 'react'

interface StepShellProps {
  title: string
  description?: string
  children: ReactNode
}

/** Consistent header + scrollable body wrapper for every wizard step. */
export function StepShell({ title, description, children }: StepShellProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{children}</div>
    </div>
  )
}
