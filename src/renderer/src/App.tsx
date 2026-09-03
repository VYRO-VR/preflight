import { useEffect, useState, type ReactNode } from 'react'
import { useAppStore } from './store/useAppStore'
import { STEPS } from './wizard/steps'
import { Button } from './components/Button'
import { LanguageSelector } from './components/LanguageSelector'
import { PairingIndicator } from './components/PairingIndicator'
import { HomeScreen, type HomeAction } from './home/HomeScreen'
import { PairingFlow } from './flows/PairingFlow'
import { CalibrateFlow } from './flows/CalibrateFlow'
import { TroubleshootFlow } from './flows/TroubleshootFlow'
import { FirmwareUpdateFlow } from './flows/FirmwareUpdateFlow'
import { DevFlow } from './flows/DevFlow'

type View = 'home' | 'wizard' | 'pair' | 'calibrate' | 'troubleshoot' | 'receiver' | 'dev'

export default function App() {
  const init = useAppStore((s) => s.init)
  const t = useAppStore((s) => s.t)
  const appVersion = useAppStore((s) => s.appVersion)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const selectedProduct = useAppStore((s) => s.selectedProduct)
  const cableAcknowledged = useAppStore((s) => s.cableAcknowledged)

  const [view, setView] = useState<View>('home')
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    init().then(() => setReady(true))
  }, [init])

  if (!ready) {
    return <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
  }

  const goHome = (): void => setView('home')

  // Every view renders inside a wrapper that pins the pairing indicator and
  // the language selector to the top-right corner of the window.
  const withChrome = (content: ReactNode): JSX.Element => (
    <div className="relative h-full">
      <div className="absolute right-4 top-3 z-50 flex items-center gap-3">
        <PairingIndicator />
        <LanguageSelector />
      </div>
      {content}
    </div>
  )

  if (view === 'home') {
    return withChrome(
      <HomeScreen onSelect={(action: HomeAction) => setView(action)} onDev={() => setView('dev')} />
    )
  }
  if (view === 'pair') return withChrome(<PairingFlow onExit={goHome} />)
  if (view === 'calibrate') return withChrome(<CalibrateFlow onExit={goHome} />)
  if (view === 'troubleshoot') return withChrome(<TroubleshootFlow onExit={goHome} />)
  if (view === 'receiver') return withChrome(<FirmwareUpdateFlow onExit={goHome} />)
  if (view === 'dev') return withChrome(<DevFlow onExit={goHome} />)

  const Step = STEPS[index].Component
  const currentId = STEPS[index].id
  const isFirst = index === 0
  const isLast = index === STEPS.length - 1
  // Gate progress: the welcome step needs a product; the receiver step needs
  // the user to confirm the extension cable is connected.
  const canAdvance =
    (currentId !== 'welcome' || Boolean(selectedProduct)) &&
    (currentId !== 'receiver' || cableAcknowledged)

  return withChrome(
    <div className="flex h-full">
      {/* Left rail */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
        <div className="px-5 py-5">
          <div className="text-sm font-bold tracking-wide text-brand-400">VYRO VR</div>
          <div className="text-xs text-slate-500">{t('app.title')}</div>
          <button onClick={goHome} className="mt-2 text-xs text-slate-400 hover:text-brand-300">
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
          <span>v{appVersion}</span>
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
