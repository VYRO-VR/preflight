import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'

const PLACEMENTS: { part: string; where: string }[] = [
  {
    part: 'Hip',
    where: 'Along the belt line, centered on the front or back of the body.'
  },
  {
    part: 'Thighs',
    where: 'Low on the thigh, close to the knee, rotated slightly outward.'
  },
  {
    part: 'Ankles',
    where: 'Just above the ankle on the outer side of the leg.'
  },
  {
    part: 'Feet',
    where: 'On top of the foot, closer to the inner edge (for foot rotation sets).'
  },
  {
    part: 'Chest',
    where: 'On the sternum — higher on the chest tracks better.'
  },
  {
    part: 'Arms',
    where: 'On the outer upper arm (for arm-tracking sets).'
  }
]

export function MountingStep() {
  const t = useAppStore((s) => s.t)
  return (
    <StepShell title={t('step.mounting.title')}>
      <p className="text-sm text-slate-400">
        Slide each tracker into its tray with the USB port facing down, then secure the strap
        snugly. Place each tracker as shown below.
      </p>
      <div className="overflow-hidden rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <tbody>
            {PLACEMENTS.map((p) => (
              <tr key={p.part} className="border-t border-surface-border first:border-t-0">
                <td className="w-28 px-4 py-2 font-semibold text-slate-100">{p.part}</td>
                <td className="px-4 py-2 text-slate-400">{p.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StepShell>
  )
}
