import { BUTTON_ACTIONS, LINKS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { Button } from '../components/Button'

export function CalibrationStep() {
  const t = useAppStore((s) => s.t)
  return (
    <StepShell title={t('step.calibration.title')}>
      <p className="text-sm text-slate-400">
        To calibrate, lay the tracker flat and still and press the button twice — the LED cycles
        through rainbow colours until it finishes. Then, standing in an I-pose, run a full reset in
        SlimeVR Server so your skeleton matches your body.
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

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => window.api.docs.openExternal(LINKS.docs)}>
          {t('step.calibration.vyrodocs')}
        </Button>
        <Button variant="ghost" onClick={() => window.api.docs.openExternal(LINKS.smolDocs)}>
          {t('step.calibration.docs')}
        </Button>
      </div>
    </StepShell>
  )
}
