import type { ReactNode } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'

interface FlowShellProps {
  title: string
  description?: string
  onExit: () => void
  /** Optional footer (e.g. action buttons) pinned to the bottom. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Full-screen wrapper for a guided flow launched from the home screen: a top
 * bar with a "Home" button, a header, a scrollable body, and an optional
 * footer. Mirrors the look of StepShell so flows feel native to the app.
 */
export function FlowShell({ title, description, onExit, footer, children }: FlowShellProps) {
  const t = useAppStore((s) => s.t)
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border px-8 py-3">
        <Button variant="ghost" onClick={onExit}>
          ← {t('nav.home')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-8">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </header>
        <div className="space-y-3">{children}</div>
      </div>
      {footer && (
        <footer className="flex items-center justify-end gap-3 border-t border-surface-border px-8 py-4">
          {footer}
        </footer>
      )}
    </div>
  )
}
