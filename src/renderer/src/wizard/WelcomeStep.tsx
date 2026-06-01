import { PRODUCTS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'

export function WelcomeStep() {
  const t = useAppStore((s) => s.t)
  const selectedProduct = useAppStore((s) => s.selectedProduct)
  const selectProduct = useAppStore((s) => s.selectProduct)

  return (
    <StepShell title={t('step.welcome.title')} description={t('step.welcome.body')}>
      <div className="grid gap-3 sm:grid-cols-3">
        {PRODUCTS.map((p) => {
          const active = selectedProduct === p.id
          return (
            <button
              key={p.id}
              onClick={() => selectProduct(p.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-950/40 ring-1 ring-brand-500'
                  : 'border-surface-border bg-surface-raised hover:border-brand-700'
              }`}
            >
              <div className="text-base font-semibold text-slate-50">{p.name}</div>
              <div className="mt-1 text-xs font-medium text-brand-300">
                {t('step.welcome.trackers', { count: p.trackerCount })}
              </div>
              <p className="mt-2 text-xs text-slate-400">{p.description}</p>
            </button>
          )
        })}
      </div>
    </StepShell>
  )
}
