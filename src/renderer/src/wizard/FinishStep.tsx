import { useState } from 'react'
import { LINKS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { Button } from '../components/Button'

export function FinishStep() {
  const t = useAppStore((s) => s.t)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const onExport = async () => {
    const res = await window.api.diagnostics.export()
    setExportMsg(res.message)
  }

  const links: { label: string; url: string }[] = [
    { label: t('links.docs'), url: LINKS.docs },
    { label: t('links.firmware'), url: LINKS.firmwareRepo },
    { label: t('links.discord'), url: LINKS.discord },
    { label: t('links.store'), url: LINKS.store }
  ]

  return (
    <StepShell title={t('step.finish.title')} description={t('step.finish.body')}>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <button
            key={l.url}
            onClick={() => window.api.docs.openExternal(l.url)}
            className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-left text-sm font-medium text-slate-100 transition-colors hover:border-brand-600"
          >
            {l.label} →
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-surface-border bg-surface-raised p-4">
        <div className="text-sm font-semibold text-slate-100">{t('step.finish.diagnostics')}</div>
        <p className="mt-0.5 text-xs text-slate-400">{t('step.finish.diagnostics.hint')}</p>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" onClick={onExport}>
            {t('step.finish.diagnostics')}
          </Button>
          {exportMsg && <span className="text-xs text-slate-400">{exportMsg}</span>}
        </div>
      </div>
    </StepShell>
  )
}
