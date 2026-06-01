import { BUTTON_ACTIONS, LINKS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { FlowShell } from '../components/FlowShell'
import { Button } from '../components/Button'

/**
 * Light guided calibration. Calibration on smol-slime trackers is performed
 * on-device (lay flat + double-tap), so this flow gives clear instructions and
 * the button reference; serial-driven 6-side calibration is a future addition.
 */
export function CalibrateFlow({ onExit }: { onExit: () => void }) {
  const t = useAppStore((s) => s.t)
  return (
    <FlowShell title={t('calibrate.title')} onExit={onExit}>
      <p className="text-sm text-slate-400">{t('calibrate.intro')}</p>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('calibrate.buttons')}
      </div>
      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">Button</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">LED</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {BUTTON_ACTIONS.map((b) => (
              <tr key={b.input} className="border-t border-surface-border">
                <td className="whitespace-nowrap px-4 py-2 font-semibold text-brand-300">
                  {b.input}
                </td>
                <td className="px-4 py-2 text-slate-100">{b.action}</td>
                <td className="px-4 py-2 text-slate-300">{b.led}</td>
                <td className="px-4 py-2 text-slate-400">{b.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="ghost" onClick={() => window.api.docs.openExternal(LINKS.smolDocs)}>
        {t('step.calibration.docs')}
      </Button>
    </FlowShell>
  )
}
