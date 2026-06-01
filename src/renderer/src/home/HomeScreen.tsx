import { useAppStore } from '../store/useAppStore'
import { ActionCard } from '../components/ActionCard'

export type HomeAction = 'pair' | 'calibrate' | 'troubleshoot' | 'wizard'

export function HomeScreen({ onSelect }: { onSelect: (action: HomeAction) => void }) {
  const t = useAppStore((s) => s.t)
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-50">{t('home.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('home.subtitle')}</p>
      </header>

      <div className="space-y-3">
        <ActionCard
          icon="🔗"
          title={t('home.pair.title')}
          body={t('home.pair.body')}
          onClick={() => onSelect('pair')}
        />
        <ActionCard
          icon="🎯"
          title={t('home.calibrate.title')}
          body={t('home.calibrate.body')}
          onClick={() => onSelect('calibrate')}
        />
        <ActionCard
          icon="🛠️"
          title={t('home.troubleshoot.title')}
          body={t('home.troubleshoot.body')}
          onClick={() => onSelect('troubleshoot')}
        />
        <ActionCard
          icon="🧭"
          title={t('home.wizard.title')}
          body={t('home.wizard.body')}
          onClick={() => onSelect('wizard')}
        />
      </div>
    </div>
  )
}
