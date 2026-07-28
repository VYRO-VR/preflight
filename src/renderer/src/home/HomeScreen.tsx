import { useAppStore } from '../store/useAppStore'
import { ActionCard } from '../components/ActionCard'

export type HomeAction = 'pair' | 'calibrate' | 'troubleshoot' | 'receiver' | 'wizard'

export function HomeScreen({
  onSelect,
  onDev
}: {
  onSelect: (action: HomeAction) => void
  onDev: () => void
}) {
  const t = useAppStore((s) => s.t)
  return (
    <div className="relative h-full">
      <div className="mx-auto flex h-full max-w-3xl flex-col justify-center px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-50">{t('home.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('home.subtitle')}</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <ActionCard
            variant="featured"
            icon="🔗"
            title={t('home.pair.title')}
            body={t('home.pair.body')}
            onClick={() => onSelect('pair')}
          />
          <ActionCard
            variant="featured"
            icon="📡"
            title={t('home.receiver.title')}
            body={t('home.receiver.body')}
            onClick={() => onSelect('receiver')}
          />
        </div>

        <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-slate-500">
          {t('home.more')}
        </p>
        <div className="space-y-2">
          <ActionCard
            variant="compact"
            icon="🎯"
            title={t('home.calibrate.title')}
            body={t('home.calibrate.body')}
            onClick={() => onSelect('calibrate')}
          />
          <ActionCard
            variant="compact"
            icon="🛠️"
            title={t('home.troubleshoot.title')}
            body={t('home.troubleshoot.body')}
            onClick={() => onSelect('troubleshoot')}
          />
          <ActionCard
            variant="compact"
            icon="🧭"
            title={t('home.wizard.title')}
            body={t('home.wizard.body')}
            onClick={() => onSelect('wizard')}
          />
        </div>
      </div>

      {/* Deliberately near-invisible: internal production tooling, not a
          customer-facing task. */}
      <button
        onClick={onDev}
        title={t('dev.open')}
        aria-label={t('dev.open')}
        className="absolute bottom-3 right-3 rounded px-2 py-1 font-mono text-xs text-slate-700 transition-colors hover:text-slate-400"
      >
        {'</>'}
      </button>
    </div>
  )
}
