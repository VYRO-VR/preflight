import { BUTTON_ACTIONS, LED_CODES, LINKS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { Button } from '../components/Button'

export function CalibrationStep() {
  const t = useAppStore((s) => s.t)
  return (
    <StepShell title={t('step.calibration.title')}>
      <p className="text-sm text-slate-400">
        To calibrate, lay the tracker flat and still and press the button twice — the LED flashes to
        confirm when complete. Then, standing in an I-pose, run a full reset in SlimeVR Server so
        your skeleton matches your body.
      </p>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('step.calibration.buttons')}
      </div>
      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">Button</th>
              <th className="px-4 py-2">Action</th>
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
                <td className="px-4 py-2 text-slate-400">{b.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('step.calibration.led')}
      </div>
      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <tbody>
            {LED_CODES.map((c) => (
              <tr key={c.pattern} className="border-t border-surface-border first:border-t-0">
                <td className="w-52 px-4 py-2 font-medium text-slate-200">{c.pattern}</td>
                <td className="px-4 py-2 text-slate-400">{c.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="ghost" onClick={() => window.api.docs.openExternal(LINKS.smolDocs)}>
        {t('step.calibration.docs')}
      </Button>
    </StepShell>
  )
}
