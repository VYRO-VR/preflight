import { BUTTON_ACTIONS } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'

export function CalibrationStep() {
  const t = useAppStore((s) => s.t)
  return (
    <StepShell title={t('step.calibration.title')}>
      <p className="text-sm text-slate-400">
        Stand in an I-pose and perform a full reset in SlimeVR Server, then a mounting reset, so your
        skeleton matches your real body. Use the button reference below.
      </p>
      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">Presses</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {BUTTON_ACTIONS.map((b) => (
              <tr key={b.presses} className="border-t border-surface-border">
                <td className="px-4 py-2 font-semibold text-brand-300">{b.presses}×</td>
                <td className="px-4 py-2 text-slate-100">{b.action}</td>
                <td className="px-4 py-2 text-slate-400">{b.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StepShell>
  )
}
