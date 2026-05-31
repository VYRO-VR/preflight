import { useAppStore } from '../store/useAppStore'
import { StepShell } from '../components/StepShell'
import { DocViewer } from '../components/DocViewer'

export function MountingStep() {
  const t = useAppStore((s) => s.t)
  return (
    <StepShell title={t('step.mounting.title')}>
      <p className="text-sm text-slate-400">
        Slide each tracker into its tray with the USB port facing down, then secure the strap so the
        tracker sits snugly against the body part it represents.
      </p>
      <DocViewer slug="wearing" />
    </StepShell>
  )
}
