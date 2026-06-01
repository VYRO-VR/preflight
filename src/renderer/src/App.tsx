import { useEffect, useState } from 'react'
import { SUPPORTED_LOCALES, type Locale } from './i18n'
import { useAppStore } from './store/useAppStore'
import { STEPS } from './wizard/steps'
import { Button } from './components/Button'
import { HomeScreen, type HomeAction } from './home/HomeScreen'
import { PairingFlow } from './flows/PairingFlow'
import { CalibrateFlow } from './flows/CalibrateFlow'
import { TroubleshootFlow } from './flows/TroubleshootFlow'

type View = 'home' | 'wizard' | 'pair' | 'calibrate' | 'troubleshoot'

export default function App() {
  const init = useAppStore((s) => s.init)
  const t = useAppStore((s) => s.t)
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  const appVersion = useAppStore((s) => s.appVersion)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const selectedProduct = useAppStore((s) => s.selectedProduct)

  const [view, setView] = useState<View>('home')
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    init().then(() => setReady(true))
  }, [init])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
    )
  }

  const goHome = (): void => setView('home')

  if (view === 'home') {
    return <HomeScreen onSelect={(action: HomeAction) => setView(action)} />
  }
  if (view === 'pair') return <PairingFlow onExit={goHome} />
  if (view === 'calibrate') return <CalibrateFlow onExit={goHome} />
  if (view === 'troubleshoot') return <TroubleshootFlow onExit={goHome} />

  const Step = STEPS[index].Component
  const isFirst = index === 0
  const isLast = index === STEPS.length - 1
  // The welcome step gates progress on a product selection.
  const canAdvance = index !== 0 || Boolean(selectedProduct)

  return (
    <div className="flex h-full">
      {/* Left rail */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
        <div className="px-5 py-5">
          <div className="text-sm font-bold tracking-wide text-brand-400">VYRO VR</div>
          <div className="text-xs text-slate-500">{t('app.title')}</div>
          <button
            onClick={goHome}
            className="mt-2 text-xs text-slate-400 hover:text-brand-300"
          >
            ← {t('nav.home')}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {STEPS.map((s, i) => {
            const active = i === index
            const done = i < index
            return (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'bg-brand-600/20 text-brand-200'
                    : 'text-slate-400 hover:bg-surface-border/40 hover:text-slate-200'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    done
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : active
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-border text-slate-400'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                {t(s.titleKey)}
              </button>
            )
          })}
        </nav>
        <div className="border-t border-surface-border px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-slate-300"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <span>v{appVersion}</span>
          </div>
          {updateStatus && updateStatus !== 'none' && (
            <div className="mt-2 text-brand-300">Update: {updateStatus}</div>
          )}
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden p-8">
          <Step />
        </div>
        <footer className="flex items-center justify-between border-t border-surface-border px-8 py-4">
          <Button variant="ghost" disabled={isFirst} onClick={() => setIndex((i) => i - 1)}>
            {t('nav.back')}
          </Button>
          {!isLast ? (
            <Button disabled={!canAdvance} onClick={() => setIndex((i) => i + 1)}>
              {t('nav.next')}
            </Button>
          ) : (
            <Button onClick={() => window.api.settings.set({ completedFirstRun: true })}>
              {t('nav.finish')}
            </Button>
          )}
        </footer>
      </main>
    </div>
  )
}
